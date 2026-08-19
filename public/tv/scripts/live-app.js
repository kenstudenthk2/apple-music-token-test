/**
 * AppleTune TV — live application.
 *
 * The reviewed design system, driven by the real Apple Music API. Kept apart
 * from the prototype (`scripts/app.js`, `demo-data.js`) on purpose: the
 * prototype must keep rendering with the network switched off so it stays
 * reviewable as a single file, and this one cannot exist without a token.
 *
 * The Music User Token lives in memory and in sessionStorage for the lifetime
 * of the page. It is never written to a file here, never placed in a URL, and
 * never rendered. Persisting it across app restarts is gate G5 work and an auth
 * decision — see docs/decisions/ESCALATION-003.
 */

import { createClient, artworkUrl } from "./api.js";
import { createPlayer } from "./player.js";
import { init, focus, onBack, refresh } from "./spatial-nav.js";
import { draw as drawQr } from "./qr.js";

const el = (id) => document.getElementById(id);
const mmss = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor(s || 0) % 60).padStart(2, "0")}`;

const app = {
  screen: "boot",
  history: [],
  client: null,
  player: null,
  detail: null,
  query: "",
  /** Where focus was on each screen, so returning feels like going back. */
  focusMemory: new Map(),
};


/* ------------------------------------------------------------------ *
 * Screens
 * ------------------------------------------------------------------ */

/** Where focus lands when a screen opens, if nothing is remembered. */
const ENTRY_FOCUS = {
  home: () => document.querySelector('[data-screen="home"] .tile'),
  library: () => document.querySelector("#library-shelves .tile"),
  search: () => document.querySelector("#search-keys .key"),
  detail: () => document.querySelector("#detail-list .list__track"),
  now: () => el("now-playpause"),
  boot: () => null,
};

function show(name, { push = true } = {}) {
  if (name === app.screen) return;

  const current = document.querySelector('[data-focused="true"]');
  if (current && app.screen !== "boot") app.focusMemory.set(app.screen, current);
  if (push && app.screen !== "boot") app.history.push(app.screen);

  for (const screen of document.querySelectorAll(".screen")) {
    screen.dataset.active = String(screen.dataset.screen === name);
  }
  app.screen = name;

  for (const item of document.querySelectorAll(".nav__item[data-target]")) {
    item.dataset.current = String(item.dataset.target === name);
  }

  // Synchronous, not requestAnimationFrame: a non-composited or backgrounded
  // webview throttles rAF to nothing and the app would come up with no focus at
  // all — unrecoverable on a remote with no pointer.
  void document.querySelector(`[data-screen="${name}"]`).offsetHeight;
  refresh();

  const remembered = app.focusMemory.get(name);
  const target = remembered && remembered.isConnected ? remembered : ENTRY_FOCUS[name]?.();
  if (target) focus(target);
}


/* ------------------------------------------------------------------ *
 * Artwork and palette
 * ------------------------------------------------------------------ */

/**
 * Apply an item's palette.
 *
 * Library items carry no colours — Apple ships bgColor/textColor on CATALOG
 * artwork only, which live data revealed. A null palette means "keep the design
 * system's own accent", never "invent one".
 */
function applyPalette(item) {
  const accent = item?.palette?.background;
  if (accent) {
    document.documentElement.style.setProperty("--art-accent", accent);
  } else {
    document.documentElement.style.removeProperty("--art-accent");
  }
}

/* ------------------------------------------------------------------ *
 * Artwork diagnostics (?diag=1)
 *
 * "Some covers do not load" cannot be debugged from a sofa, and logcat needs
 * adb set up. This records every attempt and draws the result on the
 * television, so the answer is a photograph rather than another guess.
 * ------------------------------------------------------------------ */
const DIAG = new URLSearchParams(location.search).get("diag") === "1";
const artworkLog = [];

function renderDiag() {
  if (!DIAG) return;
  let panel = el("diag");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "diag";
    panel.style.cssText =
      "position:fixed;left:2vw;top:2vh;width:96vw;max-height:96vh;overflow:auto;z-index:9999;" +
      "background:#06060Aee;color:#F5F6F8;font:1vw/1.4 ui-monospace,Consolas,monospace;" +
      "padding:1.5vh 1.5vw;border-radius:8px";
    document.body.appendChild(panel);
  }

  const failed = artworkLog.filter((a) => a.status === "FAIL");
  const pending = artworkLog.filter((a) => a.status === "…");
  const loaded = artworkLog.length - failed.length - pending.length;

  panel.textContent = "";
  const head = document.createElement("div");
  head.style.cssText = "font-size:1.6vw;font-weight:700;margin-bottom:.6em";
  head.textContent = `Artwork: ${loaded} loaded · ${failed.length} failed · ${pending.length} pending`;
  panel.appendChild(head);

  // Failures first — nobody photographs the successes.
  const ordered = [...failed, ...artworkLog.filter((a) => a.status !== "FAIL")];
  for (const entry of ordered.slice(0, 40)) {
    const row = document.createElement("div");
    row.style.color = entry.status === "FAIL" ? "#FF453A" : "#9AA0AA";
    row.style.padding = ".15em 0";
    row.style.wordBreak = "break-all";
    row.textContent = `${entry.status}  ${entry.title}  ${entry.url}`;
    panel.appendChild(row);
  }
}

/**
 * Build an <img> as a node. Artwork URLs are data; never interpolate them.
 *
 * Deliberately NOT lazy-loaded. Shelves are moved with transforms, and the
 * viewport intersection that drives lazy loading does not follow a transformed
 * ancestor reliably — tiles to the right and below simply never loaded their
 * artwork. Forty-eight covers at tile size is a small price for artwork that
 * predictably appears, and predictability is worth more on a television than
 * saved bandwidth.
 *
 * A failed load removes the element rather than leaving a broken-image glyph;
 * the tile's own surface colour is a perfectly good placeholder.
 */
function artNode(item, size) {
  const url = artworkUrl(item?.artwork, size * (window.devicePixelRatio || 1));
  if (!url) {
    if (DIAG && item) {
      artworkLog.push({
        status: "NONE",
        title: (item.title || "").slice(0, 24),
        url: "(the API returned no artwork for this item)",
      });
      renderDiag();
    }
    return null;
  }

  const entry = { status: "…", title: (item?.title || "").slice(0, 24), url };
  if (DIAG) artworkLog.push(entry);

  const img = document.createElement("img");
  img.alt = "";
  img.decoding = "async";
  img.addEventListener("error", () => {
    // Named, not counted. MainActivity mirrors console output into logcat, and
    // ?diag=1 puts the same thing on screen for anyone without adb.
    console.warn(`[live] artwork failed: ${url}`);
    entry.status = "FAIL";
    renderDiag();
    img.remove();
  }, { once: true });
  img.addEventListener("load", () => {
    entry.status = "OK";
    renderDiag();
  }, { once: true });
  img.src = url;
  return img;
}

function fillArt(container, item, size) {
  container.textContent = "";
  const img = artNode(item, size);
  if (img) container.appendChild(img);
}


/**
 * Let the focused item scroll its title, but only if it actually overflows.
 *
 * At three metres a truncated title is unreadable, and an ellipsis gives the
 * viewer nothing to act on. Measured per focus change rather than up front,
 * because the answer depends on the rendered font and the item's width.
 *
 * The distance and the duration are written as custom properties so a long
 * title does not scroll faster than a short one — constant speed, not constant
 * duration.
 */
function markOverflowingTitle(node) {
  const title = node.querySelector(".tile__title, .list__name");
  if (!title) return;

  const overflow = title.scrollWidth - title.clientWidth;
  if (overflow <= 4) {
    title.removeAttribute("data-marquee");
    return;
  }
  title.dataset.marquee = "true";
  title.style.setProperty("--marquee-shift", `${-overflow}px`);
  // ~60px per second, plus the holds at each end.
  title.style.setProperty("--marquee-dur", `${(overflow / 60) * 2 + 4}s`);
}


/* ------------------------------------------------------------------ *
 * Home
 * ------------------------------------------------------------------ */

function tile(item, shelfIndex, itemIndex) {
  const node = document.createElement("div");
  node.className = "tile focusable";
  node.setAttribute("data-focusable", "");
  node.dataset.action = "open";
  node.dataset.shelf = String(shelfIndex);
  node.dataset.index = String(itemIndex);

  const art = document.createElement("div");
  art.className = "tile__art";
  const img = artNode(item, 288);
  if (img) art.appendChild(img);

  const labels = document.createElement("div");
  labels.className = "tile__label";
  const title = document.createElement("div");
  title.className = "tile__title";
  title.textContent = item.title;
  const subtitle = document.createElement("div");
  subtitle.className = "tile__subtitle";
  subtitle.textContent = item.artist;
  labels.append(title, subtitle);

  node.append(art, labels);
  node.__item = item;
  return node;
}

function renderShelves(shelves) {
  const track = el("home-shelves");
  track.textContent = "";

  shelves.forEach((shelf, shelfIndex) => {
    if (!shelf.items.length) return;
    const section = document.createElement("section");
    section.className = "shelf";

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
    shelf.items.forEach((item, i) => row.appendChild(tile(item, shelfIndex, i)));

    viewport.appendChild(row);
    section.append(header, viewport);
    track.appendChild(section);
  });
}

function positionShelves(node) {
  const stack = el("home-shelves");
  const section = node.closest(".shelf");
  if (!section || !stack.firstElementChild) return;
  stack.style.transform =
    `translate3d(0, ${-(section.offsetTop - stack.firstElementChild.offsetTop)}px, 0)`;

  // Measured, not assumed. The hard-coded 19.5rem here was wrong — --tile-gap is
  // var(--space-4), which is 2rem, not 1.5 — so every step drifted 8px and the
  // error accumulated the further along a row the viewer travelled.
  const row = node.parentElement;
  const tiles = row.children;
  // offsetLeft, not getBoundingClientRect: the focused tile is scaled by 1.08,
  // which moves its painted edge and would poison the measurement.
  const step = tiles.length > 1
    ? tiles[1].offsetLeft - tiles[0].offsetLeft
    : node.offsetWidth;
  const parked = Math.max(0, Number(node.dataset.index) - 1);
  row.style.transform = `translate3d(${-parked * step}px, 0, 0)`;
}


/* ------------------------------------------------------------------ *
 * List rows — shared by Library, Search results and the track list
 * ------------------------------------------------------------------ */

function listRow({ index, name, meta, action, item }) {
  const row = document.createElement("div");
  row.className = "list__track focusable";
  row.setAttribute("data-focusable", "");
  row.dataset.action = action;

  const n = document.createElement("span");
  n.className = "list__n";
  n.textContent = String(index);

  const label = document.createElement("span");
  label.className = "list__name";
  label.textContent = name;

  const right = document.createElement("span");
  right.className = "list__dur";
  right.textContent = meta;

  row.append(n, label, right);
  row.__item = item;
  return row;
}

function renderList(container, items, { action, meta }) {
  container.textContent = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "detail__sub";
    empty.textContent = "Nothing here yet.";
    container.appendChild(empty);
    return;
  }
  items.forEach((item, i) => {
    container.appendChild(listRow({
      index: i + 1,
      name: item.title,
      meta: meta(item),
      action,
      item,
    }));
  });
}


/* ------------------------------------------------------------------ *
 * Library
 * ------------------------------------------------------------------ */

/**
 * One library tile.
 *
 * `data-kind` is what the stylesheet reads to give each kind its silhouette: a
 * stack for a playlist, a record poking out for an album, a circle for an
 * artist. That is the only thing that survives at three metres — colour on
 * arbitrary artwork does not, and nobody reads a label from the sofa.
 */
function libraryTile(item, kind, index) {
  const node = document.createElement("div");
  node.className = "tile focusable";
  node.setAttribute("data-focusable", "");
  node.dataset.focusable = "";
  node.dataset.kind = kind;
  node.dataset.action = kind === "artist" ? "noop" : "detail";
  node.dataset.index = String(index);

  /*
   * The entry animation opts IN, and opts out again when it is done.
   *
   * `animation-fill-mode: both` makes an animation's final value outrank every
   * style rule for as long as the animation is attached. Leaving data-enter on
   * meant the keyframe's `translate3d(0,0,0)` permanently beat the focus rule's
   * scale — the focused tile stopped growing at all, and navigation was reading
   * geometry that no longer matched what the design intended.
   *
   * Only the first six tiles animate, as the stylesheet's own note specifies;
   * beyond that the stagger is invisible and the cost is not.
   */
  if (index < 6) {
    node.dataset.enter = "1";
    node.addEventListener("animationend", () => {
      node.removeAttribute("data-enter");
    }, { once: true });
  }
  // Read once per tile by the entry stagger; never re-read.
  node.style.setProperty("--i", String(index));

  // The album's record is the same object as the turntable's, down to the
  // material tokens. Focus an album, see a sliver; press OK, see the whole one.
  if (kind === "album") {
    const disc = document.createElement("span");
    disc.className = "tile__disc";
    node.appendChild(disc);
  }

  const art = document.createElement("div");
  art.className = "tile__art";
  const img = artNode(item, 240);
  if (img) art.appendChild(img);

  const label = document.createElement("div");
  label.className = "tile__label";
  const title = document.createElement("div");
  title.className = "tile__title";
  title.textContent = item.title;
  const subtitle = document.createElement("div");
  subtitle.className = "tile__subtitle";
  subtitle.textContent =
    kind === "playlist" ? (item.trackCount ? `${item.trackCount} songs` : "Playlist")
    : kind === "artist" ? "Artist"
    : item.artist || "";
  label.append(title, subtitle);

  node.append(art, label);
  node.__item = item;
  return node;
}

function renderLibraryShelves(shelves) {
  const track = el("library-shelves");
  track.textContent = "";

  shelves.forEach((shelf, shelfIndex) => {
    if (!shelf.items.length) return;

    const section = document.createElement("section");
    section.className = "shelf";
    section.dataset.kind = shelf.kind;
    if (shelfIndex === 0) section.dataset.active = "true";

    const header = document.createElement("header");
    header.className = "shelf__header";
    header.textContent = `${shelf.title} `;
    const count = document.createElement("span");
    count.className = "shelf__count";
    count.textContent = String(shelf.items.length);
    header.appendChild(count);

    const viewport = document.createElement("div");
    viewport.className = "shelf__viewport";
    const row = document.createElement("div");
    row.className = "shelf__row";
    row.dataset.focusGroup = `library-${shelf.kind}`;
    row.dataset.focusContain = "x";
    shelf.items.forEach((item, i) => row.appendChild(libraryTile(item, shelf.kind, i)));

    viewport.appendChild(row);
    section.append(header, viewport);
    track.appendChild(section);
  });
}

/**
 * Move the library stack and the active row.
 *
 * Each value is written as a custom property read by exactly ONE element's own
 * transform — never by a child. A property read by many children forces a
 * style recalculation per child on every move, which is the trap
 * MOTION_RESEARCH.md section 6 warns about.
 */
function positionLibrary(node) {
  const track = el("library-shelves");
  const section = node.closest(".shelf");
  const row = node.parentElement;
  if (!section || !track.firstElementChild) return;

  for (const shelf of track.children) {
    shelf.dataset.active = String(shelf === section);
  }

  const offset = section.offsetTop - track.firstElementChild.offsetTop;
  track.style.setProperty("--shelf-y", `${-offset}px`);

  const tiles = row.children;
  const step = tiles.length > 1
    ? tiles[1].offsetLeft - tiles[0].offsetLeft
    : node.offsetWidth;
  const parked = Math.max(0, Number(node.dataset.index) - 1);
  row.style.setProperty("--row-x", `${-parked * step}px`);
}

/** Tell the stylesheet which axis is moving so it can bias its easing. */
let libraryMoveTimer = null;
let lastLibraryRow = null;
function flagLibraryMovement(row) {
  const box = document.querySelector('[data-screen="library"] .shelves');
  if (!box) return;
  box.dataset.moving = row === lastLibraryRow ? "h" : "v";
  lastLibraryRow = row;
  clearTimeout(libraryMoveTimer);
  libraryMoveTimer = setTimeout(() => { box.dataset.moving = "none"; }, 280);
}

async function openLibrary() {
  show("library");
  el("library-sub").textContent = "Loading…";

  // Three requests in parallel: a slow shelf must not hold up the other two.
  const settle = (p) => p.then((v) => v, () => []);
  const [playlists, albums, artists] = await Promise.all([
    settle(app.client.libraryPlaylists(25)),
    settle(app.client.libraryAlbums(25)),
    settle(app.client.libraryArtists(25)),
  ]);

  renderLibraryShelves([
    { kind: "playlist", title: "Playlists", items: playlists },
    { kind: "album", title: "Albums", items: albums },
    { kind: "artist", title: "Artists", items: artists },
  ]);

  el("library-sub").textContent =
    `${playlists.length} playlists · ${albums.length} albums · ${artists.length} artists`;

  refresh();
  const first = el("library-shelves").querySelector(".tile");
  if (first) focus(first);
}


/* ------------------------------------------------------------------ *
 * Detail — the track list for one album or playlist
 * ------------------------------------------------------------------ */

async function openDetail(item) {
  app.detail = item;
  show("detail");

  el("detail-title").textContent = item.title;
  el("detail-sub").textContent = item.artist || "";
  fillArt(el("detail-art"), item, 416);
  applyPalette(item);

  const list = el("detail-list");
  list.textContent = "Loading…";

  let tracks = [];
  try {
    tracks = await app.client.tracks(item);
  } catch (error) {
    list.textContent = `Could not load tracks: ${error.message}`;
    return;
  }

  renderList(list, tracks, {
    action: "play-track",
    meta: (track) => mmss((track.durationMs || 0) / 1000),
  });
  el("detail-sub").textContent =
    `${item.artist ? item.artist + " · " : ""}${tracks.length} songs`;

  refresh();
  const first = list.querySelector(".list__track");
  if (first) focus(first);
}


/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

const KEY_ROWS = "ABCDEF GHIJKL MNOPQR STUVWX YZ0123 456789".split(" ");

function renderKeyboard() {
  const grid = el("search-keys");
  grid.textContent = "";

  const key = (label, dataset) => {
    const node = document.createElement("div");
    node.className = "key focusable";
    node.setAttribute("data-focusable", "");
    node.dataset.size = "sm";
    Object.assign(node.dataset, dataset);
    node.textContent = label;
    return node;
  };

  for (const row of KEY_ROWS) {
    for (const char of row) grid.appendChild(key(char, { action: "type", char }));
  }
  grid.appendChild(key("SPACE", { action: "space", wide: "true" }));
  grid.appendChild(key("DELETE", { action: "delete", wide: "true" }));
}

/**
 * Search is debounced because every keystroke is a network round trip, and on a
 * D-pad a "keystroke" is several button presses — firing a request per letter
 * would queue requests faster than a TV can retire them.
 */
let searchTimer = null;
function scheduleSearch() {
  el("search-query").textContent = app.query;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 350);
}

async function runSearch() {
  const list = el("search-results");
  const term = app.query.trim();

  if (!term) {
    list.textContent = "";
    const hint = document.createElement("p");
    hint.className = "detail__sub";
    hint.textContent = "Type to search Apple Music.";
    list.appendChild(hint);
    return;
  }

  let results = [];
  try {
    results = await app.client.search(term, 12);
  } catch (error) {
    list.textContent = `Search failed: ${error.message}`;
    return;
  }
  // A slower earlier request must not overwrite a newer query's results.
  if (term !== app.query.trim()) return;

  renderList(list, results, {
    action: "detail",
    meta: (item) => item.artist || item.year || "",
  });
  refresh();
}


/* ------------------------------------------------------------------ *
 * Playback
 * ------------------------------------------------------------------ */

/**
 * Drive the turntable.
 *
 * Everything the stylesheet needs arrives as a custom property or an attribute,
 * so this function never touches a transform directly and the CSS owns all the
 * motion. The contract is NOW_PLAYING_V2.md sections 8 and 9.
 */
function renderNowPlaying(state) {
  const now = el("now");
  const ratio = state.duration ? Math.min(1, state.position / state.duration) : 0;

  // `starting` exists so the record can spin up rather than snapping to speed.
  // It is transient: the stylesheet's spin-up animation runs once and the state
  // settles to `playing`.
  const next = state.playing
    ? (now.dataset.state === "stopped" || now.dataset.state === "paused" ? "starting" : "playing")
    : (state.position > 0 ? "paused" : "stopped");

  if (next !== now.dataset.state) {
    now.dataset.state = next;
    if (next === "starting") {
      setTimeout(() => {
        if (now.dataset.state === "starting") now.dataset.state = "playing";
      }, 1000);
    }
  }

  now.style.setProperty("--now-progress", String(ratio));
  // One rotation bound to elapsed time. The arm tracking inward is what makes
  // the disc read as playing rather than merely spinning.
  now.style.setProperty("--now-arm-track", String(ratio));

  el("now-playpause").textContent = state.playing ? "⏸" : "▶";
  el("now-elapsed").textContent = mmss(state.position);
  el("now-total").textContent = mmss(state.duration);

  if (!state.item) return;
  el("now-title").textContent = state.item.title;
  el("now-artist").textContent = state.item.artist;
  el("now-album").textContent = state.item.album;
  el("mini-title").textContent = state.item.title;
  el("mini-artist").textContent = state.item.artist;
  el("miniplayer").dataset.visible = "true";

  // The sleeve carries the artwork; the label is paper coloured from Apple's
  // own palette. Never the artwork in a circle.
  fillArt(el("now-art"), state.item, 560);
  fillArt(el("mini-art"), state.item, 96);
  applyPalette(state.item);
  applyLabelColours(state.item);
  // A record label is a small circle. A long album name wraps into an
  // unreadable knot there — "正宗K (新曲+精選)" became four stacked fragments.
  // The full name is already on the right-hand column at full size, so the
  // label carries a short form and nothing is lost.
  const labelText = state.item.album || "Apple Music";
  el("now-label-line").textContent =
    labelText.length > 14 ? `${labelText.slice(0, 13)}…` : labelText;
}

/**
 * Colour the paper label from Apple's own palette.
 *
 * Falls back to the design system's surfaces when Apple sent no colours, which
 * is every library item — catalog artwork carries bgColor, library artwork does
 * not.
 */
function applyLabelColours(item) {
  const now = el("now");
  const palette = item?.palette;
  if (palette?.background) {
    now.style.setProperty("--label-bg", palette.background);
    now.style.setProperty("--label-ink", palette.primary || "#FFFFFF");
  } else {
    now.style.removeProperty("--label-bg");
    now.style.removeProperty("--label-ink");
  }
}

async function ensurePlayer(credentials) {
  if (app.player) return app.player;
  app.player = await createPlayer({ ...credentials, onChange: renderNowPlaying });
  return app.player;
}

async function playItem(item, credentials, source) {
  applyPalette(item);
  el("now-source").textContent = source;
  show("now");
  try {
    const player = await ensurePlayer(credentials);
    await player.play(item.play);
  } catch (error) {
    el("now-source").textContent = `Could not play: ${error.message}`;
  }
}


/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */

function wireInput(credentials) {
  document.addEventListener("spatialfocus", (event) => {
    for (const stale of document.querySelectorAll('[data-focused="true"]')) {
      stale.removeAttribute("data-focused");
    }
    const node = event.detail.element;
    if (!node) return;
    node.setAttribute("data-focused", "true");
    markOverflowingTitle(node);
    if (node.classList.contains("tile")) {
      // Home and Library both use tiles but move different stacks.
      if (app.screen === "library") {
        flagLibraryMovement(node.parentElement);
        positionLibrary(node);
      } else {
        positionShelves(node);
      }
      applyPalette(node.__item);
    }
  });

  document.addEventListener("spatialselect", async (event) => {
    const node = event.detail.element;
    const action = node?.dataset.action;
    if (!action) return;

    node.dataset.pressed = "true";
    setTimeout(() => node.removeAttribute("data-pressed"), 120);

    try {
      switch (action) {
        case "go":
          if (node.dataset.target === "library") await openLibrary();
          else if (node.dataset.target === "search") { show("search"); runSearch(); }
          else show("home");
          break;

        // A tile is an album or playlist: open it rather than guessing which
        // track the viewer meant. A song tile has nothing to open, so it plays.
        case "open":
          if (node.__item.type.includes("song")) {
            await playItem(node.__item, credentials, "Playing");
          } else {
            await openDetail(node.__item);
          }
          break;

        case "detail":
          await openDetail(node.__item);
          break;

        case "play-track":
          await playItem(node.__item, credentials,
            app.detail ? `Playing from ${app.detail.title}` : "Playing");
          break;

        case "playpause": if (app.player) await app.player.toggle(); break;
        case "next":      if (app.player) await app.player.next(); break;
        case "prev":      if (app.player) await app.player.previous(); break;

        case "type":   app.query += node.dataset.char; scheduleSearch(); break;
        case "space":  app.query += " "; scheduleSearch(); break;
        case "delete": app.query = app.query.slice(0, -1); scheduleSearch(); break;
      }
    } catch (error) {
      el("now-source").textContent = `Error: ${error.message}`;
    }
  });

  document.addEventListener("spatialmedia", async (event) => {
    if (!app.player) return;
    const action = event.detail.action;
    if (action === "playpause" || action === "play" || action === "pause") await app.player.toggle();
    if (action === "next") await app.player.next();
    if (action === "prev") await app.player.previous();
  });

  onBack(() => {
    // Search: BACK is backspace while there is anything to delete. Every TV
    // keyboard behaves this way, and without it fixing a typo means walking the
    // focus over to DELETE and back.
    if (app.screen === "search" && app.query) {
      app.query = app.query.slice(0, -1);
      scheduleSearch();
      return true;
    }
    if (app.screen === "boot") return true;

    // Home is the root. Returning TRUE here told the Android host "handled" and
    // the host then did nothing — which trapped the viewer inside the app with
    // no way out. Returning false hands BACK back to the host, which walks the
    // WebView history (to the launcher) or finishes the Activity. VOTE-003 asks
    // for exactly this when nothing is playing.
    if (app.screen === "home") return false;
    show(app.history.pop() || "home", { push: false });
    return true;
  });
}


/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

function status(message, isError = false) {
  el("boot-status").textContent = message;
  el("boot-status").classList.toggle("boot__error", isError);
}

/** Pair with the phone, or reuse this page session's token. */
async function obtainUserToken() {
  const cached = sessionStorage.getItem("mut");
  if (cached) return cached;

  const session = await fetch("/api/session", { method: "POST" }).then((r) => r.json());
  el("boot-title").textContent = "Scan to connect";
  el("boot-url").textContent = session.activate_url;
  el("boot-code").textContent = session.user_code;

  // A real, scannable code. The prototype drew a placeholder pattern that could
  // never scan, and the first live build had no QR at all — the screen said
  // "scan to connect" and gave the viewer nothing to scan.
  try {
    drawQr(el("boot-qr"), session.activate_url);
    el("boot-qr-panel").hidden = false;
  } catch (error) {
    // A code that will not render must not hide the URL underneath it.
    el("boot-qr-panel").hidden = true;
    console.error("[live] QR render failed", error);
  }

  status("Waiting for your phone…");

  const deadline = Date.now() + session.expires_in * 1000;
  while (Date.now() < deadline) {
    const response = await fetch("/api/session/token", {
      headers: { Authorization: `Bearer ${session.device_code}` },
    });
    if (response.status === 404) throw new Error("The pairing session expired. Reload to try again.");
    const body = await response.json();
    if (body.status === "authorized") {
      // sessionStorage, not localStorage: this survives a reload but not a
      // restart. Persisting across restarts is an auth decision — see
      // docs/decisions/ESCALATION-003.
      sessionStorage.setItem("mut", body.musicUserToken);
      return body.musicUserToken;
    }
    await new Promise((r) => setTimeout(r, (session.interval || 2) * 1000));
  }
  throw new Error("Timed out waiting for authorization.");
}

function greeting(hour) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

async function main() {
  try {
    status("Fetching developer token…");
    const { developerToken } = await fetch("/api/developer-token").then((r) => r.json());
    const musicUserToken = await obtainUserToken();
    const credentials = { developerToken, musicUserToken };

    status("Loading your music…");
    app.client = createClient({
      developerToken,
      musicUserToken,
      // Only fires when a catalog call still succeeds, so this really is the
      // listener's token and not ours. api.js checks before accusing anyone.
      onAuthLost: () => {
        sessionStorage.removeItem("mut");
        show("boot");
        el("boot-title").textContent = "Sign in again";
        status("Your Apple Music session expired. Reload to pair again.", true);
      },
    });

    // In parallel: on a TV the wait is the first thing anybody judges, and a
    // single slow shelf must not hold up the other three.
    const settle = (p) => p.then((v) => v, () => []);
    const [recent, recommended, playlists, albums] = await Promise.all([
      settle(app.client.recentlyPlayed(12)),
      settle(app.client.recommendations(12)),
      settle(app.client.libraryPlaylists(12)),
      settle(app.client.libraryAlbums(12)),
    ]);

    renderShelves([
      { title: "Recently Played", items: recent },
      { title: "Made For You", items: recommended.slice(0, 12) },
      { title: "Your Playlists", items: playlists },
      { title: "Your Albums", items: albums },
    ]);
    renderKeyboard();
    runSearch();
    el("home-clock").textContent = greeting(new Date().getHours());

    wireInput(credentials);
    show("home");
    init(document.getElementById("app"));
    const first = document.querySelector(".tile");
    if (first) focus(first);
  } catch (error) {
    el("boot-title").textContent = "Could not start";
    status(error.message, true);
  }
}

main();
