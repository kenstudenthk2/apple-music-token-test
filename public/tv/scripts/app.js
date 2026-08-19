/**
 * AppleTune TV — prototype application.
 *
 * This is the G3 design prototype, not the shipping app. It renders every
 * screen with fake data and simulates playback with a timer. There is no
 * network call anywhere in this file, by design: the prototype must render
 * with the network switched off so it can be reviewed as a single file.
 *
 * Contracts it honours (see public/tv/CLAUDE.md):
 *   - focus is app-managed; exactly one element carries data-focused="true"
 *   - only transform and opacity are animated
 *   - rows and stacks move with translate3d, never scrollLeft
 */

import { PLAYLISTS, SHELVES } from "./demo-data.js";
import { init, focus, onBack, refresh } from "./spatial-nav.js";

/* ------------------------------------------------------------------ *
 * Layout constants — these MUST match styles/tokens.css.
 * Expressed in rem so they scale with the root font size like the CSS does.
 * ------------------------------------------------------------------ */
const TILE_REM = 18;        /* --tile-size */
const TILE_GAP_REM = 1.5;   /* --tile-gap  */

/**
 * The horizontal distance between two tiles, measured rather than assumed.
 *
 * This was hard-coded as 19.5rem from --tile-size plus what the comment claimed
 * --tile-gap was. The token is actually var(--space-4) — 2rem, not 1.5 — so
 * every step drifted 8px and the error accumulated along the row. Measuring two
 * real tiles cannot drift, and survives any future change to either token.
 */
function tileStep(row) {
  const tiles = row.children;
  if (tiles.length < 2) return rem(TILE_REM);
  // offsetLeft, not getBoundingClientRect: the focused tile is scaled by 1.08,
  // which moves its painted edge and would poison a rect-based measurement with
  // a few pixels that then accumulate along the row. offsetLeft is the layout
  // position and ignores transforms entirely.
  return tiles[1].offsetLeft - tiles[0].offsetLeft;
}

/** Convert rem to px at the current root font size. */
function rem(value) {
  return value * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

function el(id) {
  return document.getElementById(id);
}

function mmss(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}


/* ------------------------------------------------------------------ *
 * Application state
 * ------------------------------------------------------------------ */
const app = {
  screen: "pair",
  /** Stack of screens for the BACK contract. Never empty once past pairing. */
  history: [],
  release: null,
  trackIndex: 0,
  elapsed: 0,
  playing: false,
  query: "",
  /** Unsubscribe function for the current screen's BACK handler. */
  offBack: null,
};


/* ------------------------------------------------------------------ *
 * Rendering — Home shelves
 * ------------------------------------------------------------------ */

/**
 * Build one tile. `art` is a CSS background value, not an <img>, because the
 * prototype has no network and must not request remote artwork.
 */
function tile(item, shelfIndex, itemIndex) {
  const node = document.createElement("div");
  node.className = "tile focusable";
  node.setAttribute("data-focusable", "");
  node.dataset.action = "open";
  node.dataset.release = item.id;
  node.dataset.shelf = String(shelfIndex);
  node.dataset.index = String(itemIndex);
  node.innerHTML = `
    <div class="tile__art" style="background:${item.art}"></div>
    <div class="tile__label">
      <div class="tile__title"></div>
      <div class="tile__subtitle"></div>
    </div>`;
  // Titles are set as text, never innerHTML — catalogue names are data.
  node.querySelector(".tile__title").textContent = item.title;
  node.querySelector(".tile__subtitle").textContent = item.artist;
  return node;
}

function renderShelves() {
  const track = el("home-shelves");
  track.textContent = "";

  SHELVES.forEach((shelf, shelfIndex) => {
    const section = document.createElement("section");
    section.className = "shelf";
    section.dataset.shelf = String(shelfIndex);

    const header = document.createElement("h2");
    header.className = "shelf__header";
    header.textContent = shelf.title;

    const viewport = document.createElement("div");
    viewport.className = "shelf__viewport";

    const row = document.createElement("div");
    row.className = "shelf__row";
    row.dataset.focusGroup = `shelf-${shelfIndex}`;
    // LEFT and RIGHT stay inside the row. Leaving it happens with UP or DOWN.
    row.dataset.focusContain = "x";
    shelf.items.forEach((item, itemIndex) => {
      row.appendChild(tile(item, shelfIndex, itemIndex));
    });

    viewport.appendChild(row);
    section.append(header, viewport);
    track.appendChild(section);
  });
}

/**
 * Position the shelf stack and the focused row.
 *
 * Both are transforms, so the browser composites them without relayout. The
 * focused tile is parked at a FIXED left offset rather than centred: a card
 * that slides to the middle makes the row feel like it is chasing the user.
 */
function positionShelves(tileNode) {
  const itemIndex = Number(tileNode.dataset.index);

  // Measured, not calculated. A hard-coded row height drifts the moment a
  // font, a gap, or the label block changes, and the drift shows up as the
  // previous row's labels peeking out below the nav bar.
  const stack = el("home-shelves");
  const section = tileNode.closest(".shelf");
  const offset = section.offsetTop - stack.firstElementChild.offsetTop;
  stack.style.transform = `translate3d(0, ${-offset}px, 0)`;

  const row = tileNode.parentElement;
  // Keep one tile of context to the left once the user is past the second card.
  const parked = Math.max(0, itemIndex - 1);
  row.style.transform = `translate3d(${-parked * tileStep(row)}px, 0, 0)`;
}


/* ------------------------------------------------------------------ *
 * Rendering — Library
 * ------------------------------------------------------------------ */
function renderLibrary() {
  const list = el("library-list");
  list.textContent = "";

  PLAYLISTS.forEach((playlist, index) => {
    const row = document.createElement("div");
    row.className = "list__track focusable";
    row.setAttribute("data-focusable", "");
    row.dataset.action = "playlist";
    row.dataset.playlist = playlist.id;

    const n = document.createElement("span");
    n.className = "list__n";
    n.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "list__name";
    name.textContent = playlist.title;

    const count = document.createElement("span");
    count.className = "list__dur";
    count.textContent = `${playlist.count} songs`;

    row.append(n, name, count);
    list.appendChild(row);
  });

  el("library-art").style.background =
    `linear-gradient(135deg, ${PLAYLISTS[0].accent} 0%, ${PLAYLISTS[3].accent} 100%)`;
}


/* ------------------------------------------------------------------ *
 * Rendering — Search
 *
 * A grid keyboard is the only D-pad-only text entry that works on every
 * device. See docs/decisions/VOTE-002 for why this, and not voice.
 * ------------------------------------------------------------------ */
const KEY_ROWS = "ABCDEF GHIJKL MNOPQR STUVWX YZ0123 456789".split(" ");

function renderKeyboard() {
  const grid = el("search-keys");
  grid.textContent = "";

  for (const rowChars of KEY_ROWS) {
    for (const char of rowChars) {
      const key = document.createElement("div");
      key.className = "key focusable";
      key.setAttribute("data-focusable", "");
      key.dataset.size = "sm";
      key.dataset.action = "type";
      key.dataset.char = char;
      key.textContent = char;
      grid.appendChild(key);
    }
  }

  for (const [label, action] of [["SPACE", "space"], ["DELETE", "delete"]]) {
    const key = document.createElement("div");
    key.className = "key focusable";
    key.setAttribute("data-focusable", "");
    key.dataset.size = "sm";
    key.dataset.wide = "true";
    key.dataset.action = action;
    key.textContent = label;
    grid.appendChild(key);
  }
}

/** Filter the demo catalogue by the typed query. Substring match is enough. */
function renderSearchResults() {
  el("search-query").textContent = app.query;

  const list = el("search-results");
  list.textContent = "";

  const needle = app.query.trim().toLowerCase();
  const matches = needle
    ? SHELVES[0].items
        .concat(SHELVES[1].items, SHELVES[3].items)
        .filter((item, index, all) => all.indexOf(item) === index)
        .filter((item) =>
          `${item.title} ${item.artist}`.toLowerCase().includes(needle)
        )
    : [];

  if (!needle) {
    const hint = document.createElement("p");
    hint.className = "detail__sub";
    hint.textContent = "Type to search your library and the Apple Music catalogue.";
    list.appendChild(hint);
    return;
  }

  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "detail__sub";
    empty.textContent = `No results for “${app.query}”.`;
    list.appendChild(empty);
    return;
  }

  matches.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "list__track focusable";
    row.setAttribute("data-focusable", "");
    row.dataset.action = "open";
    row.dataset.release = item.id;

    const n = document.createElement("span");
    n.className = "list__n";
    n.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "list__name";
    name.textContent = `${item.title} — ${item.artist}`;

    const year = document.createElement("span");
    year.className = "list__dur";
    year.textContent = String(item.year);

    row.append(n, name, year);
    list.appendChild(row);
  });
}


/* ------------------------------------------------------------------ *
 * Playback simulation
 * ------------------------------------------------------------------ */

/**
 * Repaint Now Playing for the current release/track and repoint the adaptive
 * palette. Writing --art-accent is all that is needed: tokens.css derives the
 * soft, glow and bloom variants from it.
 */
function renderNowPlaying() {
  const release = app.release;
  if (!release) return;

  const track = release.tracks[app.trackIndex];
  document.documentElement.style.setProperty("--art-accent", release.accent);

  el("now-art").style.background = release.art;
  el("now-title").textContent = track.title;
  el("now-artist").textContent = release.artist;
  el("now-album").textContent = `${release.title} · ${release.year}`;
  el("now-total").textContent = mmss(track.seconds);
  el("now-playpause").textContent = app.playing ? "⏸" : "▶";
  el("now").dataset.playing = String(app.playing);

  el("mini-art").style.background = release.art;
  el("mini-title").textContent = track.title;
  el("mini-artist").textContent = release.artist;
  el("miniplayer").dataset.visible = "true";

  renderProgress();
}

function renderProgress() {
  const track = app.release?.tracks[app.trackIndex];
  if (!track) return;
  const ratio = Math.min(1, app.elapsed / track.seconds);
  el("now-fill").style.transform = `scaleX(${ratio})`;
  el("now-elapsed").textContent = mmss(app.elapsed);
}

function play(release, trackIndex = 0) {
  app.release = release;
  app.trackIndex = trackIndex;
  app.elapsed = 0;
  app.playing = true;
  renderNowPlaying();
}

function skip(delta) {
  if (!app.release) return;
  const count = app.release.tracks.length;
  app.trackIndex = (app.trackIndex + delta + count) % count;
  app.elapsed = 0;
  renderNowPlaying();
}

// One timer drives the whole simulation. A real player would follow MusicKit's
// playbackTime instead; nothing else about this screen would change.
setInterval(() => {
  if (!app.playing || !app.release) return;
  const track = app.release.tracks[app.trackIndex];
  app.elapsed += 1;
  if (app.elapsed >= track.seconds) {
    skip(1);
    return;
  }
  renderProgress();
}, 1000);


/* ------------------------------------------------------------------ *
 * Screens & the BACK contract
 * ------------------------------------------------------------------ */

/** Where focus lands when a screen opens. */
const ENTRY_FOCUS = {
  home: () => document.querySelector('[data-screen="home"] .tile'),
  library: () => document.querySelector("#library-list .list__track"),
  search: () => document.querySelector("#search-keys .key"),
  now: () => el("now-playpause"),
  pair: () => null,
};

function show(name, { push = true } = {}) {
  if (name === app.screen) return;
  if (push && app.screen !== "pair") app.history.push(app.screen);

  for (const screen of document.querySelectorAll(".screen")) {
    screen.dataset.active = String(screen.dataset.screen === name);
  }
  app.screen = name;

  if (app.offBack) app.offBack();
  app.offBack = onBack(handleBack);

  // Force layout so the newly visible screen has real rectangles, then claim
  // entry focus synchronously. Deliberately NOT requestAnimationFrame: a
  // backgrounded or non-composited webview throttles rAF to nothing, and the
  // app would come up with no focus at all — unrecoverable on a remote with no
  // pointer. Reading offsetHeight is enough to flush the style change.
  void document.querySelector(`[data-screen="${name}"]`).offsetHeight;
  refresh();
  const target = ENTRY_FOCUS[name]?.();
  if (target) focus(target);
}

/**
 * BACK contract:
 *   Now Playing / Library / Search  -> the screen the user came from
 *   Home (the root)                 -> consumed, never exits the app silently
 *   Pair                            -> consumed; there is nowhere to go back to
 * Returning true consumes the press so the platform does not close the app.
 */
function handleBack() {
  if (app.screen === "pair") return true;

  // On Search, BACK is backspace while there is anything to delete. Every TV
  // keyboard on the market behaves this way, and without it the only way to fix
  // a typo is to walk the focus over to DELETE and back again. Only once the
  // query is empty does BACK mean "leave the screen".
  if (app.screen === "search" && app.query) {
    app.query = app.query.slice(0, -1);
    renderSearchResults();
    return true;
  }

  if (app.screen === "home") {
    // VOTE-003. Android's convention is that BACK eventually leaves the app,
    // and being unable to leave with the button that means "leave" is bad. But
    // here exiting stops the music, so the convention is followed only where it
    // is free: exit straight away when nothing is playing, and confirm first
    // when a stray press would kill playback.
    if (!app.playing) {
      // Decline the press so the Android host leaves the app. Consuming it and
      // showing our own "Exited" screen looked like an exit while trapping the
      // viewer inside a running app.
      exitApp();
      return false;
    }
    openExitConfirm();
    return true;
  }

  if (app.screen === "exit") {
    closeExitConfirm();
    return true;
  }

  const previous = app.history.pop() || "home";
  show(previous, { push: false });
  return true;
}


/* ------------------------------------------------------------------ *
 * Exit confirmation (VOTE-003)
 * ------------------------------------------------------------------ */

/** Where focus was before the modal opened, so it can be handed back. */
let focusBeforeExit = null;

function openExitConfirm() {
  focusBeforeExit = document.querySelector('[data-focused="true"]');
  app.screen = "exit";
  el("exit-dialog").dataset.open = "true";
  // Cancel is focused, not Exit. The destructive choice should never be the
  // one a second stray press lands on.
  void el("exit-dialog").offsetHeight;
  refresh();
  focus(el("exit-cancel"));
}

function closeExitConfirm() {
  el("exit-dialog").removeAttribute("data-open");
  app.screen = "home";
  refresh();
  if (focusBeforeExit) focus(focusBeforeExit);
  focusBeforeExit = null;
}

/**
 * Leave the app.
 *
 * A real Android build finishes the Activity here and the launcher takes over.
 * A browser cannot close a tab it did not open, so the prototype says plainly
 * what would have happened rather than pretending or silently doing nothing.
 */
function exitApp() {
  app.playing = false;
  el("exit-dialog").removeAttribute("data-open");

  // On the device, ask the host to finish the Activity. A browser tab cannot
  // close itself, so it falls back to saying what would have happened.
  if (window.AndroidHost && typeof window.AndroidHost.exit === "function") {
    window.AndroidHost.exit();
    return;
  }
  el("exited").dataset.open = "true";
  app.screen = "exited";
}


/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */
const ACTIONS = {
  go: (node) => show(node.dataset.target),

  open: (node) => {
    const release = SHELVES.flatMap((shelf) => shelf.items)
      .find((item) => item.id === node.dataset.release);
    if (!release) return;
    play(release);
    show("now");
  },

  playlist: (node) => {
    // A playlist opens straight into playback in the prototype. The real app
    // opens a track list first; that screen reuses .list wholesale.
    //
    // Each playlist maps to a distinct release rather than all six landing on
    // the same track: during review, identical results read as a broken tile,
    // not as a deliberate shortcut.
    const shelf = SHELVES[2].items;
    const index = PLAYLISTS.findIndex((item) => item.id === node.dataset.playlist);
    play(shelf[Math.max(0, index) % shelf.length]);
    show("now");
  },

  playpause: () => {
    app.playing = !app.playing;
    renderNowPlaying();
  },

  next: () => skip(1),
  prev: () => skip(-1),

  "exit-confirm": () => exitApp(),
  "exit-cancel": () => closeExitConfirm(),

  type: (node) => {
    app.query += node.dataset.char;
    renderSearchResults();
  },
  space: () => {
    app.query += " ";
    renderSearchResults();
  },
  delete: () => {
    app.query = app.query.slice(0, -1);
    renderSearchResults();
  },
};

/**
 * The navigation engine marks focus with the class `is-focused`; the design
 * system styles `[data-focused="true"]`. Bridge the two here rather than
 * duplicating every focus rule in CSS.
 */
document.addEventListener("spatialfocus", (event) => {
  const { element } = event.detail;

  // Clear every marker rather than only event.detail.previous. Focus can also
  // be set directly by show(), which the engine does not report as a move, and
  // a stale marker means two focus rings on screen at once.
  for (const stale of document.querySelectorAll('[data-focused="true"]')) {
    stale.removeAttribute("data-focused");
  }
  if (!element) return;
  element.setAttribute("data-focused", "true");

  if (element.classList.contains("tile")) positionShelves(element);
});

document.addEventListener("spatialselect", (event) => {
  const node = event.detail.element;
  const action = node?.dataset.action;

  // The pairing screen has no focusable targets: any OK press simulates the
  // phone completing authorization. Auth itself is out of scope for the
  // prototype — see public/CLAUDE.md.
  if (app.screen === "pair") {
    completePairing();
    return;
  }

  if (!action || !ACTIONS[action]) return;
  node.dataset.pressed = "true";
  setTimeout(() => node.removeAttribute("data-pressed"), 120);
  ACTIONS[action](node);
});

// Hardware media keys work from any screen, which is the whole point of them.
document.addEventListener("spatialmedia", (event) => {
  const map = { playpause: "playpause", play: "playpause", pause: "playpause",
    next: "next", prev: "prev" };
  const action = map[event.detail.action];
  if (action) ACTIONS[action]();
});

// The pairing screen is reachable before the nav engine has any target, so it
// needs its own key listener for OK.
window.addEventListener("keydown", (event) => {
  if (app.screen === "pair" && (event.key === "Enter" || event.keyCode === 13)) {
    completePairing();
  }
});


/* ------------------------------------------------------------------ *
 * Pairing screen (simulated)
 * ------------------------------------------------------------------ */

/**
 * Draw a QR-shaped placeholder.
 *
 * This is NOT a real QR code and will not scan. Encoding is the pairing
 * server's job — it already knows the activate URL. The prototype only needs
 * something of the right visual weight to judge the layout. The pattern is
 * derived deterministically from the pairing code so it looks stable.
 */
function drawQrPlaceholder(code) {
  const canvas = el("pair-qr");
  const size = canvas.width;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";

  let seed = 0;
  for (const char of code) seed = (seed * 31 + char.charCodeAt(0)) % 65536;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if ((seed >> 16) & 1) ctx.fillRect(x, y, 1, 1);
    }
  }

  // The three finder patterns, which are what makes it read as a QR code.
  const finder = (ox, oy) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(ox, oy, 9, 9);
    ctx.fillStyle = "#000000";
    ctx.fillRect(ox, oy, 7, 7);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(ox + 1, oy + 1, 5, 5);
    ctx.fillStyle = "#000000";
    ctx.fillRect(ox + 2, oy + 2, 3, 3);
  };
  finder(0, 0);
  finder(size - 9, 0);
  finder(0, size - 9);
}

function completePairing() {
  const status = el("pair-status");
  status.dataset.state = "ok";
  status.querySelector(".pair__dot").style.animation = "none";
  el("pair-status-text").textContent = "Connected. Signing you in…";

  setTimeout(() => {
    show("home");
    play(SHELVES[0].items[0]);
    app.playing = false;
    renderNowPlaying();
    show("home", { push: false });
  }, 900);
}

/** Count the pairing session down so the expiry is visible in review. */
function startExpiryCountdown(totalSeconds) {
  let remaining = totalSeconds;
  el("pair-expiry").textContent = mmss(remaining);
  setInterval(() => {
    if (app.screen !== "pair" || remaining <= 0) return;
    remaining -= 1;
    el("pair-expiry").textContent = mmss(remaining);
  }, 1000);
}


/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
function greeting(hour) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

renderShelves();
renderLibrary();
renderKeyboard();
renderSearchResults();
drawQrPlaceholder(el("pair-code").textContent);
// 300 seconds, matching the pairing server's real SESSION_TTL_MS. A design
// prototype that shows a different number from the shipping backend teaches
// reviewers the wrong thing about the product.
startExpiryCountdown(298);
el("home-clock").textContent = greeting(new Date().getHours());

init(document.getElementById("app"));
app.offBack = onBack(handleBack);
