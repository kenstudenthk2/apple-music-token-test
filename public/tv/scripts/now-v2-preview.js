/**
 * Preview driver. Simulates playback so the motion can be judged without a
 * token, a network, or a working pairing session.
 */
import { init, focus } from "./spatial-nav.js";

const now = document.getElementById("now");
const DURATION = 218;
let position = 0;
let playing = false;

// Stand-in artwork. The real screen uses Apple's own image and bgColor.
const ACCENT = "#ff5f6d";
document.documentElement.style.setProperty("--art-accent", ACCENT);
document.documentElement.style.setProperty("--label-bg", ACCENT);
document.documentElement.style.setProperty("--label-ink", "#2a0a0c");
// The sleeve carries the full, uncropped square artwork. The label is left as
// the design specifies — a plain paper disc coloured from Apple's own bgColor —
// because a circular crop of the artwork is still a crop, and the guidelines do
// not allow it. Filling the label with the art here was my error, not the
// design's.
document.getElementById("sleeve").style.background =
  `linear-gradient(135deg, ${ACCENT} 0%, #ffc371 100%)`;

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function render() {
  const ratio = Math.min(1, position / DURATION);
  now.style.setProperty("--now-progress", String(ratio));
  // The tonearm tracks inward across the record as the song plays, which is the
  // single detail that makes the disc read as playing rather than spinning.
  now.style.setProperty("--now-arm-track", String(ratio));
  document.getElementById("elapsed").textContent = mmss(position);
  document.getElementById("total").textContent = mmss(DURATION);
  document.getElementById("playpause").textContent = playing ? "⏸" : "▶";
  now.dataset.state = playing ? "playing" : (position > 0 ? "paused" : "stopped");
}

function toggle() {
  playing = !playing;
  render();
}

setInterval(() => {
  if (!playing) return;
  position = Math.min(DURATION, position + 1);
  render();
}, 1000);

document.addEventListener("spatialselect", (event) => {
  const action = event.detail.element?.dataset.action;
  if (action === "playpause") toggle();
  if (action === "next") { position = 0; render(); }
  if (action === "prev") { position = 0; render(); }
});

document.addEventListener("spatialfocus", (event) => {
  for (const stale of document.querySelectorAll('[data-focused="true"]')) {
    stale.removeAttribute("data-focused");
  }
  if (event.detail.element) event.detail.element.setAttribute("data-focused", "true");
});

// Idle mode is otherwise a five-minute wait, which nobody will sit through
// while judging a design.
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "i") {
    now.dataset.idle = now.dataset.idle === "true" ? "false" : "true";
    now.dataset.chrome = now.dataset.idle === "true" ? "hidden" : "shown";
  }
});

render();
init(document.body);
focus(document.getElementById("playpause"));
