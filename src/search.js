/**
 * @file Search: accent-insensitive ranking (pure) and the search box UI.
 * @module search
 */
import { fmtDate } from './format.js';

/** Lowercase with accents stripped, "Été" gives "ete": NFD splits the accents off, \p{M} drops them. */
export const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/** Escapes a string so it can be used literally inside a regular expression. */
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ranks games for a query: word-start matches first, then substring matches, each group alphabetical. */
export function rankSearch(games, query, limit = 8) {
  const needle = normalize(query.trim());
  if (!needle) return [];
  const wordStart = new RegExp(`\\b${escapeRegExp(needle)}`);
  const starts = [];
  const contains = [];
  for (const game of games) {
    const key = game.key ?? normalize(game.title);
    const index = key.indexOf(needle);
    if (index === 0 || wordStart.test(key)) starts.push(game);
    else if (index > 0) contains.push(game);
  }
  const byTitle = (first, second) => first.title.localeCompare(second.title);
  return [...starts.sort(byTitle), ...contains.sort(byTitle)].slice(0, limit);
}

/** Wires the search box; `onPick(game)` is called when a result is chosen. */
export function initSearch(games, onPick) {
  const input = document.getElementById('searchInput');
  const clearButton = document.getElementById('searchClear');
  const list = document.getElementById('searchResults');
  const form = document.getElementById('search');
  for (const game of games) game.key = normalize(game.title);
  let results = [];
  let activeIndex = -1;

  /** Hides the results, optionally clearing the text. */
  const close = (clearText) => {
    if (clearText) {
      input.value = '';
      clearButton.hidden = true;
    }
    results = [];
    list.hidden = true;
    list.innerHTML = '';
    input.blur();
  };

  /** Chooses a result. */
  const pick = (game) => {
    close(true);
    onPick(game);
  };

  /** Rebuilds the result list from `results` and `activeIndex`. */
  const render = () => {
    list.innerHTML = '';
    if (!results.length) {
      const empty = document.createElement('li');
      empty.className = 'is-empty';
      empty.textContent = 'No game found';
      list.appendChild(empty);
    }
    results.forEach((game, index) => {
      const item = document.createElement('li');
      if (index === activeIndex) item.classList.add('is-active');
      const title = document.createElement('b');
      title.textContent = game.title;
      const date = document.createElement('span');
      date.textContent = game.band.key === 'TBA' ? 'TBA' : fmtDate(game.first_release?.date) || game.band.label;
      item.append(title, date);
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        pick(game);
      });
      item.addEventListener('mousemove', () => {
        if (activeIndex !== index) {
          activeIndex = index;
          render();
        }
      });
      list.appendChild(item);
    });
    list.hidden = false;
  };

  /** Runs the search for the current text. */
  const run = () => {
    const query = input.value.trim();
    clearButton.hidden = !query;
    if (!query) {
      results = [];
      list.hidden = true;
      list.innerHTML = '';
      return;
    }
    results = rankSearch(games, query);
    activeIndex = results.length ? 0 : -1;
    render();
  };

  input.addEventListener('input', run);
  input.addEventListener('focus', () => {
    if (input.value.trim()) run();
  });
  input.addEventListener('blur', () =>
    setTimeout(() => {
      list.hidden = true;
    }, 120),
  );
  input.addEventListener('keydown', (event) => {
    // Typing must not trigger the year shortcuts.
    event.stopPropagation();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return;
      event.preventDefault();
      activeIndex = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      render();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0) pick(results[activeIndex]);
    } else if (event.key === 'Escape') {
      close(true);
    }
  });
  clearButton.addEventListener('click', () => {
    close(true);
    input.focus();
  });
  form.addEventListener('submit', (event) => event.preventDefault());
}
