# Contributing

Thanks for taking the time to contribute. Please note we have a
[code of conduct](CODE_OF_CONDUCT.md); please follow it in all your interactions with the project.

## Setup

You need [Bun](https://bun.sh) and Python 3.

```bash
bun install        # dev tools (Biome, Vitest)
bun run dev        # development server, prints its URL
```

## Before opening a pull request

```bash
bun run lint       # Biome: lint + formatting (bun run lint:fix to apply the fixes)
bun run test       # Vitest unit tests
bun run test:py    # Python tests of the merge
bun run build      # produces dist/index.html, a single self-contained file
```

The same checks run in CI (`.github/workflows/`).

## Where things live

```
index.html            the page: markup only
src/
  main.js             entry point: builds the page from the data, wires the UI, starts the frame loop
  config.js           every tunable of the viewer
  data.js             imports data/games.json
  world.js            years as stretches of tunnel, placement of each constellation (pure)
  scene.js            the one world instance
  app.js              the live Travel and Focus, wired to the window (scroll, history, clock)
  focus.js            the focused game: phase, flight to it and back, saved view, history entry (pure)
  travel.js           where the ship is along the rail: scroll ↔ depth, bands, year steps, jumps (pure)
  camera.js           projection, the browse camera (mouse look) and the focus camera (framing a game)
  render.js           the frame loop: sky, year gates, constellations, shines
  detail.js           the game page and the "why this constellation" explainer
  years.js            year picker and year label
  search.js           accent-insensitive search (ranking is pure)
  input.js            mouse, touch, keyboard
  overlays.js         legend and explainer overlays
  router.js           the hash is the route: #<slug> opens a game, back closes it
  intro.js            the opening sequence
  shines.js           sparkles
  tilt.js             phones: tilting the device looks around, the compass recentres
  coach.js            the card that shows how to move and look around, once
  viewport.js         canvas size, focal length
  state.js            the few mutable things shared by the modules
  vec.js              vectors, rotations, hashes, easings
  styles.css
tests/                Vitest, one file per module + data.test.js; tests/python/: unittest of the merge
scripts/
  fetch_games.py      builds the database from the public API (network and file adapter)
  merge.py            what gets added, refreshed or skipped, and where it sits (pure)
  constellation.py    the constellation algorithm
  build.ts            the production build (also copies public/)
  release.ts          the next version from CHANGELOG.md, and the notes of a release (Release workflow)
  version.ts          writes the version of VERSION.md into the page (build and dev server)
  og-image.html       source of the sharing image; og-image.ts renders it (bun run og-image)
public/               favicons, sharing image, robots.txt, sitemap.xml: served at the root as they are
data/games.json       the database
docs/CONSTELLATION.md how a constellation is built
docs/adr/             architecture decisions
GLOSSARY.md           the words of the domain
```

`src/` is plain ES modules bundled by Bun. `data/games.json` is the database: **do not edit it by hand**,
constellation values are computed once and never change, see [docs/CONSTELLATION.md](docs/CONSTELLATION.md).

## Changing the constellation algorithm

Edit `scripts/constellation.py` (every number is in `CONFIG`, never a literal: the database keeps the
`CONFIG` of each version for the explainer, see [ADR 0001](docs/adr/0001-algorithm-parameters-frozen-per-version.md)),
keep `docs/CONSTELLATION.md` in sync,
bump `ALGORITHM_VERSION` and run `bun run relayout`. This moves every existing constellation, so say
so in the pull request.

## Commit messages

Use imperative, conventional-commit style messages: `feat(detail): add the award pills`,
`fix(camera): keep the focal length while the mobile bar collapses`. Add an entry to
[CHANGELOG.md](CHANGELOG.md) under "Unreleased" in your pull request: merging it releases it (see below).

## Releasing

There is nothing to do by hand: every push to `main` runs the "Release" workflow. When "Unreleased" in
[CHANGELOG.md](CHANGELOG.md) lists something, it picks the next version from those entries (major for a
`### Removed` section, a `!` after the type or `BREAKING`; minor for an `### Added` section or a `feat`; patch
otherwise), moves them under that version with [chan](https://github.com/geut/chan), writes it to
[VERSION.md](VERSION.md), tags `<version>` (no `v`: `1.1.0`), publishes the GitHub release and deploys. A push with nothing under
"Unreleased" is deployed without a release. `bun scripts/release.ts` prints the version the next release would get.

So each merged pull request is its own release. To ship several changes as one release, merge them into a release
branch first and open one pull request from it.

The weekly "Update games database" workflow commits the new games to `main` with their own line under
"Unreleased" (`chan added`), then runs the release.
