"""
Merging the games of the Swiss Games Garden API into the database.

This module decides which games are added, refreshed or skipped, where their constellations sit,
and which algorithm parameters the database records. It is pure: no network, no files, no clock.
fetch_games.py is the adapter that brings the API in and writes the result out.

Constellations are frozen: once stored, a game keeps its figure and its anchor. The rules below
exist to never freeze a wrong one (a failed detail request) and to never move a stored one.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Callable

from constellation import ALGORITHM_VERSION, CONFIG, build_constellation, first_release, release_year

SITE = "https://swissgames.garden"

# What a details() adapter returns for a node that permanently has no detail data (a 4xx such as 404 or
# 403). Compared by identity: a node with no extra data returns its own (non-empty) dict.
NO_DETAIL: dict = {}

# details(paths) -> {path: extra fields | None after a transient failure | NO_DETAIL}
Details = Callable[[list[str]], dict[str, dict | None]]


def empty_db() -> dict:
    return {"algorithm_version": ALGORITHM_VERSION, "updated": None, "params": {}, "games": []}


# --------------------------------------------------------------------------- #
# Records: the stored form of an API game
# --------------------------------------------------------------------------- #

def cover_of(src: dict) -> dict | None:
    medias = src.get("medias") or []
    if not medias:
        return None
    links = medias[0].get("links") or {}
    return {
        "thumb": (links.get("3x2_330x220") or {}).get("href"),
        "large": (links.get("3x2_660x440") or {}).get("href"),
        "placeholder": (links.get("placeholder_30x30") or {}).get("href"),
    }


def metadata(src: dict) -> dict:
    """Mutable, descriptive part of a record (no constellation values here)."""
    fr = first_release(src)
    return {
        "id": src.get("id"),
        "title": src.get("title"),
        "path": src.get("path"),
        "url": SITE + (src.get("path") or ""),
        "year": release_year(src),
        "first_release": {
            "date": fr.get("date") if fr else None,
            "platform": fr.get("platform_name") if fr else None,
            "state": fr.get("state") if fr else None,
        },
        "cover": cover_of(src),
        "releases": [
            {"date": r.get("date"), "platform": r.get("platform_name"),
             "slug": r.get("platform_slug"), "state": r.get("state")}
            for r in src.get("releases") or []
        ],
        "studios": [s.get("name") for s in src.get("studios") or [] if s.get("name")],
        "people": [p.get("fullname") for p in src.get("people") or [] if p.get("fullname")],
        "cantons": [c.get("name") for c in src.get("cantons") or [] if c.get("name")],
        "locations": [l.get("name") for l in src.get("locations") or [] if l.get("name")],
        "stores": [s.get("slug") for s in src.get("stores") or [] if s.get("slug")],
        "players": src.get("players"),
        "is_sensitive": bool(src.get("is_sensitive")),
        "awards": src.get("awards") or [],
        "genres": src.get("genres") or [],
        "languages": src.get("languages") or [],
        "completeness": src.get("completeness"),
    }


def record_to_source(g: dict) -> dict:
    """Rebuild the API-like input of build_constellation() from a stored record."""
    return {
        "uuid": g["uuid"], "title": g.get("title"), "path": g.get("path"),
        "releases": [{"date": r.get("date"), "platform_name": r.get("platform"), "platform_slug": r.get("slug"), "state": r.get("state")}
                     for r in g.get("releases") or []],
        "releases_years": [{"year": g["year"]}] if g.get("year") is not None else [],
        "people": [{"fullname": p} for p in g.get("people") or []],
        "studios": [{"name": s} for s in g.get("studios") or []],
        "cantons": [{"name": c} for c in g.get("cantons") or []],
        "stores": [{"slug": s} for s in g.get("stores") or []],
        "awards": g.get("awards") or [],
        "completeness": g.get("completeness"),
    }


def record_order(g: dict) -> tuple:
    """Order of the records in the database: by year then uuid, unknown years last."""
    return (g["year"] if g["year"] is not None else 9999, g["uuid"])


# --------------------------------------------------------------------------- #
# Occupancy: the anchors already taken in each band
# --------------------------------------------------------------------------- #

class Occupancy:
    """The anchors already taken in each band (one band per year), which a new constellation keeps its distance from."""

    def __init__(self, records: list[dict] = ()):
        self._by_year: dict = {}
        for g in records:
            self.take(g["year"], (g["constellation"]["cx"], g["constellation"]["cy"]))

    def taken(self, year) -> list[tuple[float, float]]:
        return self._by_year.get(year, [])

    def take(self, year, anchor: tuple[float, float]) -> None:
        self._by_year.setdefault(year, []).append(anchor)

    def release(self, year, anchor: tuple[float, float]) -> None:
        self._by_year[year].remove(anchor)

    def place(self, src: dict, year) -> dict:
        """Builds a new constellation at a free anchor of its band, and takes that anchor."""
        constellation = build_constellation(src, self.taken(year))
        self.take(year, (constellation["cx"], constellation["cy"]))
        return constellation


# --------------------------------------------------------------------------- #
# Merge, relayout
# --------------------------------------------------------------------------- #

@dataclass
class Report:
    added: list[dict] = field(default_factory=list)
    refreshed: int = 0
    skipped: int = 0

    @property
    def changed(self) -> bool:
        return bool(self.added or self.refreshed)


def record_parameters(db: dict) -> None:
    """Records the parameters of the current algorithm version, once (they are history, never overwritten)."""
    params = db.setdefault("params", {})
    params.setdefault(str(ALGORITHM_VERSION), copy.deepcopy(CONFIG))
    db["algorithm_version"] = max(int(version) for version in params)


def refresh(record: dict, src: dict, occupancy: Occupancy) -> None:
    """Refreshes a known game's metadata and rebuilds its figure from it, keeping its place in the band.

    The stars must follow the metadata (otherwise the pills and the explainer contradict the figure),
    but the anchor stays: the game does not move. Only a changed release year moves it, to a free spot
    in its new band, since it has to change band anyway; its old spot is freed.
    """
    old = record["constellation"]
    old_year = record["year"]
    record.update(metadata(src))
    if record["year"] == old_year:
        fresh = build_constellation(src, [])
        fresh["cx"], fresh["cy"] = old["cx"], old["cy"]
    else:
        occupancy.release(old_year, (old["cx"], old["cy"]))
        fresh = occupancy.place(src, record["year"])
    record["constellation"] = fresh


def merge(db: dict, remote: dict[str, dict], details: Details, refresh_meta: bool = False) -> tuple[dict, Report]:
    """Merges the API games (`remote`, by uuid) into a copy of `db`.

    New games get a constellation; known games are left untouched, or refreshed with `refresh_meta`.
    `details` fetches the extra fields (awards, ...) of the games about to be written.
    """
    db = copy.deepcopy(db)
    sources = {uuid: dict(src) for uuid, src in remote.items()}
    known = {g["uuid"]: g for g in db["games"]}
    occupancy = Occupancy(db["games"])

    # Details for the games we are going to write. A game whose detail request failed is skipped for
    # this run: storing it without its awards would freeze a wrong constellation.
    source_by_path = {src["path"]: src for src in sources.values() if src.get("path")}
    need = [src["path"] for uuid, src in sources.items() if (uuid not in known or refresh_meta) and src.get("path")]
    failed: set[str] = set()
    no_detail: set[str] = set()
    for path, extra in details(need).items():
        if extra is None:
            failed.add(path)
        elif extra is NO_DETAIL:
            no_detail.add(path)
            source_by_path[path].update({"awards": [], "completeness": None})
        else:
            source_by_path[path].update(extra)

    report = Report()
    # Stable insertion order: by year then id, so a rebuild is reproducible.
    for uuid, src in sorted(sources.items(), key=lambda kv: (release_year(kv[1]) or 9999, int(kv[1].get("id") or 0))):
        if src.get("path") in failed:
            report.skipped += 1
            continue
        if uuid in known:
            # A node that lost its detail page (4xx) keeps what we stored: refreshing would wipe its awards.
            if refresh_meta and src.get("path") not in no_detail:
                refresh(known[uuid], src, occupancy)
                report.refreshed += 1
            continue
        meta = metadata(src)
        record = {"uuid": uuid, **meta, "constellation": occupancy.place(src, meta["year"])}
        db["games"].append(record)
        known[uuid] = record
        report.added.append(record)

    if report.changed:
        record_parameters(db)
    db["games"].sort(key=record_order)
    return db, report


def relayout(db: dict) -> dict:
    """Recomputes every constellation of a copy of `db` from its stored records (after changing the algorithm)."""
    db = copy.deepcopy(db)
    occupancy = Occupancy()
    for g in sorted(db["games"], key=lambda g: (g["year"] if g["year"] is not None else 9999, int(g.get("id") or 0))):
        g["constellation"] = occupancy.place(record_to_source(g), g["year"])
    record_parameters(db)
    db["games"].sort(key=record_order)
    return db
