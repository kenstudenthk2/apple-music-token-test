/**
 * spatial-nav.js — D-pad spatial navigation engine for AppleTune TV
 * ------------------------------------------------------------------
 * Dependency-free ES module. No build step. Load with:
 *
 *   <script type="module">
 *     import nav from './scripts/spatial-nav.js';
 *     nav.init(document.getElementById('app'));
 *   </script>
 *
 * Markup contract (see docs/design/NAVIGATION_MODEL.md section 9):
 *
 *   <div data-focus-group="row-recent" data-focus-scroll="horizontal" data-focus-offset="64">
 *     <div data-focusable id="recent-1">...</div>
 *     <div data-focusable id="recent-2">...</div>
 *   </div>
 *
 *   data-focusable       element participates in navigation
 *   data-focus-group     container that remembers its last-focused child
 *   data-focus-scroll    "horizontal" | "vertical" — how the group scrolls
 *   data-focus-offset    px from the group's leading edge to hold the focused item
 *   data-loading         skeleton: focusable, but OK is swallowed
 *   data-focus-disabled  temporarily skipped by the resolver
 *
 * The engine applies the class `is-focused` to the focused element and also calls
 * HTMLElement.focus({preventScroll:true}) so screen readers follow along. All scrolling
 * is done by the engine, never by the browser, so rows stay aligned to a fixed offset.
 *
 * Events (all bubble, all CustomEvent):
 *   spatialfocus  { element, previous, direction }  focus changed
 *   spatialselect { element }                       OK pressed on a live element
 *   spatialedge   { element, direction }            hit a wall — render the nudge
 *   spatialmedia  { action }                        play/pause/next/prev/ff/rew/stop
 */

/* ------------------------------------------------------------------ *
 * Key codes
 * ------------------------------------------------------------------ */

// Arrow keys are 37-40 everywhere. Enter is 13. BACK is the messy one:
// 27 = browser Esc, 461 = webOS, 10009 = Tizen, and Android TV's KEYCODE_BACK
// arrives as 27 through most TV webviews / Cordova shims.
const KEYS = {
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  13: 'enter',
  32: 'enter',    // some remotes send Space for the centre button
  27: 'back',
  8: 'back',      // Backspace, for desktop development
  461: 'back',    // webOS
  10009: 'back',  // Tizen
  179: 'playpause',
  415: 'play',
  19: 'pause',
  417: 'next',
  412: 'prev',
  418: 'ff',
  413: 'rew',
  // Android TV media keycodes as surfaced by common webviews
  10252: 'playpause',
};

// event.key fallback for platforms that zero out keyCode.
const KEY_NAMES = {
  ArrowLeft: 'left',
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  Enter: 'enter',
  ' ': 'enter',
  Escape: 'back',
  Backspace: 'back',
  GoBack: 'back',
  BrowserBack: 'back',
  MediaPlayPause: 'playpause',
  MediaPlay: 'play',
  MediaPause: 'pause',
  MediaTrackNext: 'next',
  MediaTrackPrevious: 'prev',
  MediaFastForward: 'ff',
  MediaRewind: 'rew',
  MediaStop: 'stop',
};

const MEDIA_ACTIONS = ['playpause', 'play', 'pause', 'next', 'prev', 'ff', 'rew', 'stop'];

/* ------------------------------------------------------------------ *
 * Scoring constants
 * ------------------------------------------------------------------ */

// How much a candidate is punished for sitting outside the current element's
// cross-axis band. High enough that the engine never jumps diagonally when a
// straight-ahead candidate exists.
const CROSS_GAP_PENALTY = 5;

// Softer punishment for centre-line misalignment, used to break ties between
// two candidates that both overlap the band (e.g. two cards of different widths).
const ALIGN_WEIGHT = 0.6;

// Minimum movement along the axis, in px, for a candidate to count as being
// "in the pressed direction". Guards against sub-pixel layout noise.
const MIN_TRAVEL = 2;

// Two focus changes closer together than this mean the viewer is holding a
// direction rather than choosing. Roughly one D-pad auto-repeat interval.
const RAPID_MOVE_MS = 140;

// Default px from a horizontal row's leading edge at which the focused card rests.
const DEFAULT_SCROLL_OFFSET = 48;

// Vertical breathing room kept above/below the focused element, as a fraction of
// the scrollport height.
const VERTICAL_MARGIN_RATIO = 0.18;

/* ------------------------------------------------------------------ *
 * Module state
 * ------------------------------------------------------------------ */

const state = {
  root: null,
  enabled: true,
  current: null,
  /** @type {WeakMap<Element, Element>} group element -> last focused child */
  groupMemory: new WeakMap(),
  /** @type {Array<(evt: KeyboardEvent) => boolean|void>} */
  backHandlers: [],
  lastFocusAt: 0,
  paceTimer: null,
  observer: null,
  bound: false,
};

/* ------------------------------------------------------------------ *
 * Element discovery
 * ------------------------------------------------------------------ */

/** Is this element currently a legal focus target? */
function isNavigable(el) {
  if (!el || el.hasAttribute('data-focus-disabled')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.disabled) return false;
  // offsetParent is null for display:none subtrees (and for position:fixed, hence
  // the rect fallback below, which fixed headers on TV layouts depend on).
  if (el.offsetParent === null) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  if (style.pointerEvents === 'none' && style.opacity === '0') return false;
  return true;
}

/** All navigable elements under the root, in DOM order (order is a tie-break only). */
function candidates() {
  if (!state.root) return [];
  return Array.from(state.root.querySelectorAll('[data-focusable]')).filter(isNavigable);
}

/** Nearest ancestor focus group of an element, or null. */
function groupOf(el) {
  return el ? el.closest('[data-focus-group]') : null;
}

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

/**
 * The element's LAYOUT box, with its own scale undone.
 *
 * Navigation must not be steered by focus decoration. The focused element is
 * scaled up, and once a design gave that scale `transform-origin: center
 * bottom`, the focused tile's painted top rose ~28px above its own row — so its
 * horizontal neighbours became, geometrically, "below" it. Pressing DOWN then
 * stepped sideways along the row instead of dropping to the next shelf.
 *
 * Only the element's OWN transform is removed. Transforms on ancestors (the
 * shelf stack, the row) move every candidate together and must be kept, or
 * nothing would line up.
 *
 * The element's own transform may translate as well as scale — the focus rule
 * lifts the tile as it grows. Solving for the layout edge L, with origin offset
 * o, scale s and translation t:
 *
 *     painted = L + o(1 - s) + t
 *     L       = painted - o(1 - s) - t
 *
 * Dropping the translation term left a 10.8px error, which is more than enough
 * to put a horizontal neighbour "below" the focused tile again.
 */
function boxOf(el) {
  const r = el.getBoundingClientRect();
  const style = getComputedStyle(el);

  let left = r.left;
  let top = r.top;
  let width = r.width;
  let height = r.height;

  if (style.transform && style.transform !== 'none') {
    const m = style.transform.match(/matrix\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(',').map(parseFloat);
      const sx = parts[0] || 1;
      const sy = parts[3] || 1;
      const tx = parts[4] || 0;
      const ty = parts[5] || 0;
      if (sx !== 1 || sy !== 1 || tx !== 0 || ty !== 0) {
        const origin = style.transformOrigin.split(' ').map(parseFloat);
        const ox = origin[0] || 0;
        const oy = origin[1] || 0;
        left = r.left - ox * (1 - sx) - tx;
        top = r.top - oy * (1 - sy) - ty;
        width = r.width / sx;
        height = r.height / sy;
      }
    }
  }

  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    cx: left + width / 2,
    cy: top + height / 2,
  };
}

/**
 * Score one candidate for a directional move. Lower is better; null means the
 * candidate is not in the pressed direction at all.
 *
 * The score is a weighted sum of:
 *   - travel:   distance along the pressed axis (the thing we actually want small)
 *   - crossGap: how far the candidate sits outside the current element's cross-axis
 *               band, heavily penalised so focus never slides diagonally past a
 *               straight-ahead neighbour
 *   - misalign: centre-line offset on the cross axis, a soft tie-breaker
 */
function score(from, to, dir) {
  const horizontal = dir === 'left' || dir === 'right';

  // Travel along the pressed axis, measured leading-edge to leading-edge so that
  // items of differing sizes in the same row score consistently.
  let travel;
  if (dir === 'right') travel = to.left - from.left;
  else if (dir === 'left') travel = from.left - to.left;
  else if (dir === 'down') travel = to.top - from.top;
  else travel = from.top - to.top;

  if (travel < MIN_TRAVEL) return null;

  // Also require the candidate's *centre* to be beyond the current centre, which
  // rejects a wide element that merely starts further along but visually overlaps.
  const centreTravel = horizontal
    ? (dir === 'right' ? to.cx - from.cx : from.cx - to.cx)
    : (dir === 'down' ? to.cy - from.cy : from.cy - to.cy);
  if (centreTravel < MIN_TRAVEL) return null;

  // Cross-axis band overlap.
  let crossGap;
  let misalign;
  if (horizontal) {
    const overlap = Math.min(from.bottom, to.bottom) - Math.max(from.top, to.top);
    crossGap = overlap > 0 ? 0 : -overlap;
    misalign = Math.abs(to.cy - from.cy);
  } else {
    const overlap = Math.min(from.right, to.right) - Math.max(from.left, to.left);
    crossGap = overlap > 0 ? 0 : -overlap;
    misalign = Math.abs(to.cx - from.cx);
  }

  return travel + crossGap * CROSS_GAP_PENALTY + misalign * ALIGN_WEIGHT;
}

/**
 * Find the best element in `dir` from `origin`.
 * Pure geometry — DOM order is never consulted except as a final tie-break.
 */
/**
 * Groups may confine movement along an axis.
 *
 * A horizontal shelf is the motivating case: pressing LEFT on a card must reach
 * the previous card or nothing at all. Purely geometric scoring can prefer a
 * nav item that happens to sit up and to the left, which reads as the row
 * "escaping upwards" and then needing a second press to get back — precisely
 * the confusing behaviour NAVIGATION_MODEL forbids when it says rows stop at
 * their edge.
 *
 * Mark a container with data-focus-contain="x" (or "y", or "xy").
 */
function containsAxis(group, dir) {
  if (!group) return false;
  const axes = group.getAttribute('data-focus-contain');
  if (!axes) return false;
  const horizontal = dir === 'left' || dir === 'right';
  return axes.includes(horizontal ? 'x' : 'y');
}

function resolve(origin, dir) {
  const from = boxOf(origin);
  const group = groupOf(origin);
  const confined = containsAxis(group, dir);

  let best = null;
  let bestScore = Infinity;

  for (const el of candidates()) {
    if (el === origin) continue;
    // Confined axes never leave the group; the edge is simply the end.
    if (confined && groupOf(el) !== group) continue;
    const s = score(from, boxOf(el), dir);
    if (s === null) continue;
    if (s < bestScore) {
      bestScore = s;
      best = el;
    }
  }
  return best;
}

/**
 * Group memory: when focus *enters* a different group on a vertical move, restore
 * that group's last focused child instead of the geometric winner. This is what
 * makes "DOWN out of a row, UP back into it" return you where you were.
 *
 * Horizontal moves inside a row always stay geometric — memory would feel broken
 * there, because the user is explicitly steering along the axis.
 */
function applyGroupMemory(origin, target, dir) {
  if (!target) return target;
  if (dir === 'left' || dir === 'right') return target;

  const fromGroup = groupOf(origin);
  const toGroup = groupOf(target);
  if (!toGroup || toGroup === fromGroup) return target;

  const remembered = state.groupMemory.get(toGroup);
  if (!remembered) return target;
  if (!toGroup.contains(remembered)) return target;
  if (!isNavigable(remembered)) return target;

  return remembered;
}

/* ------------------------------------------------------------------ *
 * Scrolling
 * ------------------------------------------------------------------ */

function isScrollable(el, axis) {
  if (!el || el === document.body || el === document.documentElement) return false;
  const style = getComputedStyle(el);
  const overflow = axis === 'x' ? style.overflowX : style.overflowY;
  if (!/(auto|scroll|hidden)/.test(overflow)) return false;
  return axis === 'x'
    ? el.scrollWidth > el.clientWidth + 1
    : el.scrollHeight > el.clientHeight + 1;
}

/**
 * Bring `el` into view.
 *
 * Horizontal rows are the important case: instead of centring (which makes the
 * row lurch by different amounts depending on card width and produces the classic
 * "jittery TV carousel"), the focused card is parked at a FIXED offset from the
 * scrollport's leading edge. Only cards that would fall outside the viewport move
 * the row at all, so the first few cards of a row never scroll.
 */
function scrollIntoView(el, instant) {
  const behavior = instant ? 'auto' : 'smooth';

  // --- horizontal: nearest scrollable ancestor on x ---
  let hostX = el.parentElement;
  while (hostX && !isScrollable(hostX, 'x')) hostX = hostX.parentElement;

  if (hostX) {
    const group = el.closest('[data-focus-group]') || hostX;
    const offset = parseInt(group.getAttribute('data-focus-offset'), 10);
    const pad = Number.isFinite(offset) ? offset : DEFAULT_SCROLL_OFFSET;

    const hostRect = hostX.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const leadingIn = elRect.left - hostRect.left;   // current px from leading edge
    const trailingOut = elRect.right - hostRect.right;

    let delta = 0;
    if (leadingIn < pad) {
      // Too close to (or past) the left wall: pull it back to the parking offset,
      // but never scroll past the row start.
      delta = leadingIn - pad;
    } else if (trailingOut > -pad) {
      // Off the right edge: advance so the card sits at the parking offset.
      delta = leadingIn - pad;
    }

    if (delta !== 0) {
      const max = hostX.scrollWidth - hostX.clientWidth;
      const next = Math.max(0, Math.min(max, hostX.scrollLeft + delta));
      if (Math.abs(next - hostX.scrollLeft) > 1) {
        hostX.scrollTo({ left: next, behavior });
      }
    }
  }

  // --- vertical: nearest scrollable ancestor on y, else the window ---
  let hostY = el.parentElement;
  while (hostY && !isScrollable(hostY, 'y')) hostY = hostY.parentElement;

  const elRect = el.getBoundingClientRect();

  if (hostY) {
    const hostRect = hostY.getBoundingClientRect();
    const margin = hostRect.height * VERTICAL_MARGIN_RATIO;
    let delta = 0;
    if (elRect.top - hostRect.top < margin) {
      delta = (elRect.top - hostRect.top) - margin;
    } else if (hostRect.bottom - elRect.bottom < margin) {
      delta = margin - (hostRect.bottom - elRect.bottom);
    }
    if (delta !== 0) {
      const max = hostY.scrollHeight - hostY.clientHeight;
      const next = Math.max(0, Math.min(max, hostY.scrollTop + delta));
      if (Math.abs(next - hostY.scrollTop) > 1) {
        hostY.scrollTo({ top: next, behavior });
      }
    }
  } else {
    const margin = window.innerHeight * VERTICAL_MARGIN_RATIO;
    let delta = 0;
    if (elRect.top < margin) delta = elRect.top - margin;
    else if (window.innerHeight - elRect.bottom < margin) {
      delta = margin - (window.innerHeight - elRect.bottom);
    }
    if (delta !== 0) window.scrollBy({ top: delta, behavior });
  }
}

/* ------------------------------------------------------------------ *
 * Focus application
 * ------------------------------------------------------------------ */

function emit(target, name, detail) {
  target.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
}

/**
 * Move focus to `el`.
 * @param {Element} el
 * @param {{direction?: string, instant?: boolean, silent?: boolean}} [opts]
 */
function focus(el, opts = {}) {
  if (!el || el === state.current) return false;
  if (!isNavigable(el)) return false;

  const previous = state.current;
  if (previous) previous.classList.remove('is-focused');

  state.current = el;
  el.classList.add('is-focused');

  // Keep the native focus ring in sync for assistive tech, but do all scrolling
  // ourselves — the browser's default scroll-on-focus fights the offset parking.
  if (typeof el.focus === 'function') {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    try { el.focus({ preventScroll: true }); } catch (_) { /* older webviews */ }
  }

  const group = groupOf(el);
  if (group) state.groupMemory.set(group, el);

  /*
   * Collapse animation while the viewer is hammering the D-pad.
   *
   * Apple's focus coordinator "may shorten or speed up the animations depending
   * on how fast the user is moving between focusable elements". Without it, a
   * 250ms transition per item queues up when someone holds a direction and the
   * row visibly lags behind the remote.
   *
   * Published as an attribute on the root so CSS decides what to shorten; the
   * engine has no business knowing which properties a design animates.
   */
  const now = Date.now();
  const rapid = now - state.lastFocusAt < RAPID_MOVE_MS;
  state.lastFocusAt = now;
  document.documentElement.dataset.navPace = rapid ? "fast" : "normal";
  clearTimeout(state.paceTimer);
  state.paceTimer = setTimeout(() => {
    document.documentElement.dataset.navPace = "normal";
  }, RAPID_MOVE_MS * 2);

  scrollIntoView(el, !!opts.instant);

  if (!opts.silent) {
    emit(el, 'spatialfocus', { element: el, previous, direction: opts.direction || null });
  }
  return true;
}

/** Focus the first navigable element, used on init and after a screen swap. */
function focusFirst() {
  const all = candidates();
  if (all.length) return focus(all[0], { instant: true });
  return false;
}

/* ------------------------------------------------------------------ *
 * Movement
 * ------------------------------------------------------------------ */

function move(dir) {
  // No origin yet (fresh screen, or focus was lost): adopt the first candidate
  // rather than doing nothing, so the very first key press is never swallowed.
  if (!state.current || !isNavigable(state.current)) {
    return focusFirst();
  }

  const geometric = resolve(state.current, dir);
  const target = applyGroupMemory(state.current, geometric, dir);

  if (!target) {
    // Edge of the world. Stop, do not wrap (NAVIGATION_MODEL.md section 3.2) and
    // tell the UI so it can render the nudge — a silent no-op reads as a dropped
    // key press and makes users hammer the remote.
    emit(state.current, 'spatialedge', { element: state.current, direction: dir });
    return false;
  }

  return focus(target, { direction: dir });
}

/* ------------------------------------------------------------------ *
 * Key handling
 * ------------------------------------------------------------------ */

function actionFor(evt) {
  return KEYS[evt.keyCode] || KEY_NAMES[evt.key] || null;
}

function handleBack(evt) {
  // Handlers run most-recently-registered first (modal on top wins). The first one
  // to return true consumes the press.
  for (let i = state.backHandlers.length - 1; i >= 0; i--) {
    let consumed = false;
    try {
      consumed = state.backHandlers[i](evt) === true;
    } catch (err) {
      console.error('[spatial-nav] back handler threw', err);
    }
    if (consumed) return true;
  }
  return false;
}

function onKeyDown(evt) {
  if (!state.enabled) return;
  if (evt.defaultPrevented) return;

  const action = actionFor(evt);
  if (!action) return;

  // Never let the browser act on BACK/arrows itself — Esc and Backspace navigate
  // history in some TV webviews, which would kill the app.
  if (action === 'back') {
    evt.preventDefault();
    evt.stopPropagation();
    handleBack(evt);
    return;
  }

  if (MEDIA_ACTIONS.includes(action)) {
    // Media keys are global by design (NAVIGATION_MODEL.md section 8): they work on
    // every screen, not only Now Playing. Not preventDefault-ed, so a platform
    // media session can still see them.
    emit(state.current || document.body, 'spatialmedia', { action });
    return;
  }

  if (action === 'enter') {
    evt.preventDefault();
    const el = state.current;
    if (!el) { focusFirst(); return; }
    if (el.hasAttribute('data-loading')) {
      // Skeletons swallow OK. Never queue it — a queued OK firing 2s later on
      // now-different content is the classic TV mis-launch bug.
      emit(el, 'spatialedge', { element: el, direction: 'enter' });
      return;
    }
    emit(el, 'spatialselect', { element: el });
    if (typeof el.click === 'function') el.click();
    return;
  }

  // Arrow keys.
  evt.preventDefault();
  move(action);
}

/* ------------------------------------------------------------------ *
 * DOM churn
 * ------------------------------------------------------------------ */

/**
 * If the focused element is removed or hidden (a skeleton being replaced, an empty
 * row collapsing), re-home focus to the nearest surviving candidate instead of
 * leaving the app with no focus ring and dead arrow keys.
 */
function rehomeIfLost() {
  if (state.current && isNavigable(state.current) && document.contains(state.current)) return;

  const lost = state.current;
  state.current = null;
  if (!lost) return;

  // Prefer a sibling at the same index inside the same group.
  const group = groupOf(lost);
  if (group && document.contains(group)) {
    const kids = Array.from(group.querySelectorAll('[data-focusable]')).filter(isNavigable);
    if (kids.length) {
      const remembered = state.groupMemory.get(group);
      const target = remembered && isNavigable(remembered) && group.contains(remembered)
        ? remembered
        : kids[0];
      focus(target, { instant: true });
      return;
    }
  }
  focusFirst();
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Start the engine.
 * @param {Element|Document} [root=document.body] subtree to navigate within
 */
function init(root) {
  state.root = root || document.body;

  if (!state.bound) {
    // Capture phase so we see the key before any component-level handler and can
    // stop the platform from acting on BACK.
    window.addEventListener('keydown', onKeyDown, true);
    state.bound = true;
  }

  if (state.observer) state.observer.disconnect();
  state.observer = new MutationObserver(() => {
    // Coalesce to one check per frame — TV CPUs are slow and content swaps arrive
    // in bursts.
    if (state.observer._queued) return;
    state.observer._queued = true;
    requestAnimationFrame(() => {
      state.observer._queued = false;
      rehomeIfLost();
    });
  });
  state.observer.observe(state.root, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-focusable', 'data-focus-disabled', 'hidden', 'style', 'class'] });

  if (!state.current || !isNavigable(state.current)) focusFirst();

  /*
   * Bridge for the Android host.
   *
   * A hardware BACK press on Android does NOT produce a DOM keydown — it goes
   * straight to Activity.onBackPressed(). Every back handler registered here
   * would therefore never run on a real remote, while a synthetic Escape in a
   * test passes happily. That gap is exactly what shipped: the G4 audit was
   * green and BACK did nothing on the device.
   *
   * MainActivity calls this first and only falls back to WebView history when
   * it returns false.
   */
  window.__onAndroidBack = function () {
    return handleBack(null) === true;
  };

  return api;
}

/** Enable/disable all key handling (use during screen transitions and modals). */
function setEnabled(flag) {
  state.enabled = !!flag;
  return api;
}

/**
 * Register a BACK handler. Return true from the handler to consume the press.
 * Returns an unsubscribe function — register on screen enter, unsubscribe on exit.
 */
function onBack(handler) {
  if (typeof handler !== 'function') throw new TypeError('onBack expects a function');
  state.backHandlers.push(handler);
  return function off() {
    const i = state.backHandlers.indexOf(handler);
    if (i !== -1) state.backHandlers.splice(i, 1);
  };
}

/** Re-scan and, if focus was lost, re-home it. Call after a screen swap. */
function refresh() {
  rehomeIfLost();
  return api;
}

/** Tear down listeners — for hot reload and tests. */
function destroy() {
  if (window.__onAndroidBack) delete window.__onAndroidBack;
  if (state.bound) {
    window.removeEventListener('keydown', onKeyDown, true);
    state.bound = false;
  }
  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
  }
  if (state.current) state.current.classList.remove('is-focused');
  state.current = null;
}

const api = {
  init,
  focus,
  setEnabled,
  onBack,
  refresh,
  destroy,
  /** Currently focused element, or null. */
  get current() { return state.current; },
  /** Programmatic move, same path as a D-pad press. dir: left|right|up|down */
  move,
};

export { init, focus, setEnabled, onBack, refresh, destroy, move };
export default api;
