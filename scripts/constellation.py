"""
Constellation algorithm for the Swiss Games Universe.

One game = one constellation. This module is the ONLY place where the shape of a
constellation is decided. Everything it returns is stored in data/games.json the
first time a game is seen and is never recomputed afterwards (unless you run the
fetcher with --rebuild). Keep this module pure: same input => same output.

The algorithm is described in docs/CONSTELLATION.md. Keep both in sync.

Tunable values live in CONFIG, and only there: the database keeps the CONFIG of every algorithm
version that built a constellation (see docs/adr/0001), so the viewer can explain any figure with
the numbers that made it. Rules live in small functions you can swap:

    anchor()      where the constellation sits in the sky of its year
    stars()       one star per thing attached to the game (platforms, studios, people, stores, awards)
    layout()      how the stars hang together: platforms chained in time, the rest branching off
    shine()       how bright the constellation glows (by awards)
    near()        how close to your ship it flies (by completeness of its record)
"""

from __future__ import annotations

import hashlib
import math
from datetime import date

# Bump on every change that alters the output for the same input. Stored records keep the version
# they were built with ("v"), so the database can hold several.
#   3  one star per entity, tree layout
#   4  anchor spacing treats cy as an angle (0.99 and 0.01 are neighbours)
ALGORITHM_VERSION = 4

CONFIG = {
    # Sky of one year: normalized anchor coordinates are in [0, 1].
    "anchor_candidates": 5,       # best-candidate sampling: more => more evenly spread, fewer => clumps and voids
    "anchor_margin": 0.06,        # keep anchors away from the sky borders
    "month_jitter": 0.05,         # cx wobble around the release month
    "canton_sectors": False,      # True = each canton owns a slice of the sky around the ship; False = free angle
    "canton_jitter": 0.6,         # cy wobble inside the canton's sector, as a fraction of the sector
    # Figure (units are "sky units"; the renderer scales them).
    "max_platforms": 8,
    "max_people": 6,
    "max_stores": 4,
    "max_awards": 5,
    "step_min": 16.0,             # platform chain: distance for two releases the same day
    "step_max": 64.0,             # platform chain: distance for releases years apart
    "step_days_full": 1460.0,     # 4 years => step_max
    "turn_max_deg": 110.0,        # max heading change between two chain segments
    "studio_len": 24.0,           # studio star distance from the main star
    "person_len": 13.0,           # person star distance from its studio (or the main star)
    "store_len": 9.0,             # store star distance from its platform star
    "award_len": 30.0,            # award star distance from the main star
    "main_radius_min": 2.4,       # main star radius = min + per_credit * sqrt(people + studios), capped at max
    "main_radius_per_credit": 0.6,
    "main_radius_max": 6.0,
    "platform_radius": {          # platform stars: radius by family
        "console": 2.2,
        "pc": 1.9,
        "mobile": 1.6,
        "vr": 1.8,
        "browser": 1.3,
        "retro": 2.0,
        "other": 1.4,
    },
    "studio_radius": 2.0,
    "person_radius": 1.2,
    "store_radius": 0.9,
    "award_radius": 1.7,
    # Twinkle
    "twinkle_rate_min": 0.4,      # cycles / second
    "twinkle_rate_max": 1.6,
    # Shine
    "shine_base": 1.0,            # glow of a game without award
    "shine_per_award": 0.5,       # glow boost per award won
    "shine_max": 3.0,
    # Near: completeness of the archive record => distance from the ship (1 = closest)
    "completeness_full": 8700.0,
}

# Cantons own a sector of the sky around the ship, laid out roughly west -> east.
# The weight is the canton's share of the sky: proportional to its number of games
# in the archive (snapshot of October 2026), so Zürich is not squeezed into 1/25th.
# Edit freely; existing constellations keep their stored position.
CANTON_SECTORS = [
    ("Geneva", 81), ("Vaud", 208), ("Valais", 26), ("Neuchâtel", 11), ("Fribourg", 49), ("Jura", 2),
    ("Bern", 48), ("Solothurn", 3), ("Basel-Stadt", 16), ("Basel-Landschaft", 3), ("Aargau", 37),
    ("Luzern", 30), ("Obwalden", 2), ("Nidwalden", 2), ("Uri", 2), ("Schwyz", 2), ("Zug", 4),
    ("Zürich", 370), ("Schaffhausen", 4), ("Thurgau", 5), ("St. Gallen", 12), ("Appenzell", 12),
    ("Glarus", 2), ("Graubünden", 22), ("Ticino", 19),
]

PLATFORM_FAMILY = {
    "console": {"switch", "switch 2", "ps3", "ps4", "ps5", "ps_vita", "xbox360", "xbox_one",
                "xbox series x|s", "wii", "wii_u", "game cube", "3ds", "playdate", "psmobile",
                "game-boy-color", "sega mega drive", "vectrex", "arduboy", "atari-vcs"},
    "pc": {"windows", "mac_os", "linux", "dos", "mac_os_classic", "windows_7_touch_table"},
    "mobile": {"ios", "android", "iphone", "ipad", "windows_phone", "mobile_phone", "smartphone",
               "tablets", "j2me", "android_tv", "android_real_toys", "airconsole"},
    "vr": {"windows_vr", "gear_vr", "oculus_quest", "oculus_rift", "oculus_go", "htc_vive",
           "vive_index", "meta quest 3"},
    "browser": {"browser", "flash", "java", "facebook", "half-life_mod", "vms_vax_telnet_online"},
    "retro": {"smaky", "amiga", "c64", "atari_st", "zx_spectrum", "amstrad cpc", "apple iigs",
              "atari-8-bit", "acorn_archimedes", "zx81", "apple ii", "cdc_1604", "intel-8085",
              "ti_99"},
}


# --------------------------------------------------------------------------- #
# Deterministic randomness
# --------------------------------------------------------------------------- #

class Rng:
    """mulberry32: tiny seeded PRNG, trivial to port to JS if ever needed."""

    def __init__(self, seed: int):
        self.a = seed & 0xFFFFFFFF

    def next(self) -> float:
        self.a = (self.a + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    def between(self, lo: float, hi: float) -> float:
        return lo + (hi - lo) * self.next()


def seed_from(text: str) -> int:
    return int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)


# --------------------------------------------------------------------------- #
# Helpers on the raw API record
# --------------------------------------------------------------------------- #

def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def platform_family(slug: str | None) -> str:
    s = (slug or "").strip().lower()
    for family, members in PLATFORM_FAMILY.items():
        if s in members:
            return family
    return "other"


def ordered_releases(game: dict) -> list[dict]:
    """Unique (date, platform) releases, oldest first; undated releases last."""
    seen = set()
    out = []
    for r in game.get("releases") or []:
        key = (r.get("date"), r.get("platform_slug"))
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    out.sort(key=lambda r: (parse_date(r.get("date")) is None,
                            parse_date(r.get("date")) or date.max,
                            (r.get("platform_name") or "").lower()))
    return out


def first_release(game: dict) -> dict | None:
    rels = ordered_releases(game)
    dated = [r for r in rels if parse_date(r.get("date"))]
    return dated[0] if dated else (rels[0] if rels else None)


def release_year(game: dict) -> int | None:
    years = [y.get("year") for y in game.get("releases_years") or [] if y.get("year")]
    if years:
        return int(min(years))
    fr = first_release(game)
    d = parse_date(fr.get("date")) if fr else None
    return d.year if d else None


# --------------------------------------------------------------------------- #
# Rules
# --------------------------------------------------------------------------- #

def canton_sector(game: dict) -> tuple[float, float] | None:
    """[lo, hi] band of cy owned by the game's first canton, or None when unknown/foreign."""
    names = [c.get("name") for c in game.get("cantons") or [] if c.get("name")]
    index = {name: i for i, (name, _) in enumerate(CANTON_SECTORS)}
    if not names or names[0] not in index:
        return None
    total = sum(w for _, w in CANTON_SECTORS)
    start = sum(w for _, w in CANTON_SECTORS[: index[names[0]]])
    width = CANTON_SECTORS[index[names[0]]][1]
    return (start / total, (start + width) / total)


def angular_gap(a: float, b: float) -> float:
    """Distance between two cy values: cy is an angle around the ship, so 0.99 and 0.01 are neighbours."""
    d = abs(a - b) % 1.0
    return min(d, 1.0 - d)


def anchor(game: dict, rng: Rng, existing_anchors: list[tuple[float, float]]) -> tuple[float, float]:
    """
    Where the constellation sits inside the sky of its year (normalized 0..1).

    cx  = position in the year (release month). A release on January 1st is
          treated as "month unknown" because the archive uses it as a placeholder,
          and gets a free position instead.
    cy  = free (seeded). Optionally (CONFIG["canton_sectors"]) the canton's sector
          of the sky, with a seeded wobble inside the slice.
    Both are chosen with Mitchell's best-candidate: among N seeded candidates we
    keep the one farthest from constellations already placed in that year, so the
    sky stays evenly filled while old constellations never move.
    """
    m = CONFIG["anchor_margin"]
    fr = first_release(game)
    d = parse_date(fr.get("date")) if fr else None
    month_known = d is not None and not (d.month == 1 and d.day == 1)
    base_cx = None
    if month_known:
        doy = d.timetuple().tm_yday / 366.0
        base_cx = m + doy * (1 - 2 * m)
    sector = canton_sector(game)

    best, best_score = None, -1.0
    for _ in range(CONFIG["anchor_candidates"]):
        if base_cx is None:
            cx = rng.between(m, 1 - m)
        else:
            cx = min(1 - m, max(m, base_cx + rng.between(-1, 1) * CONFIG["month_jitter"]))
        if sector is None or not CONFIG["canton_sectors"]:
            cy = rng.between(0, 1)
        else:
            lo, hi = sector
            mid, half = (lo + hi) / 2, (hi - lo) / 2
            cy = (mid + rng.between(-1, 1) * half * CONFIG["canton_jitter"]) % 1.0
        score = min((math.hypot(cx - ex, angular_gap(cy, ey)) for ex, ey in existing_anchors), default=1.0)
        if score > best_score:
            best, best_score = (cx, cy), score
    return best


def shine(game: dict) -> float:
    """
    Every constellation has the same tint. Awards make it glow brighter:
    1.0 = no award, +0.5 per award, capped.
    """
    awards = game.get("awards") or []
    return round(min(CONFIG["shine_max"], CONFIG["shine_base"] + CONFIG["shine_per_award"] * len(awards)), 2)


def near(game: dict) -> float:
    """
    How close the constellation flies to your ship, 0 (far) .. 1 (close):
    the completeness score of the game's record in the archive.
    Unknown completeness => 0.35.
    """
    c = game.get("completeness")
    if c is None:
        return 0.35
    return round(max(0.0, min(1.0, float(c) / CONFIG["completeness_full"])), 3)


def stars(game: dict, rng: Rng) -> list[dict]:
    """
    One star per thing attached to the game, each knowing its parent:
      game      the main star (index 0), sized by the credits
      platform  one per platform, chained in release order (parent = previous platform, or the game)
      studio    one per studio, hanging from the game
      person    one per person, hanging from the first studio (or the game)
      store     one per store, hanging from a platform star (spread over the platforms)
      award     one per award, hanging from the game
    """
    def twinkle():
        return {"phase": round(rng.between(0, 2 * math.pi), 3),
                "rate": round(rng.between(CONFIG["twinkle_rate_min"], CONFIG["twinkle_rate_max"]), 3)}

    people = list(dict.fromkeys(p.get("fullname") for p in game.get("people") or [] if p.get("fullname")))
    studios = list(dict.fromkeys(s.get("name") for s in game.get("studios") or [] if s.get("name")))
    credits = len(people) + len(studios)
    out = [{
        "kind": "game", "label": game.get("title"), "parent": None, "main": True,
        "r": round(min(CONFIG["main_radius_max"],
                       CONFIG["main_radius_min"] + CONFIG["main_radius_per_credit"] * math.sqrt(credits)), 2),
        "twinkle": twinkle(),
    }]

    # platforms, chained in release order
    rels = ordered_releases(game)[: CONFIG["max_platforms"]]
    prev = 0
    for r in rels:
        fam = platform_family(r.get("platform_slug"))
        out.append({
            "kind": "platform", "label": r.get("platform_name") or "Unknown platform", "family": fam,
            "date": r.get("date"), "state": r.get("state") or "released", "parent": prev,
            "r": CONFIG["platform_radius"][fam], "twinkle": twinkle(),
        })
        prev = len(out) - 1
    platform_idx = [i for i, s in enumerate(out) if s["kind"] == "platform"]

    # studios, then people
    first_studio = None
    for name in studios:
        out.append({"kind": "studio", "label": name, "parent": 0, "r": CONFIG["studio_radius"], "twinkle": twinkle()})
        if first_studio is None:
            first_studio = len(out) - 1
    for name in people[: CONFIG["max_people"]]:
        out.append({"kind": "person", "label": name, "parent": first_studio if first_studio is not None else 0,
                    "r": CONFIG["person_radius"], "twinkle": twinkle()})

    # stores, spread over the platform stars
    stores = list(dict.fromkeys(s.get("slug") for s in game.get("stores") or [] if s.get("slug")))
    for k, slug in enumerate(stores[: CONFIG["max_stores"]]):
        parent = platform_idx[k % len(platform_idx)] if platform_idx else 0
        out.append({"kind": "store", "label": slug.replace("_", " "), "parent": parent, "r": CONFIG["store_radius"], "twinkle": twinkle()})

    # awards
    for name in (game.get("awards") or [])[: CONFIG["max_awards"]]:
        out.append({"kind": "award", "label": name, "parent": 0, "r": CONFIG["award_radius"], "twinkle": twinkle()})
    return out


def layout(star_list: list[dict], rng: Rng) -> None:
    """
    Hang the stars together. The main star is at the origin.
      platforms  chained like a chart line: each segment's length grows with the time
                 gap since the previous release (16 units same day .. 64 units 4+ years),
                 the heading turns by a seeded angle at every step
      studios    branch off the main star, away from the chain, at studio_len
      people     fan out around their studio (or the main star) at person_len
      stores     short twigs on their platform star
      awards     long rays from the main star, spread on the side opposite the chain
    Mutates the star dicts (adds x, y), then re-centres the figure on its centroid.
    """
    star_list[0]["x"], star_list[0]["y"] = 0.0, 0.0
    chain_heading = rng.between(0, 2 * math.pi)
    heading = chain_heading
    prev_date = None
    children = {}
    for i, s in enumerate(star_list):
        if s["parent"] is not None:
            children.setdefault(s["parent"], []).append(i)

    # platforms: the chain
    for i, s in enumerate(star_list):
        if s["kind"] != "platform":
            continue
        p = star_list[s["parent"]]
        d = parse_date(s.get("date"))
        if p["kind"] == "game":
            step = CONFIG["step_min"]
        else:
            gap_days = abs((d - prev_date).days) if (d and prev_date) else CONFIG["step_days_full"] / 2
            t = min(1.0, math.log1p(gap_days) / math.log1p(CONFIG["step_days_full"]))
            step = CONFIG["step_min"] + (CONFIG["step_max"] - CONFIG["step_min"]) * t
            heading += math.radians(CONFIG["turn_max_deg"]) * rng.between(-1, 1)
        s["x"] = round(p["x"] + math.cos(heading) * step, 2)
        s["y"] = round(p["y"] + math.sin(heading) * step, 2)
        prev_date = d or prev_date

    # studios: away from the chain
    studio_idx = [i for i, s in enumerate(star_list) if s["kind"] == "studio"]
    for k, i in enumerate(studio_idx):
        ang = chain_heading + math.pi + (k - (len(studio_idx) - 1) / 2) * 0.8 + rng.between(-0.3, 0.3)
        star_list[i]["x"] = round(math.cos(ang) * CONFIG["studio_len"], 2)
        star_list[i]["y"] = round(math.sin(ang) * CONFIG["studio_len"], 2)

    # people: fan around their parent
    for parent, kids in children.items():
        persons = [i for i in kids if star_list[i]["kind"] == "person"]
        if not persons:
            continue
        p = star_list[parent]
        base = math.atan2(p["y"], p["x"]) if parent != 0 else chain_heading + math.pi   # point outward
        spread = min(math.pi * 1.2, 0.55 * len(persons))
        for k, i in enumerate(persons):
            ang = base + (k - (len(persons) - 1) / 2) * (spread / max(1, len(persons) - 1) if len(persons) > 1 else 0) + rng.between(-0.15, 0.15)
            star_list[i]["x"] = round(p["x"] + math.cos(ang) * CONFIG["person_len"], 2)
            star_list[i]["y"] = round(p["y"] + math.sin(ang) * CONFIG["person_len"], 2)

    # stores: twigs on platforms
    for i, s in enumerate(star_list):
        if s["kind"] != "store":
            continue
        p = star_list[s["parent"]]
        ang = rng.between(0, 2 * math.pi)
        s["x"] = round(p["x"] + math.cos(ang) * CONFIG["store_len"], 2)
        s["y"] = round(p["y"] + math.sin(ang) * CONFIG["store_len"], 2)

    # awards: rays opposite the chain, between the studios
    award_idx = [i for i, s in enumerate(star_list) if s["kind"] == "award"]
    for k, i in enumerate(award_idx):
        ang = chain_heading + math.pi / 2 + (k - (len(award_idx) - 1) / 2) * 0.5 + rng.between(-0.2, 0.2)
        if k % 2:
            ang += math.pi
        star_list[i]["x"] = round(math.cos(ang) * CONFIG["award_len"], 2)
        star_list[i]["y"] = round(math.sin(ang) * CONFIG["award_len"], 2)

    # re-centre on the centroid so the anchor is the visual middle
    cx = sum(s["x"] for s in star_list) / len(star_list)
    cy = sum(s["y"] for s in star_list) / len(star_list)
    for s in star_list:
        s["x"] = round(s["x"] - cx, 2)
        s["y"] = round(s["y"] - cy, 2)


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #

def build_constellation(game: dict, existing_anchors: list[tuple[float, float]]) -> dict:
    """
    game              : one `_source` record from /search/games, with an extra
                        `awards` list taken from the JSON:API detail (may be empty)
    existing_anchors  : (cx, cy) of constellations already placed in the same year
    """
    rng = Rng(seed_from(game["uuid"]))
    cx, cy = anchor(game, rng, existing_anchors)
    star_list = stars(game, rng)
    layout(star_list, rng)
    extent = max(math.hypot(s["x"], s["y"]) + s["r"] for s in star_list)
    return {
        "v": ALGORITHM_VERSION,
        "cx": round(cx, 4),
        "cy": round(cy, 4),
        "shine": shine(game),
        "near": near(game),
        "extent": round(extent, 2),
        "stars": star_list,
        "links": [[s["parent"], i] for i, s in enumerate(star_list) if s["parent"] is not None],
    }
