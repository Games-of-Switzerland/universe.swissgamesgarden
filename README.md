<h1 align="center">
  🌌 Swiss Games Universe by swissgames.garden
</h1>

<p align="center">
  <strong>
    <a href="https://universe.swissgames.garden">Swiss Games Garden - Universe</a>
    •
    <a href="https://api.swissgames.garden/search/games?page=0">Public API</a>
  </strong>
</p>

<p align="center">
  <a href="https://github.com/Games-of-Switzerland/universe.swissgamesgarden/actions/workflows/build.yml"><img src="https://github.com/Games-of-Switzerland/universe.swissgamesgarden/actions/workflows/build.yml/badge.svg" alt="Build & Test"></a>
  <a href="https://github.com/Games-of-Switzerland/universe.swissgamesgarden/actions/workflows/linting.yml"><img src="https://github.com/Games-of-Switzerland/universe.swissgamesgarden/actions/workflows/linting.yml/badge.svg" alt="Linting"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
</p>

Every Swiss video game as a constellation in an universe of time.

You fly on a rail: scroll to go forward and backward through the years, move the mouse (or tilt your phone) to look around you, click a constellation to fly up to it and read its page.

Bundled by 🥟 [Bun](https://bun.sh/), and 🐍 Python for building the database.

## 🚀 Run

```bash
bun install
bun run dev
```

## 📦 Build

```bash
bun run build
```

## 🚢 Deploy

Every push to `main` builds the site and publishes to GitHub Pages (`.github/workflows/deploy.yml`), so the weekly data update goes live by itself. 

## ✅ Quality

```bash
bun run lint      # Biome: lint + formatting (bun run lint:fix applies the fixes)
bun run test      # Vitest: unit tests of the modules + validation of data/games.json
```

## 🗄️ Database

`data/games.json` holds every game with its constellation values. Those values are computed **once**, the first time a game is seen, and never change afterwards: the sky stays stable.

```bash
bun run fetch            # add new games only (what the GitHub Action does)
bun run fetch:refresh    # also refresh known games and redraw their figures in place (they keep their spot)
bun run fetch:rebuild    # refetch everything and recompute every constellation (moves them!)
bun run relayout         # recompute every constellation from local data, no network (moves them!)
```

A GitHub Action (`.github/workflows/update-games.yml`) runs every Monday, and on demand from the Actions tab. It commits `data/` only when new games appeared.

## ✨ How a constellation is built

One game = one constellation: the game is the main star, and every platform, studio, person, store and award attached to it is a star hanging from it.
Platforms are chained by time gap, awards make the halo glow brighter, and the release month sets the depth in the year.

The algorithm lives in a single file, `scripts/constellation.py`, with every number in one `CONFIG` dict. It is explained in [docs/CONSTELLATION.md](docs/CONSTELLATION.md), or press `?` in the viewer.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## Authors

👤 **Kevin Wenger**

* Web: [kevin-wenger.ch](https://kevin-wenger.ch)
* Twitter: [@wengerk](https://twitter.com/wengerk)
* Github: [@wengerk](https://github.com/wengerk)

## License

[MIT](LICENSE)
