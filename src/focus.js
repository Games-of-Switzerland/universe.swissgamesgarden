/**
 * @file Focus: the one game looked at closely. Owns its phase (browse, opening, open, closing), the flight
 * of the ship to it and back, the view saved when leaving browse, and its history entry. The page, the
 * viewport and the frame loop listen to the phase. Pure: the window comes in through adapters.
 * @module focus
 */
import { clamp01, easeCubicInOut, vec } from './vec.js';

/**
 * Creates the focus.
 * - cam, mouse: the ship and the mouse look, written in place.
 * - history: { current(), push(game), replace(game or null), back(), onChange(listener) }.
 * - scroll: { top(), to(top) }, the page scroll in px.
 * - clock(): the time in ms, on the same timebase as tick(now).
 * - jumpNear(game): moves the page next to a far game, true when it moved.
 * - solvePose(game): the ship pose framing a game. browsePose(): the browse pose at the current scroll.
 * - duration: length of a flight in ms.
 */
export function createFocus({ cam, mouse, history, scroll, clock, jumpNear, solvePose, browsePose, duration }) {
  let phase = 'browse';
  let game = null;
  // Where the user was when leaving browse: { scroll, pose, look }. Closing flies back to it.
  let saved = null;
  // The running flight: { from, to, t0, onLand }.
  let flight = null;
  // The latest request that arrived during a flight, { target, fromHistory }, applied on landing.
  let pending = null;
  // True when opening pushed the history entry, so closing pops it instead of piling up entries.
  let pushed = false;
  const listeners = [];

  const currentPose = () => ({ p: cam.p.slice(), fwd: cam.fwd.slice() });

  /** Enters a phase and tells the listeners. */
  function enter(next) {
    phase = next;
    for (const listener of listeners) listener(phase, game);
  }

  /** Flies the ship from where it is to `to`, calling `onLand` on arrival. */
  function fly(to, onLand) {
    flight = { from: currentPose(), to, t0: clock(), onLand };
  }

  /** Opens `target`, or closes when it is null. During a flight only the latest request is kept, for the landing,
   * except a close while opening: it turns back at once rather than landing first. */
  function request(target, fromHistory) {
    if (flight && !(target === null && phase === 'opening')) {
      pending = { target, fromHistory };
      return;
    }
    pending = null;
    if (target) show(target, fromHistory);
    else hide(fromHistory);
  }

  /** Flies to a game: from browse (saving the view first), or straight from the open one. */
  function show(target, fromHistory) {
    if (phase === 'open' && target === game) return;
    if (phase === 'browse') {
      // A far game (search, deep link): jump the page next to it first, so the flight is short and closing
      // comes back near it.
      if (jumpNear(target)) Object.assign(cam, browsePose());
      saved = { scroll: scroll.top(), pose: currentPose(), look: { nx: mouse.nx, ny: mouse.ny, active: mouse.active } };
      if (!fromHistory) history.push(target);
      pushed = !fromHistory;
    } else if (!fromHistory) {
      // One entry per open page: back always means "close", never "previous game".
      history.replace(target);
    }
    game = target;
    enter('opening');
    // Solved after the listeners ran: the mobile focus box is measured on the focused layout.
    fly(solvePose(target), () => enter('open'));
  }

  /** Flies back to the saved view along the same path. */
  function hide(fromHistory) {
    if (phase === 'browse' || phase === 'closing') return;
    enter('closing');
    scroll.to(saved.scroll);
    // Restore the look the user had when opening: the mouse has since moved to the close button, and
    // aiming at it would make the way back differ from the way in.
    Object.assign(mouse, saved.look);
    fly(saved.pose, () => {
      game = null;
      saved = null;
      enter('browse');
    });
    if (!fromHistory) {
      if (pushed) history.back();
      else history.replace(null);
    }
    pushed = false;
  }

  /** Opens or closes to match the current history entry (deep link, back, forward, edited URL). */
  function follow() {
    request(history.current(), true);
  }

  history.onChange(follow);

  return {
    /** browse, opening, open or closing. */
    get phase() {
      return phase;
    },
    /** The focused game, while opening, open or closing; null in browse. */
    get game() {
      return game;
    },
    open: (target) => request(target, false),
    close: () => request(null, false),
    follow,

    /** Advances the flight to the frame time `now`, landing it at the end. */
    tick(now) {
      if (!flight) return;
      const t = clamp01((now - flight.t0) / duration);
      const progress = easeCubicInOut(t);
      cam.p = vec.lerp(flight.from.p, flight.to.p, progress);
      cam.fwd = vec.norm(vec.lerp(flight.from.fwd, flight.to.fwd, progress));
      if (t < 1) return;
      const { onLand } = flight;
      flight = null;
      onLand();
      if (pending) request(pending.target, pending.fromHistory);
    },

    /** Frames the game again after the viewport changed: the pose was solved for the old size. */
    resize() {
      if (!game || phase === 'closing') return;
      const to = solvePose(game);
      if (flight) flight.to = to;
      else Object.assign(cam, to);
    },

    /** Calls `listener(phase, game)` on every phase change. */
    onPhase(listener) {
      listeners.push(listener);
    },
  };
}
