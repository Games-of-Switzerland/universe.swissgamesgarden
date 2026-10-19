import { beforeEach, describe, expect, it } from 'vitest';
import { browseCamera, focusBoxFor, focusCamera } from '../src/camera.js';
import { FOV } from '../src/config.js';
import { createFocus } from '../src/focus.js';
import { createTravel } from '../src/travel.js';
import { buildWorld } from '../src/world.js';

const DURATION = 1000;

const stored = (uuid, year) => ({
  uuid,
  year,
  constellation: {
    cx: 0.5,
    cy: 0.2,
    shine: 1,
    extent: 30,
    stars: [
      { x: 0, y: 0, r: 3 },
      { x: 30, y: 0, r: 2 },
      { x: 0, y: -20, r: 2 },
    ],
    links: [
      [0, 1],
      [0, 2],
    ],
  },
});

// 1990 is near the start of the rail; 2020 is far down it, past the fog.
const games = [
  stored('near', 1990),
  ...Array.from({ length: 8 }, (_, i) => stored(`filler${i}`, 2000 + i)),
  stored('far', 2020),
];
const { bands } = buildWorld(games);
const near = games[0];
const far = games[games.length - 1];
const other = games[1];

/** Browser history with entries of games (null is the home), and a popstate-like change event. */
function fakeHistory(entries = [null]) {
  const listeners = [];
  const calls = [];
  let index = entries.length - 1;
  const fire = () => {
    for (const listener of listeners) listener();
  };
  return {
    calls,
    current: () => entries[index],
    push(game) {
      calls.push('push');
      entries.splice(index + 1, entries.length, game);
      index++;
    },
    replace(game) {
      calls.push('replace');
      entries[index] = game;
    },
    back() {
      calls.push('back');
      index--;
      fire();
    },
    onChange: (listener) => listeners.push(listener),
    /** The user presses back. */
    userBack() {
      index--;
      fire();
    },
    /** The user types another game's URL. */
    userVisit(game) {
      entries.splice(index + 1, entries.length, game);
      index++;
      fire();
    },
    get length() {
      return entries.length;
    },
  };
}

let view;
let cam;
let mouse;
let scrollTop;
let now;
let history;
let focus;
let phases;

const scroll = {
  top: () => scrollTop,
  to: (top) => {
    scrollTop = top;
  },
};

function makeFocus(entries) {
  const travel = createTravel(bands, scroll);
  history = fakeHistory(entries);
  focus = createFocus({
    cam,
    mouse,
    history,
    scroll,
    clock: () => now,
    jumpNear: travel.jumpNear,
    solvePose: (game) => focusCamera(game, view, focusBoxFor(view)),
    browsePose: () => browseCamera(travel.depth(), mouse),
    duration: DURATION,
  });
  phases = [];
  focus.onPhase((phase, game) => phases.push([phase, game?.uuid]));
  Object.assign(cam, browseCamera(travel.depth(), mouse));
}

/** Lets time pass and runs one frame. */
function wait(ms) {
  now += ms;
  focus.tick(now);
}

const pose = () => ({ p: cam.p.slice(), fwd: cam.fwd.slice() });

function expectPose(actual, expected) {
  for (const key of ['p', 'fwd']) {
    actual[key].forEach((value, i) => {
      expect(value).toBeCloseTo(expected[key][i], 6);
    });
  }
}

beforeEach(() => {
  const vw = 1440;
  const vh = 900;
  view = { vw, vh, dpr: 1, f: vh / 2 / Math.tan(((FOV / 2) * Math.PI) / 180), px: vw / 2, py: vh / 2 };
  cam = { p: [0, 0, 0], fwd: [0, 0, 1], basis: null };
  mouse = { x: 0, y: 0, nx: 0.3, ny: -0.2, active: true };
  scrollTop = 0;
  now = 5000;
  makeFocus();
});

describe('focus', () => {
  it('flies to a game, then back to the scroll, pose and look the user left', () => {
    const start = pose();
    focus.open(near);
    expect(focus.phase).toBe('opening');
    expect(focus.game).toBe(near);
    wait(DURATION);
    expect(focus.phase).toBe('open');
    expectPose(cam, focusCamera(near, view, focusBoxFor(view)));

    // The user moves the mouse to the close button and the page was scrolled under the lock.
    Object.assign(mouse, { nx: 0.9, ny: 0.9 });
    scrollTop = 1234;
    focus.close();
    expect(focus.phase).toBe('closing');
    expect(scrollTop).toBe(0);
    expect(mouse).toMatchObject({ nx: 0.3, ny: -0.2, active: true });
    wait(DURATION);
    expect(focus.phase).toBe('browse');
    expect(focus.game).toBeNull();
    expectPose(cam, start);
    expect(phases).toEqual([
      ['opening', 'near'],
      ['open', 'near'],
      ['closing', 'near'],
      ['browse', undefined],
    ]);
  });

  it('applies a URL change that arrives mid-flight once it lands', () => {
    focus.open(near);
    wait(DURATION / 2);
    history.userVisit(other);
    expect(focus.game).toBe(near);
    wait(DURATION / 2);
    // Landed on the first game, then straight on to the requested one.
    expect(focus.phase).toBe('opening');
    expect(focus.game).toBe(other);
    wait(DURATION);
    expect(focus.phase).toBe('open');
    expectPose(cam, focusCamera(other, view, focusBoxFor(view)));
  });

  it('keeps only the latest request made during a flight', () => {
    focus.open(near);
    focus.open(other);
    focus.open(far);
    wait(DURATION);
    expect(focus.game).toBe(far);
  });

  it('turns back at once when closed while opening', () => {
    const start = pose();
    focus.open(near);
    wait(DURATION / 2);
    focus.close();
    expect(focus.phase).toBe('closing');
    wait(DURATION);
    expect(focus.phase).toBe('browse');
    expectPose(cam, start);
  });

  it('flies from one game to another, and closing returns to where browsing stopped', () => {
    const start = pose();
    focus.open(near);
    wait(DURATION);
    focus.open(other);
    expect(focus.phase).toBe('opening');
    wait(DURATION);
    expect(focus.game).toBe(other);
    expect(history.length).toBe(2);
    expect(history.current()).toBe(other);
    focus.close();
    wait(DURATION);
    expect(scrollTop).toBe(0);
    expectPose(cam, start);
    expect(history.current()).toBeNull();
  });

  it('closes on the back button, and closing from the page pops its own entry', () => {
    focus.open(near);
    wait(DURATION);
    expect(history.current()).toBe(near);
    history.userBack();
    expect(focus.phase).toBe('closing');
    wait(DURATION);
    expect(focus.phase).toBe('browse');

    focus.open(near);
    wait(DURATION);
    focus.close();
    wait(DURATION);
    expect(history.calls).toEqual(['push', 'push', 'back']);
    expect(history.current()).toBeNull();
  });

  it('frames the game again when the viewport changes mid-flight', () => {
    focus.open(near);
    wait(DURATION / 2);
    view = { vw: 390, vh: 844, dpr: 1, f: 844 / 2 / Math.tan(((FOV / 2) * Math.PI) / 180), px: 195, py: 422 };
    focus.resize();
    wait(DURATION / 2);
    expectPose(cam, focusCamera(near, view, focusBoxFor(view)));
  });

  it('opens a deep link next to its game, and closing it replaces the entry instead of leaving the site', () => {
    makeFocus([far]);
    focus.follow();
    expect(focus.game).toBe(far);
    // The page jumped next to the far game before saving the view.
    expect(scrollTop).toBeGreaterThan(0);
    const jumped = scrollTop;
    wait(DURATION);
    focus.close();
    wait(DURATION);
    expect(history.calls).toEqual(['replace']);
    expect(history.current()).toBeNull();
    expect(scrollTop).toBe(jumped);
  });
});
