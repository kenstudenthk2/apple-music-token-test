/**
 * Library V2 preview driver.
 *
 * Renders the three item kinds against fake data so the redesign can be judged
 * on a television before it replaces the screen people are using. No network,
 * no token — the artwork is a gradient, exactly as in the design prototype.
 *
 * The point of this harness is the MOTION. Everything it writes is one of the
 * custom properties LIBRARY_V2.md section 10 specifies, so what you see here is
 * what the real implementation will have to write.
 */

import { init, focus, refresh } from "./spatial-nav.js";

const app = document.getElementById("app");
const track = document.querySelector(".shelves__track");
const shelvesBox = document.querySelector(".shelves");

/** Fake content. Real colours come from Apple's Artwork.bgColor. */
const SHELVES = [
  {
    kind: "playlist",
    title: "Playlists",
    items: [
      ["Late Night Drive", "42 songs", "#2b5876", "#4e4376"],
      ["Kitchen Sunday", "28 songs", "#f7971e", "#ffd200"],
      ["Focus, No Words", "61 songs", "#11998e", "#38ef7d"],
      ["Cantopop Forever", "87 songs", "#eb3349", "#f45c43"],
      ["Rainy Window", "35 songs", "#654ea3", "#eaafc8"],
      ["Gym, Reluctantly", "24 songs", "#00c6ff", "#0072ff"],
    ],
  },
  {
    kind: "album",
    title: "Albums",
    items: [
      ["Neon Harbour", "Yuen Kwok", "#ff5f6d", "#ffc371"],
      ["Slow Tide", "Marisol Vane", "#2b5876", "#4e4376"],
      ["Paper Lanterns", "Ito Collective", "#c94b4b", "#4b134f"],
      ["Glass Arcade", "Nova Pike", "#00c6ff", "#0072ff"],
      ["Golden Hour Radio", "The Long Way", "#f7971e", "#ffd200"],
      ["Analog Ghosts", "Kester", "#654ea3", "#eaafc8"],
    ],
  },
  {
    kind: "artist",
    title: "Artists",
    items: [
      ["Ella Langley", "Artist", "#ff5f6d", "#ffc371"],
      ["鄭中基", "Artist", "#f95b23", "#c94b4b"],
      ["Yuen Kwok", "Artist", "#11998e", "#38ef7d"],
      ["2NE1", "Artist", "#eb3349", "#654ea3"],
      ["Marisol Vane", "Artist", "#2b5876", "#4e4376"],
      ["Ito Collective", "Artist", "#141e30", "#243b55"],
    ],
  },
];

function tile(kind, [title, subtitle, from, to], index) {
  const node = document.createElement("div");
  node.className = "tile focusable";
  node.setAttribute("data-focusable", "");
  node.dataset.kind = kind;
  node.dataset.enter = "1";
  node.style.setProperty("--i", String(index));
  node.dataset.index = String(index);
  node.__accent = from;

  // Albums carry the record that peeks out from behind the sleeve. It is the
  // same material as the turntable on Now Playing — one product, not two.
  if (kind === "album") {
    const disc = document.createElement("span");
    disc.className = "tile__disc";
    node.appendChild(disc);
  }

  const art = document.createElement("div");
  art.className = "tile__art";
  art.style.background = `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;

  const label = document.createElement("div");
  label.className = "tile__label";
  const t = document.createElement("div");
  t.className = "tile__title";
  t.textContent = title;
  const s = document.createElement("div");
  s.className = "tile__subtitle";
  s.textContent = subtitle;
  label.append(t, s);

  node.append(art, label);
  return node;
}

for (const [shelfIndex, shelf] of SHELVES.entries()) {
  const section = document.createElement("section");
  section.className = "shelf";
  section.dataset.kind = shelf.kind;
  if (shelfIndex === 0) section.dataset.active = "true";

  const header = document.createElement("header");
  header.className = "shelf__header";
  header.textContent = shelf.title + " ";
  const count = document.createElement("span");
  count.className = "shelf__count";
  count.textContent = String(shelf.items.length);
  header.appendChild(count);

  const viewport = document.createElement("div");
  viewport.className = "shelf__viewport";
  const row = document.createElement("div");
  row.className = "shelf__row";
  row.dataset.focusContain = "x";
  shelf.items.forEach((item, i) => row.appendChild(tile(shelf.kind, item, i)));

  viewport.appendChild(row);
  section.append(header, viewport);
  track.appendChild(section);
}

/**
 * Position the stack and the row.
 *
 * Each custom property is read by exactly one element's own transform, never by
 * a child — the per-child style-recalc trap the motion research warns about.
 */
function position(node) {
  const section = node.closest(".shelf");
  const row = node.parentElement;

  for (const s of document.querySelectorAll(".shelf")) {
    s.dataset.active = String(s === section);
  }

  const offset = section.offsetTop - track.firstElementChild.offsetTop;
  track.style.setProperty("--shelf-y", `${-offset}px`);

  // Centre-parked, matching live-app.js exactly. If this harness parked
  // differently from the shipped screen it would be reviewing a product that
  // does not exist.
  const tiles = row.children;
  const step = tiles.length > 1
    ? tiles[1].offsetLeft - tiles[0].offsetLeft
    : node.offsetWidth;
  const viewport = row.parentElement.getBoundingClientRect().width;
  const wanted = (Number(node.dataset.index) || 0) * step
    + node.offsetWidth / 2 - viewport / 2;
  const maxScroll = Math.max(0, step * tiles.length - viewport);
  row.style.setProperty("--row-x", `${-Math.min(Math.max(0, wanted), maxScroll)}px`);
}

/** Tell the stylesheet which axis is moving, so it can bias its easing. */
let movingTimer = null;
function flagMovement(axis) {
  shelvesBox.dataset.moving = axis;
  clearTimeout(movingTimer);
  movingTimer = setTimeout(() => { shelvesBox.dataset.moving = "none"; }, 260);
}

let lastRow = null;

document.addEventListener("spatialfocus", (event) => {
  for (const stale of document.querySelectorAll('[data-focused="true"]')) {
    stale.removeAttribute("data-focused");
  }
  const node = event.detail.element;
  if (!node || !node.classList.contains("tile")) return;

  node.setAttribute("data-focused", "true");
  flagMovement(node.parentElement === lastRow ? "h" : "v");
  lastRow = node.parentElement;

  position(node);

  // The whole screen takes its accent from whatever is selected, which is what
  // makes a library feel like it belongs to one person rather than to a grid.
  if (node.__accent) {
    document.querySelector('[data-screen="library"]')
      .style.setProperty("--art-accent", node.__accent);
  }
});

document.addEventListener("spatialselect", (event) => {
  const node = event.detail.element;
  if (!node) return;
  node.dataset.pressed = "true";
  setTimeout(() => node.removeAttribute("data-pressed"), 140);
  // Forward navigation biases the screen transition; back reverses it.
  app.dataset.nav = "forward";
});

// Let the entry stagger play before the first focus lands, so the two are not
// competing for the same frames.
refresh();
init(document.getElementById("app"));
const first = document.querySelector(".tile");
if (first) focus(first);
