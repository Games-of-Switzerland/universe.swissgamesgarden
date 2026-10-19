# Swiss Games Universe

A 3D tunnel of constellations, one per Swiss game, hung in the sky of its first release year. The viewer flies the ship along the rail and can focus on one game to read its page.

## Focus

**Focus**:
The one game the viewer is looking at closely, with its page shown, or none while browsing.
_Avoid_: selection, detail mode, opened game

**Phase**:
Where the Focus is in its lifecycle: `browse`, `opening`, `open` or `closing`.
_Avoid_: closing flag, focus state

**Flight**:
The ship's animated move between the browsing position and a focused game, or from one focused game to another.
_Avoid_: tween, animation, transition

**Saved view**:
Where the viewer was when they left browsing: the page scroll, the ship's pose and the look direction. Closing flies back to it.
_Avoid_: saved camera, previous position

**Focus box**:
The part of the screen where the focused constellation is framed: the right half on desktop, the band above the text sheet on a phone.
_Avoid_: frame, target area

## Travel

**Rail**:
The path through space the ship flies along, running through every band in time order.
_Avoid_: tunnel axis, track

**Band**:
The stretch of rail holding one year's constellations, or the final TBA stretch for games with no known year.
_Avoid_: sky (for a year), year section

**Travel**:
Where the ship is along the rail, as driven by the page scroll.
_Avoid_: rail position, scroll depth

**Year picker**:
The column of year buttons that takes the ship to a band.
_Avoid_: rail (for the buttons), year list

## Constellations

**Algorithm version**:
The numbered generation of the constellation algorithm that built a constellation. A constellation keeps the version that built it forever.
_Avoid_: schema version, v

**Algorithm parameters**:
The tunable numbers one algorithm version used to build its constellations, kept with the data so the figure can be explained later.
_Avoid_: config, settings

**Anchor**:
A constellation's place inside its band: how far along the band, and the angle around the ship.
_Avoid_: position, coordinates

**Frozen**:
Said of a stored constellation: never recomputed afterwards, so a game keeps its figure and its anchor.
_Avoid_: stable, locked, cached

**Occupancy**:
The anchors already taken in a band, which a new constellation keeps its distance from.
_Avoid_: anchors map, taken spots
