/**
 * @file The URL hash is the only route: "#<slug>" opens that game, no hash is the home. Opening a game adds a
 * history entry, so the back button closes it.
 * @module router
 */

/** Slug of a game, taken from its archive path. */
export const slugOf = (game) => game.path.replace('/games/', '');

/** Slug in the current hash, or null when there is none or it is malformed. */
export function currentSlug(hash = location.hash) {
  if (hash.length < 2) return null;
  try {
    return decodeURIComponent(hash.slice(1)) || null;
  } catch {
    return null;
  }
}

/** The game with that slug, or null. */
export const findBySlug = (games, slug) => games.find((game) => game.path === `/games/${slug}`) || null;

/** URL of a game, or of the home when `game` is null. */
const urlFor = (game) => (game ? `#${encodeURIComponent(slugOf(game))}` : location.pathname);

/** The history adapter of the focus: the games in the URL, read and written through the browser history. */
export function createUrlHistory(games) {
  // The focus puts the scroll back itself when closing; the browser restoring the entry's scroll on back
  // would land somewhere else.
  history.scrollRestoration = 'manual';
  return {
    current: () => {
      const slug = currentSlug();
      return slug === null ? null : findBySlug(games, slug);
    },
    push: (game) => history.pushState(null, '', urlFor(game)),
    replace: (game) => history.replaceState(null, '', urlFor(game)),
    back: () => history.back(),
    onChange: (listener) => window.addEventListener('popstate', listener),
  };
}
