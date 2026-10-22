# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- feat: the Deploy workflow runs after each release instead of on every push, so the site shows the new version
- refactor: the "Build & Test" workflow lives in `.github/workflows/test.yml`
- feat: the weekly data update adds its line under "Unreleased" in `CHANGELOG.md` (chan) and releases the new games
- feat: the "?" of the top bar shares a pill with a GitHub link that shows the site version
- feat: opening a game adds a history entry, so the back button closes it
- feat: `data/games.json` keeps the algorithm parameters of every version (`params`)
- refactor: `data/games.js` is gone, the modules import `data/games.json` directly
- feat: intro sequence on the home (logo, then the sky, then the UI sliding in)
- feat: game detail reworked for mobile (figure on top, text sheet below, full-screen explainer), "Why this constellation?" pill next to the figure, pills truncated with an ellipsis
- feat: detail subtitle by release state (released / under development / prototype / canceled)
- fix: phone tilt no longer jumps when held upright (full 3D rotation, smoothed)
- fix: closing a game flies back along the exact same path; the figure keeps its size while the mobile browser bar collapses
- fix: search ranks titles with a word starting with the query before plain substring matches
- fix: the weekly data update now triggers the Deploy workflow
- fix: a game whose detail request fails is skipped for the run instead of being frozen without its awards; socket timeouts are retried
- fix: `--refresh-meta` rebuilds the figure of a known game from its new data, keeping its place in the sky
- fix: anchor spacing treats the angle around the ship as circular (0.99 and 0.01 are neighbours): algorithm version 4
- fix: a detail page answering 4xx no longer keeps a game out of the database
- fix: the brand link flies back to the home year when no game is open
- fix: viewer: rail keeps its active year after a resize, the brand link closes an open game, a desktop resize re-frames the open game, the explainer mentions the main-star radius cap
- perf: star halos are stamped from one pre-drawn sprite; the focus camera is solved once per opening

### Added
- feat: GitHub Action "Release": every push to `main` with entries under "Unreleased" bumps the version (`VERSION.md`, from the entries: `scripts/release.ts`), moves them under that version with chan, tags and publishes a GitHub release
- feat: sharing image (`public/og-image.png`, drawn from real constellations by `scripts/og-image.html`, `bun run og-image`), favicon (SVG, ICO, Apple touch icon)
- feat: SEO: descriptive title and description, canonical URL, Open Graph and X cards, theme colour, JSON-LD, `robots.txt` and `sitemap.xml`, a `<noscript>` text; the tab title names the open game; the overlays use `h2` so the page keeps one `h1`
- feat: on phones, tilting the device looks around like the mouse does
- feat: on phones, pinching flies forward (fingers apart) or back (fingers together), like scrolling
- feat: a card in the middle of the home shows how to move and look around (pinch and tilt on phones, scroll and mouse on desktop) when the visitor has not moved a few seconds after the page loads (on every load)
- feat: the "?" legend gives touch instructions on phones (swipe or pinch, tilt, tap)
- feat: on phones, a compass (bottom right) shows straight ahead; tapping it recentres the tilt (on iOS, it first asks for motion access)
- feat: no pinch or double-tap zoom on mobile
- feat: Google Analytics (gtag.js, `G-KRMXW382FF`) in the page head
- feat: proof of concept of the Swiss Games Universe: every Swiss video game as a constellation in a 3D tunnel of time
- feat: perspective camera on a 2D canvas, scroll to fly through the years, mouse look-around, one faded year label at a time
- feat: search bar on the home (game name, first release date), deep links (`#slug`), year rail and keyboard shortcuts
- feat: home starts ten years before the current year
  feat: constellation algorithm (`scripts/constellation.py`)
- feat: database builder (`scripts/fetch_games.py`): crawls the public search API and the JSON:API detail, appends new games only, writes `data/games.json` and `data/games.js`.
- feat: weekly GitHub Action that commits new games.
- feat: bun dev server and build scripts.
- Biome (lint + format), Vitest tests (modules + `data/games.json` validation), GitHub Actions "Linting" and "Build & Test"
- GitHub Action "Deploy": every push to `main` builds the site and publishes it to GitHub Pages (custom domain via `dist/CNAME`)
- `.editorconfig`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `CONTRIBUTING.md`, MIT `LICENSE`
