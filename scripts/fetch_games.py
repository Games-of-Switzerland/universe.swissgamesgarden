#!/usr/bin/env python3
"""
Fetch all games from the Swiss Games Garden search API and append the NEW ones
to the local database (data/games.json). This file is the network and file adapter;
what gets added, refreshed or skipped is decided by merge.py.

Existing games are left untouched: their constellation values are computed once,
when the game is first seen, and never change afterwards.

Usage:
    python3 scripts/fetch_games.py                 # add new games only
    python3 scripts/fetch_games.py --refresh-meta  # also refresh title/cover/... of known games
    python3 scripts/fetch_games.py --rebuild       # refetch everything and recompute EVERY constellation (breaks stability)
    python3 scripts/fetch_games.py --relayout      # recompute every constellation from the local data, no network
    python3 scripts/fetch_games.py --dry-run       # fetch and report, write nothing

No third-party dependency: standard library only.
"""

from __future__ import annotations

import argparse
import json
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from constellation import ALGORITHM_VERSION  # noqa: E402
from merge import NO_DETAIL, empty_db, merge, relayout  # noqa: E402

API = "https://api.swissgames.garden/search/games?page={page}"
DETAIL = "https://api.swissgames.garden/G70VW4Y9sP/jsonapi/node/game?filter%5Bfield_path%5D={path}&include=genres,languages"
ROOT = Path(__file__).resolve().parent.parent
DATA_JSON = ROOT / "data" / "games.json"
USER_AGENT = "universe.swissgamesgarden/1.0 (+https://github.com)"


def fetch_page(page: int, retries: int = 3) -> list[dict]:
    url = API.format(page=page)
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.load(resp)
            return [h["_source"] for h in payload.get("hits", {}).get("hits", [])]
        except (OSError, json.JSONDecodeError, KeyError) as exc:
            # OSError covers URLError, socket timeouts, resets and truncated bodies.
            if attempt == retries:
                raise
            print(f"  page {page}: {exc} (retry {attempt}/{retries})", file=sys.stderr)
            time.sleep(2 * attempt)
    return []


def fetch_all(delay: float = 0.2) -> dict[str, dict]:
    games: dict[str, dict] = {}
    page = 0
    while True:
        hits = fetch_page(page)
        if not hits:
            break
        for src in hits:
            if src.get("bundle") == "game" and src.get("uuid"):
                games[src["uuid"]] = src
        print(f"  page {page}: {len(hits)} hits ({len(games)} games so far)")
        page += 1
        time.sleep(delay)
    return games


# HTTP statuses below 500 that are still worth retrying.
TRANSIENT_HTTP = {408, 429}


def fetch_detail(path: str, retries: int = 3) -> dict | None:
    """Extra fields only available on the JSON:API node (awards, ...).

    Returns NO_DETAIL when the node permanently has none (4xx), and None after a transient failure.

    None must never be stored: constellations are frozen, so a transient outage would become permanent.
    A node that exists but has no extra data returns empty awards and no genres/languages key, so the
    values coming from the search index are kept.
    """
    url = DETAIL.format(path=urllib.parse.quote(path, safe=""))
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/vnd.api+json"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.load(resp)
            items = payload.get("data") or []
            attrs = items[0].get("attributes", {}) if items else {}
            names = {}
            for inc in payload.get("included") or []:
                names.setdefault(inc.get("type"), []).append((inc.get("attributes") or {}).get("name"))
            extra = {
                "awards": [a for a in (attrs.get("awards") or []) if isinstance(a, str) and a.strip()],
                "completeness": attrs.get("completeness"),
            }
            genres = [n for n in names.get("taxonomy_term--genre", []) if n]
            languages = [n for n in names.get("taxonomy_term--language", []) if n]
            if genres:
                extra["genres"] = genres
            if languages:
                extra["languages"] = languages
            return extra
        except urllib.error.HTTPError as exc:
            # Most 4xx are permanent (unpublished, sensitive or moved node): there is no extra data, and
            # skipping the game would keep it out of the database forever. NO_DETAIL tells the caller.
            # 408 (timeout), 429 (rate limited) and 5xx are transient: retry, then give up for this run.
            if exc.code < 500 and exc.code not in TRANSIENT_HTTP:
                print(f"  detail {path}: HTTP {exc.code}, no detail data", file=sys.stderr)
                return NO_DETAIL
            if attempt == retries:
                print(f"  detail {path}: HTTP {exc.code} (giving up, retried next run)", file=sys.stderr)
                return None
            time.sleep(2 * attempt)
        except (OSError, json.JSONDecodeError, KeyError, IndexError) as exc:
            # OSError covers URLError, socket timeouts, resets and truncated bodies.
            if attempt == retries:
                print(f"  detail {path}: {exc} (giving up, retried next run)", file=sys.stderr)
                return None
            time.sleep(2 * attempt)
    return None


def fetch_details(paths: list[str]) -> dict[str, dict]:
    if not paths:
        return {}
    print(f"Fetching details for {len(paths)} games...")
    with ThreadPoolExecutor(max_workers=6) as pool:
        return dict(zip(paths, pool.map(fetch_detail, paths)))


def load_db() -> dict:
    if DATA_JSON.exists():
        with DATA_JSON.open(encoding="utf-8") as fh:
            return json.load(fh)
    return empty_db()


def save_db(db: dict) -> None:
    DATA_JSON.parent.mkdir(parents=True, exist_ok=True)
    # The header first, the records last: the file reads top-down.
    ordered = {key: db[key] for key in ("algorithm_version", "updated", "params", "games") if key in db}
    text = json.dumps(ordered, ensure_ascii=False, indent=1)
    DATA_JSON.write_text(text + "\n", encoding="utf-8")


def stamp_and_save(db: dict) -> None:
    db["updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    save_db(db)
    print(f"Wrote {DATA_JSON.relative_to(ROOT)} ({len(db['games'])} games).")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh-meta", action="store_true", help="update descriptive fields of known games")
    ap.add_argument("--rebuild", action="store_true", help="recompute all constellations from scratch")
    ap.add_argument("--dry-run", action="store_true", help="do not write files")
    ap.add_argument("--relayout", action="store_true", help="recompute all constellations from the local database, no network")
    args = ap.parse_args()

    if args.relayout:
        db = relayout(load_db())
        print(f"Recomputed {len(db['games'])} constellations (algorithm v{ALGORITHM_VERSION}).")
        if not args.dry_run:
            stamp_and_save(db)
        return 0

    print("Fetching games from the Swiss Games Garden API...")
    remote = fetch_all()
    print(f"Fetched {len(remote)} games.")

    db = empty_db() if args.rebuild else load_db()
    db, report = merge(db, remote, fetch_details, refresh_meta=args.refresh_meta)

    print(f"New games: {len(report.added)}" + (f", refreshed: {report.refreshed}" if args.refresh_meta else "")
          + (f", skipped after a failed detail request: {report.skipped}" if report.skipped else ""))
    for g in report.added[:50]:
        print(f"  + {g['year'] or 'TBA'}  {g['title']}")
    if len(report.added) > 50:
        print(f"  ... and {len(report.added) - 50} more")

    if args.dry_run:
        return 0
    if report.changed or args.rebuild:
        stamp_and_save(db)
    else:
        print("Nothing to write.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
