# How a constellation is built

One Swiss game = one constellation, placed in the band of its first release year
(the stretch of rail that holds that year).
The values are computed by `scripts/constellation.py` the first time the game is
seen by `scripts/fetch_games.py`, stored in `data/games.json`, and **never change
afterwards**. A game keeps its figure forever, even if the algorithm evolves
(bump `ALGORITHM_VERSION` and run with `--rebuild` if you really want to recompute
everything).

Everything below is deterministic: the only randomness comes from a seeded PRNG
(`mulberry32`) seeded with the SHA-256 of the game's UUID.

## 1. Which band: the year

`year` = the smallest `releases_years[].year` of the game. Games without any year
(usually "in development") go to a final **TBA** band.

## 2. Where in the band: the anchor `(cx, cy)`

Normalized coordinates in `[0, 1]` inside the year. The viewer is a tunnel along
the time axis: you fly on a rail and the constellations hang around you.

| axis | rule | in the viewer |
|------|------|---------------|
| `cx` | the month of the first release: January = 0, December = 1, plus a ±0.05 wobble. A release dated **January 1st** is treated as "month unknown" (the archive uses it as a placeholder) and gets a free position. | depth inside the year's stretch of tunnel |
| `cy` | free | angle around the ship (`cy × 360°`) |

(`CONFIG["canton_sectors"]` can turn on an alternative where every canton owns a
slice of the circle; it is off because it bunches the sky in a few directions.)

Both are chosen with **Mitchell's best-candidate**: 5 seeded candidates are drawn,
and we keep the one farthest from the constellations already placed in that year.
Few candidates keep natural clumps and voids; older constellations never move when
a new one arrives. Since version 4 the distance on `cy` is angular (`cy` 0.99 and
0.01 are neighbours around the ship); records built by version 3 keep their place.

The distance from the rail is not stored: the viewer scatters it from a hash of
the game's UUID between `R_MIN` and `R_MAX`, so the universe reads as a star field
rather than a tube. (`near`, the completeness score of the record divided by 8700,
is stored for a possible future use but not drawn.)

## 3. The stars: one per thing attached to the game

Every entity linked to the game becomes a star, so almost every game is a real
figure (98% have 2 stars or more). Each star knows its `parent`.

| kind | one per… | parent | radius (sky units) |
|------|----------|--------|--------------------|
| `game` | the game itself, the **main star** | — | `2.4 + 0.6 × √(people + studios)`, capped at 6 |
| `platform` | platform, in release order (max 8) | previous platform, or the game | by family: console 2.2 · retro 2.0 · pc 1.9 · vr 1.8 · mobile 1.6 · other 1.4 · browser 1.3 |
| `studio` | studio | the game | 2.0 |
| `person` | person credited (max 6) | the first studio, or the game | 1.2 |
| `store` | store (max 4) | a platform star, spread over them | 0.9 |
| `award` | award (max 5) | the game | 1.7 |

Every star is a filled white dot with a glow, plus a seeded `twinkle.phase` and
`twinkle.rate` (0.4–1.6 Hz) for its breathing animation.

## 4. The figure: a small tree

The main star is at the origin.

* **Platforms** are chained like a chart line: the first one at 16 units from the
  game, then every next one at a distance that grows with the **time gap** since
  the previous release (16 units for the same day, up to 64 units for 4 years or
  more, logarithmic in between). The heading turns by a seeded angle in
  `[-110°, +110°]` at each step.
* **Studios** branch off the main star at 24 units, on the side opposite the chain.
* **People** fan out around their studio (or the main star) at 13 units.
* **Stores** are 9-unit twigs on their platform star, at a seeded angle.
* **Awards** are 30-unit rays from the main star, alternating sides.
* Finally the figure is re-centred on its centroid, so the anchor is its visual middle.

`links` connect every star to its parent. `extent` is the radius of the bounding
circle, used by the viewer for hit-testing and zoom.

In the viewer each figure is a flat plane in 3D space: it starts facing the
rail, then it is spun in its own plane and tilted by up to 50° around a seeded
axis, so no two figures are parallel. The ship's rail is straight (`RAIL_AMP` in
`src/config.js` can make it wind).

## 5. The glow: awards

Every constellation has the same white tint. `shine` starts at `1.0` and grows by
`0.5` for every award listed on the game's JSON:API node, capped at `3.0`. The
viewer draws a wider, brighter halo around the stars of a shiny constellation.

## Changing the rules

All numbers live in `CONFIG` at the top of `scripts/constellation.py`; each rule is
one small function (`anchor`, `stars`, `layout`, `shine`, `near`). The viewer (`index.html`)
only reads the stored values (`cx, cy, shine, near, extent, stars[], links[]`), so you can
change the algorithm without touching the front-end.

After a change:

```bash
python3 scripts/fetch_games.py --relayout  # recompute every constellation from the local data
```

Remember this moves existing constellations, which is exactly what the normal
weekly run avoids.

`--refresh-meta` is the gentle variant: it re-reads known games from the API and
rebuilds their stars from the fresh credits, platforms and awards, but keeps their
anchor, so a game never changes place (unless its release year changed). A game
whose detail request fails is skipped for that run rather than stored without its
awards.
