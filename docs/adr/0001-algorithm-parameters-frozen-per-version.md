# Algorithm parameters are frozen per version in games.json

Constellations are frozen: a game keeps the figure its algorithm version built, even after `CONFIG` changes. The viewer's "why this constellation" explainer shows the formulas behind a figure (main star radius, shine and their caps), so it needs the parameters of the version that built that record, not today's. We store them in the data: `games.json` carries `params`, a map from algorithm version to the full `CONFIG` that version used. `fetch_games.py` writes an entry the first time a version builds a constellation and never overwrites it. The explainer reads `params[record.v]`, and shows plain values with no formula when the entry is missing.

## Considered options

- **Read the numbers from the Python source** (what `tests/_utils/python.js` did, with a regex): this only gives the current version. It also made the JS side depend on the Python file's text, and only `main_radius_max` was checked.
- **Copy the parameters into every record**: correct, but repeats ~40 numbers 1,200 times.
- **Publish only the current `CONFIG`**: smallest, but the explainer silently lies about older records as soon as a parameter changes.

## Consequences

- Every number a formula in the explainer shows must live in `CONFIG`. A literal in `constellation.py` (like the former `0.6` and `1.0`) would not be published.
- A `params` entry is history, not configuration: editing it by hand changes what the explainer says about frozen constellations.
- `algorithm_version` at the top of `games.json` is the highest key in `params`.
