/**
 * @file The game detail: the text page of the focused game and the "why this constellation" explainer.
 * @module detail
 */
import { focus, solvePose } from './app.js';
import { basisFor } from './camera.js';
import { database } from './data.js';
import { fmtDate, plural, subtitleParts } from './format.js';
import { toggleExplain } from './overlays.js';
import { state } from './state.js';
import { vec } from './vec.js';
import { canvas } from './viewport.js';

/** Shorthand for an element by id. */
const byId = (id) => document.getElementById(id);

/** Creates an element with an optional class and text. */
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Shows and hides the page as the focus opens and closes; the flight itself belongs to the focus. */
export function initDetail() {
  const detail = byId('detail');
  const siteTitle = document.title;
  focus.onPhase((phase, game) => {
    // The tab, the history and a bookmark name the game while it is open.
    document.title =
      phase === 'browse' || phase === 'closing' ? siteTitle : `${game.title.trim()} · Swiss Games Universe`;
    if (phase === 'opening') {
      state.hovered = null;
      document.body.classList.add('is-focused');
      canvas.classList.remove('is-hovering');
      // The mobile sheet keeps the previous game's scroll position otherwise.
      detail.scrollTop = 0;
      fillDetail(game);
    } else if (phase === 'open') {
      detail.classList.add('is-open');
      detail.setAttribute('aria-hidden', 'false');
    } else if (phase === 'closing') {
      detail.classList.remove('is-open');
      detail.setAttribute('aria-hidden', 'true');
      toggleExplain(false);
      document.body.classList.remove('is-focused');
    }
  });
}

/** Fills the page: title, subtitle, sky and city, the pills and the link. */
export function fillDetail(game, pose = solvePose(game)) {
  byId('dTitle').textContent = game.title;
  const subtitle = byId('dSub');
  subtitle.innerHTML = '';
  for (const part of subtitleParts(game.first_release || {})) {
    subtitle.appendChild(typeof part === 'string' ? document.createTextNode(part) : element('b', null, part.b));
  }
  const starCount = game.constellation.stars.length;
  subtitle.appendChild(document.createTextNode(starCount > 1 ? `, a constellation of ${starCount} stars.` : '.'));

  const meta = byId('dMeta');
  meta.innerHTML = '';
  meta.appendChild(element('span', 'sky', game.band.key === 'TBA' ? 'Year unknown' : `Sky of ${game.year}`));
  if (game.locations?.length) meta.appendChild(element('span', null, [...new Set(game.locations)].join(' · ')));

  // Row 1: who made it (studio, canton, people). Row 2: platforms. Row 3: awards. Each row wraps on its own.
  const rows = { who: byId('dChipsWho'), platforms: byId('dChipsPlatforms'), awards: byId('dChipsAwards') };
  for (const row of Object.values(rows)) row.innerHTML = '';
  /** Adds one pill to a row, with an optional small kind label. */
  const chip = (row, kind, text, dim) => {
    const pill = element('span', `chip${dim ? ' is-dim' : ''}`);
    if (kind) pill.appendChild(element('small', null, kind));
    pill.appendChild(document.createTextNode(text));
    rows[row].appendChild(pill);
  };
  for (const studio of new Set(game.studios || [])) chip('who', 'Studio', studio);
  for (const canton of new Set(game.cantons || [])) chip('who', 'Canton', canton);
  for (const person of [...new Set(game.people || [])].slice(0, 6)) chip('who', '', person);
  const platformsSeen = new Set();
  for (const release of game.releases || []) {
    if (!release.platform || platformsSeen.has(release.platform)) continue;
    platformsSeen.add(release.platform);
    chip('platforms', '', release.platform, release.state && release.state !== 'released');
  }
  for (const award of (game.awards || []).slice(0, 4)) chip('awards', '🏆', award);
  byId('dLink').href = game.url;
  fillExplain(game, pose);
}

/** Fills the explainer: every element of THIS figure, with the numbers that produced it. */
export function fillExplain(game, pose = solvePose(game)) {
  const constellation = game.constellation;
  const stars = constellation.stars;
  // The parameters of the algorithm version that built this figure; without them, values but no formulas.
  const params = database.params?.[constellation.v];
  const list = byId('xList');
  list.innerHTML = '';
  const lineBreak = () => document.createElement('br');

  /** One title and one description made of parts: strings, { b: bold }, { s: dimmed } or nodes. */
  const row = (title, parts) => {
    list.appendChild(element('dt', null, title));
    const description = element('dd');
    for (const part of parts) {
      if (part instanceof Node) description.appendChild(part);
      else if (part.b) description.appendChild(element('b', null, part.b));
      else if (part.s) description.appendChild(element('span', null, part.s));
      else description.appendChild(document.createTextNode(part));
    }
    list.appendChild(description);
  };

  /** One title and a list of items { b: label, text, sub }, skipped when empty. */
  const section = (title, items) => {
    if (!items.length) return;
    list.appendChild(element('dt', null, title));
    const description = element('dd');
    items.forEach((item, index) => {
      if (index) description.appendChild(lineBreak());
      description.appendChild(element('b', null, item.b));
      if (item.text) description.appendChild(document.createTextNode(` ${item.text}`));
      if (item.sub) {
        description.appendChild(lineBreak());
        description.appendChild(element('span', null, item.sub));
      }
    });
    list.appendChild(description);
  };

  /** Stars of one kind, with their index. */
  const starsOfKind = (kind) => stars.map((star, index) => [star, index]).filter(([star]) => star.kind === kind);

  /** "1 platform star", "3 platform stars". */
  const starCount = (count, word) => (count === 1 ? `1 ${word} star` : `${count} ${word} stars`);

  const credits = new Set(game.people || []).size + new Set(game.studios || []).size;
  const radiusCapped = params && stars[0].r >= params.main_radius_max;
  row('Main star · the game', [
    { b: `radius ${stars[0].r}` },
    params ? ` = ${params.main_radius_min} + ${params.main_radius_per_credit} × √${credits}` : ' ',
    lineBreak(),
    {
      s: `${credits} ${credits === 1 ? 'person or studio' : 'people or studios'} credited${radiusCapped ? ` · capped at ${params.main_radius_max}` : ''}`,
    },
  ]);

  const platforms = starsOfKind('platform');
  section(
    starCount(platforms.length, 'platform'),
    platforms.map(([star], position) => {
      const parent = stars[star.parent];
      const lineLength = Math.hypot(star.x - parent.x, star.y - parent.y).toFixed(0);
      return {
        b: star.label,
        text: star.date ? fmtDate(star.date) : '',
        sub: `${star.family} · radius ${star.r} · line ${lineLength} units · ${describeGap(star, parent, position)}`,
      };
    }),
  );
  const studios = starsOfKind('studio');
  section(
    starCount(studios.length, 'studio'),
    studios.map(([star]) => ({ b: star.label, sub: `radius ${star.r} · branches off the game` })),
  );
  const people = starsOfKind('person');
  section(
    people.length === 1 ? '1 person star' : `${people.length} people stars`,
    people.map(([star]) => ({
      b: star.label,
      sub: `radius ${star.r} · fans around ${stars[star.parent].kind === 'studio' ? stars[star.parent].label : 'the game'}`,
    })),
  );
  const stores = starsOfKind('store');
  section(
    starCount(stores.length, 'store'),
    stores.map(([star]) => ({ b: star.label, sub: `radius ${star.r} · twig on ${stars[star.parent].label}` })),
  );
  const awardStars = starsOfKind('award');
  section(
    starCount(awardStars.length, 'award'),
    awardStars.map(([star]) => ({
      b: star.label.length > 40 ? `${star.label.slice(0, 38)}…` : star.label,
      sub: `radius ${star.r} · ray from the game`,
    })),
  );

  const awards = game.awards || [];
  const shineCapped = params && constellation.shine >= params.shine_max;
  row('Glow', [
    { b: `shine ${constellation.shine}` },
    params && awards.length ? ` = ${params.shine_base} + ${params.shine_per_award} × ${awards.length} ` : ' ',
    {
      s: awards.length
        ? `· ${plural(awards.length, 'award')}${shineCapped ? ` · capped at ${params.shine_max}` : ''}`
        : '· no award recorded',
    },
  ]);

  drawExplainFigure(game, pose);
}

/** Words for the time between a platform star and the previous one in the chain. */
function describeGap(star, parent, position) {
  if (position === 0) return 'first release · from the game';
  if (!star.date || !parent.date) return 'unknown gap';
  const days = Math.abs((new Date(star.date) - new Date(parent.date)) / 864e5);
  let span = `${(days / 365).toFixed(1)} years`;
  if (days === 0) span = 'same day';
  else if (days < 60) span = `${Math.round(days)} days`;
  else if (days < 730) span = `${Math.round(days / 30)} months`;
  return `${span} after ${parent.label}`;
}

/** Draws the real figure as an SVG, seen exactly as the focus camera sees it (same basis, perspective aside). */
export function drawExplainFigure(game, pose = solvePose(game)) {
  const constellation = game.constellation;
  const width = 340;
  const height = 280;
  const padding = 40;
  const basis = basisFor(pose.fwd);
  // Star positions in the camera's plane, relative to the anchor.
  const flat = game.pts.map((point) => {
    const offset = vec.sub(point, game.a);
    return [vec.dot(offset, basis.right), -vec.dot(offset, basis.up)];
  });
  const xs = flat.map((position) => position[0]);
  const ys = flat.map((position) => position[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(
    (width - 2 * padding) / Math.max(12, maxX - minX),
    (height - 2 * padding) / Math.max(12, maxY - minY),
  );
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  const svgX = (index) => width / 2 + (flat[index][0] - centreX) * scale;
  const svgY = (index) => height / 2 + (flat[index][1] - centreY) * scale;
  const svgRadius = (radius) => Math.max(3, radius * Math.min(scale, 3.2));
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = `<defs><filter id="xg"><feGaussianBlur stdDeviation="${2 + constellation.shine}"/></filter></defs>`;
  /** Appends one SVG element with attributes. */
  const add = (name, attributes) => {
    const node = document.createElementNS(svgNS, name);
    for (const key in attributes) node.setAttribute(key, attributes[key]);
    svg.appendChild(node);
  };
  for (const [from, to] of constellation.links) {
    add('line', {
      x1: svgX(from),
      y1: svgY(from),
      x2: svgX(to),
      y2: svgY(to),
      stroke: '#ff7daf',
      'stroke-opacity': 0.8,
      'stroke-width': 1.4,
    });
  }
  constellation.stars.forEach((star, index) => {
    const radius = svgRadius(star.r);
    add('circle', {
      cx: svgX(index),
      cy: svgY(index),
      r: radius * (1.2 + 0.5 * constellation.shine),
      fill: '#fff',
      opacity: 0.18 + 0.12 * constellation.shine,
      filter: 'url(#xg)',
    });
    add('circle', { cx: svgX(index), cy: svgY(index), r: radius, fill: '#fff' });
  });
  const box = byId('xFigure');
  box.innerHTML = '';
  box.appendChild(svg);
}
