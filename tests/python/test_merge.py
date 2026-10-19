"""Tests of the merge policy (scripts/merge.py), with in-memory API games and details: no network."""

from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from constellation import ALGORITHM_VERSION, CONFIG  # noqa: E402
from merge import NO_DETAIL, empty_db, merge, relayout  # noqa: E402


def source(uuid: str, game_id: int, year: int | None, **extra) -> dict:
    """One game as the search API returns it."""
    date = f"{year}-05-12" if year else None
    src = {
        "uuid": uuid,
        "id": str(game_id),
        "title": f"Game {uuid}",
        "path": f"/games/{uuid}",
        "releases": [{"date": date, "platform_name": "PC", "platform_slug": "pc", "state": "released"},
                     {"date": f"{year + 1}-01-20" if year else None, "platform_name": "Switch",
                      "platform_slug": "switch", "state": "released"}],
        "releases_years": [{"year": year}] if year else [],
        "studios": [{"name": f"Studio {uuid}"}],
        "people": [{"fullname": f"Person {uuid}"}],
        "cantons": [{"name": "Vaud"}],
        "stores": [{"slug": "steam"}],
    }
    src.update(extra)
    return src


REMOTE = {src["uuid"]: src for src in [
    source("alpha", 1, 2019),
    source("beta", 2, 2019),
    source("gamma", 3, 2020),
    source("delta", 4, None),
]}

AWARDS = {"awards": ["Swiss Game Award"], "completeness": 4000}


class FakeDetails:
    """The details adapter: answers from a dict, records which paths were asked for."""

    def __init__(self, answers: dict | None = None, default: dict | None = AWARDS):
        self.answers = answers or {}
        self.default = default
        self.asked: list[str] = []

    def __call__(self, paths: list[str]) -> dict:
        self.asked += paths
        return {path: self.answers.get(path, copy.deepcopy(self.default)) for path in paths}


def by_uuid(db: dict) -> dict:
    return {g["uuid"]: g for g in db["games"]}


def anchor(record: dict) -> tuple:
    return record["constellation"]["cx"], record["constellation"]["cy"]


class MergeTest(unittest.TestCase):
    def setUp(self):
        self.db, self.report = merge(empty_db(), REMOTE, FakeDetails())

    def test_adds_new_games_with_their_details(self):
        self.assertEqual(len(self.report.added), 4)
        self.assertEqual(by_uuid(self.db)["alpha"]["awards"], ["Swiss Game Award"])
        self.assertEqual(by_uuid(self.db)["delta"]["year"], None)

    def test_skips_a_game_whose_details_failed(self):
        db, report = merge(empty_db(), REMOTE, FakeDetails({"/games/beta": None}))
        self.assertNotIn("beta", by_uuid(db))
        self.assertEqual(report.skipped, 1)
        self.assertEqual(len(report.added), 3)

    def test_stores_a_new_game_without_detail_page_with_no_awards(self):
        db, _ = merge(empty_db(), REMOTE, FakeDetails({"/games/beta": NO_DETAIL}))
        self.assertEqual(by_uuid(db)["beta"]["awards"], [])
        self.assertEqual(by_uuid(db)["beta"]["completeness"], None)

    def test_leaves_a_known_game_alone_when_its_detail_page_is_gone(self):
        db, report = merge(self.db, REMOTE, FakeDetails({"/games/alpha": NO_DETAIL}), refresh_meta=True)
        self.assertEqual(by_uuid(db)["alpha"], by_uuid(self.db)["alpha"])
        self.assertEqual(report.refreshed, 3)

    def test_refresh_keeps_the_anchor_and_rebuilds_the_stars(self):
        remote = copy.deepcopy(REMOTE)
        remote["alpha"]["people"].append({"fullname": "Someone New"})
        db, _ = merge(self.db, remote, FakeDetails(), refresh_meta=True)
        before, after = by_uuid(self.db)["alpha"], by_uuid(db)["alpha"]
        self.assertEqual(anchor(after), anchor(before))
        self.assertEqual(len(after["constellation"]["stars"]), len(before["constellation"]["stars"]) + 1)

    def test_a_new_year_moves_the_game_and_frees_its_old_spot(self):
        remote = copy.deepcopy(REMOTE)
        remote["alpha"]["releases_years"] = [{"year": 2018}]
        # Newcomers in 2019, placed after the move (later year), see only beta there, not alpha's old anchor.
        newcomers = {f"new{i}": source(f"new{i}", 10 + i, 2019) for i in range(6)}
        db, _ = merge(self.db, {**remote, **newcomers}, FakeDetails(), refresh_meta=True)
        self.assertEqual(by_uuid(db)["alpha"]["year"], 2018)

        without_alpha = copy.deepcopy(self.db)
        without_alpha["games"] = [g for g in without_alpha["games"] if g["uuid"] != "alpha"]
        alone, _ = merge(without_alpha, newcomers, FakeDetails())
        self.assertEqual([anchor(by_uuid(db)[uuid]) for uuid in newcomers],
                         [anchor(by_uuid(alone)[uuid]) for uuid in newcomers])

    def test_a_second_run_changes_nothing(self):
        details = FakeDetails()
        db, report = merge(self.db, REMOTE, details)
        self.assertEqual(db, self.db)
        self.assertFalse(report.changed)
        self.assertEqual(details.asked, [])

    def test_does_not_touch_its_inputs(self):
        db, remote = copy.deepcopy(self.db), copy.deepcopy(REMOTE)
        merge(db, remote, FakeDetails(), refresh_meta=True)
        self.assertEqual(db, self.db)
        self.assertEqual(remote, REMOTE)

    def test_a_rebuild_is_reproducible(self):
        again, _ = merge(empty_db(), REMOTE, FakeDetails())
        self.assertEqual(json.dumps(again), json.dumps(self.db))

    def test_records_the_parameters_of_the_algorithm_version(self):
        self.assertEqual(self.db["params"][str(ALGORITHM_VERSION)], CONFIG)
        self.assertEqual(self.db["algorithm_version"], ALGORITHM_VERSION)

    def test_never_overwrites_the_parameters_of_a_version(self):
        db = copy.deepcopy(self.db)
        db["params"][str(ALGORITHM_VERSION)] = {"main_radius_min": 99}
        db["params"]["1"] = {"main_radius_min": 1}
        merged, _ = merge(db, {**REMOTE, "epsilon": source("epsilon", 5, 2021)}, FakeDetails())
        self.assertEqual(merged["params"][str(ALGORITHM_VERSION)], {"main_radius_min": 99})
        self.assertEqual(merged["algorithm_version"], ALGORITHM_VERSION)

    def test_a_relayout_of_a_fresh_database_changes_nothing(self):
        # Guards the round trip between metadata() and record_to_source(): if they drift, a relayout
        # would quietly build different constellations.
        self.assertEqual(relayout(self.db), self.db)


if __name__ == "__main__":
    unittest.main()
