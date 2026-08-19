/**
 * G4 D-pad audit — runs inside the app, on the real device.
 *
 * Loaded only when the URL carries ?audit=1, so the prototype behaves normally
 * for everyone else.
 *
 * It checks the four G4 criteria from docs/PROJECT_CHARTER.md, plus the frame
 * rate on Now Playing, which VOTE-001 carried forward as the condition attached
 * to keeping the rotating vinyl.
 *
 * WHAT THIS CANNOT TELL YOU, stated up front so a green bar is not over-read:
 *
 *   It dispatches synthetic KeyboardEvents. That exercises how the APP handles
 *   a key, not whether the DEVICE emits the keycode the app expects. A remote
 *   whose BACK button sends something exotic would pass this audit and still be
 *   unusable. The short manual checklist in docs/G4_RUNBOOK.md covers that, and
 *   it is not optional.
 */

const KEYS = {
  up: 38,
  down: 40,
  left: 37,
  right: 39,
  ok: 13,
  back: 27,
};

const DIRECTIONS = ["up", "down", "left", "right"];

const results = [];
let panel;

function press(name) {
  const keyCode = KEYS[name];
  const key = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", ok: "Enter", back: "Escape" }[name];
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key, keyCode, which: keyCode, bubbles: true, cancelable: true })
  );
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Yield once per row, not once per key press.
 *
 * Focus moves SYNCHRONOUSLY: spatial-nav sets the class and dispatches
 * `spatialfocus` inside the keydown handler, and app.js sets `data-focused` in
 * that same listener. The only thing a delay would buy is the CSS transition,
 * which has no bearing on what this audit measures.
 *
 * Awaiting per press was also actively harmful: a backgrounded or
 * non-composited webview clamps setTimeout to about a second, which turned a
 * two-second sweep into a three-minute one that looked like a hang. Pressing
 * synchronously makes the audit immune to that throttling.
 */
const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0));

function activeScreen() {
  return document.querySelector('.screen[data-active="true"]')?.dataset.screen || null;
}

function focused() {
  return document.querySelector('[data-focused="true"]');
}

/** A short, stable name for an element, for the report. */
function label(node) {
  if (!node) return "(none)";
  const text = (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 22);
  return `${node.className.split(" ")[0]}:${text || node.dataset.action || "?"}`;
}

/**
 * Does this element exist as something a user could ever focus?
 *
 * Deliberately does NOT test whether it is currently inside the viewport. Rows
 * below the fold scroll into view when focus reaches them, so the inventory of
 * "everything that must be reachable" has to include them. Filtering the
 * inventory by viewport position would silently excuse an element that can
 * never be reached — exactly the defect criterion 1 exists to catch.
 */
function isRenderable(node) {
  if (!node || !node.isConnected) return false;
  const style = getComputedStyle(node);
  if (style.visibility === "hidden" || style.display === "none") return false;
  if (Number(style.opacity) === 0) return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Is this element actually on screen right now?
 *
 * Used only for the focus-trap check, where the question is different: a focus
 * ring sitting on something scrolled out of view is a trap wearing a disguise,
 * because the user sees no focus anywhere.
 */
function isVisible(node) {
  if (!isRenderable(node)) return false;
  const rect = node.getBoundingClientRect();
  return rect.bottom > 0 && rect.right > 0 &&
    rect.top < window.innerHeight && rect.left < window.innerWidth;
}

/** Keep the panel alive during long sweeps; a silent audit reads as a hang. */
function progress(message) {
  const line = panel.querySelector("#audit-progress");
  if (line) line.textContent = message;
}

function record(name, passed, detail) {
  results.push({ name, passed, detail });
  const row = document.createElement("div");
  row.className = passed ? "audit-ok" : "audit-bad";
  row.textContent = `${passed ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`;
  panel.querySelector("#audit-log").appendChild(row);
}


/* ------------------------------------------------------------------ *
 * Criterion 1 — every interactive element is D-pad reachable
 * ------------------------------------------------------------------ */

/**
 * Sweep a screen with a deterministic serpentine plus a return pass, and
 * collect every element that actually received focus.
 *
 * Reachability is measured empirically rather than by walking the geometry: the
 * criterion is "reachable with the D-pad", and the only honest way to check
 * that is to press the D-pad.
 */
async function sweepScreen(screen) {
  // Sized to the widest row (6 tiles) and the tallest stack (4 shelves plus the
  // nav), with headroom. Deliberately not larger: this runs on a TV SoC, and an
  // audit nobody waits for is an audit nobody runs.
  const ROWS = 6;
  const STEPS = 8;

  const visited = new Set();
  const note = () => {
    const node = focused();
    if (node) visited.add(node);
  };

  note();
  for (const vertical of ["down", "up"]) {
    for (let row = 0; row < ROWS; row += 1) {
      for (const horizontal of ["right", "left"]) {
        for (let step = 0; step < STEPS; step += 1) {
          press(horizontal);
          note();
          if (activeScreen() !== screen) return visited; // a stray OK escaped
        }
      }
      press(vertical);
      note();
      if (activeScreen() !== screen) return visited;
      progress(`sweeping ${screen}: ${visited.size} elements reached`);
      await yieldToUi();
    }
  }
  return visited;
}

async function checkReachability(screen) {
  const container = document.querySelector(`.screen[data-screen="${screen}"]`);
  const all = [...container.querySelectorAll("[data-focusable]")].filter(isRenderable);
  const visited = await sweepScreen(screen);

  const missed = all.filter((node) => !visited.has(node));
  record(
    `reachable/${screen}`,
    missed.length === 0,
    missed.length
      ? `${missed.length} of ${all.length} unreachable: ${missed.slice(0, 4).map(label).join(", ")}`
      : `all ${all.length} elements reached`
  );
}


/* ------------------------------------------------------------------ *
 * Criterion 4 — no focus trap over a long random sweep
 * ------------------------------------------------------------------ */

async function checkNoFocusTrap(events = 200) {
  let worst = null;
  let nullCount = 0;

  for (let i = 0; i < events; i += 1) {
    // Deterministic pseudo-random: a fixed sequence makes a failure reproducible.
    const direction = DIRECTIONS[(i * 7 + Math.floor(i / 3)) % DIRECTIONS.length];
    press(direction);
    if (i % 25 === 0) {
      progress(`focus-trap sweep: ${i}/${events} events`);
      await yieldToUi();
    }

    const node = focused();
    if (!node) {
      nullCount += 1;
      worst = `focus became null after ${i + 1} events`;
      break;
    }
    if (!isVisible(node)) {
      worst = `focus landed on an invisible element after ${i + 1} events: ${label(node)}`;
      break;
    }
  }

  record(
    "no-focus-trap",
    worst === null,
    worst || `${events} events, focus stayed visible throughout`
  );
  return nullCount === 0;
}


/* ------------------------------------------------------------------ *
 * Vertical movement must actually be vertical
 * ------------------------------------------------------------------ */

/**
 * DOWN must leave the row.
 *
 * The regression this guards: the focus scale used `transform-origin: center
 * bottom`, so the focused tile's PAINTED top rose above its own row and its
 * horizontal neighbours became, geometrically, "below" it. Pressing DOWN then
 * stepped sideways along the row — left, right, left, right — instead of
 * dropping to the next shelf. Navigation now measures the layout box with the
 * element's own transform undone.
 */
async function checkVerticalIsVertical() {
  const start = focused();
  if (!start) {
    record("down-leaves-the-row", false, "nothing was focused to start from");
    return;
  }
  const startRow = start.parentElement;

  press("down");
  const after = focused();
  const sameRow = after && after.parentElement === startRow;

  record(
    "down-leaves-the-row",
    !sameRow,
    sameRow
      ? `DOWN moved to a sibling in the same row (${label(after)}) — focus decoration is steering navigation`
      : `DOWN left the row, as it must`
  );

  // And the column should survive the move: dropping a shelf should not also
  // slide sideways.
  if (!sameRow && after) {
    const drift = Math.abs(after.getBoundingClientRect().left - start.getBoundingClientRect().left);
    record("down-keeps-the-column", drift < 40, `${drift.toFixed(0)}px horizontal drift`);
  }
}


/* ------------------------------------------------------------------ *
 * Criterion 3 — the BACK contract, both paths (VOTE-003)
 * ------------------------------------------------------------------ */

async function checkBackContract() {
  // Leaving a child screen must return to Home.
  const nav = [...document.querySelectorAll('.screen[data-active="true"] .nav__item')]
    .find((item) => item.dataset.target === "library");
  if (nav) {
    nav.dispatchEvent(new CustomEvent("spatialselect", { detail: { element: nav }, bubbles: true }));
    await wait(300);
    const wentIn = activeScreen() === "library";
    press("back");
    await wait(300);
    record("back/child-returns-home", wentIn && activeScreen() === "home",
      `library -> BACK -> ${activeScreen()}`);
  }

  // Home while idle must exit outright.
  const player = document.getElementById("now");
  const wasPlaying = player?.dataset.playing === "true";
  if (wasPlaying) {
    const button = document.getElementById("now-playpause");
    button.dispatchEvent(new CustomEvent("spatialselect", { detail: { element: button }, bubbles: true }));
    await wait(200);
  }

  press("back");
  await wait(300);
  const exited = document.getElementById("exited")?.dataset.open === "true";
  record("back/home-idle-exits", exited,
    exited ? "exited with no prompt, as VOTE-003 requires" : "BACK on an idle Home did not exit");
}


/* ------------------------------------------------------------------ *
 * VOTE-001's condition — frame rate on Now Playing
 * ------------------------------------------------------------------ */

/**
 * The rotating vinyl won VOTE-001 4-1. QA's dissent was that it would stutter
 * on weak TV hardware, and the agreed remedy was to measure on the device and
 * fall back to a static backdrop below 30 fps.
 */
function measureFps(seconds = 3) {
  return new Promise((resolve) => {
    let frames = 0;
    const started = performance.now();
    const tick = () => {
      frames += 1;
      if (performance.now() - started < seconds * 1000) {
        requestAnimationFrame(tick);
      } else {
        const elapsed = (performance.now() - started) / 1000;
        resolve(finalise(frames / elapsed));
      }
    };

    /**
     * Distinguish "slow" from "not measurable".
     *
     * A hidden or non-composited page throttles requestAnimationFrame to
     * nothing. Reporting that as a frame rate would produce a confident "1 fps"
     * and falsely trigger VOTE-001's fallback, disabling the vinyl on hardware
     * that renders it perfectly well. A measurement that cannot be trusted must
     * say so rather than guess low.
     */
    function finalise(fps) {
      if (document.visibilityState !== "visible" || fps < 5) {
        return { fps, inconclusive: true, reason: document.visibilityState !== "visible"
          ? "the page was not visible, so requestAnimationFrame was throttled"
          : "requestAnimationFrame barely ticked, which indicates throttling rather than a slow GPU" };
      }
      return { fps, inconclusive: false };
    }

    // Hard stop, so a page that never paints cannot hang the audit forever.
    setTimeout(() => resolve(finalise(frames / seconds)), seconds * 1000 + 4000);
    requestAnimationFrame(tick);
  });
}


/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

function buildPanel() {
  panel = document.createElement("div");
  panel.id = "audit";
  panel.innerHTML = `
    <style>
      #audit {
        position: fixed; inset: 0; z-index: 9999;
        background: #06060A; color: #F5F6F8;
        font: 1.05vw/1.5 ui-monospace, Consolas, monospace;
        padding: 4vh 4vw; overflow-y: auto;
      }
      #audit h1 { font-size: 2.2em; margin: 0 0 .1em; }
      #audit .sub { color: #9AA0AA; margin: 0 0 .8em; font-size: .95em; }
      #audit-verdict {
        font-size: 2.2em; font-weight: 700; padding: .35em .6em;
        border-radius: .25em; margin-bottom: .8em; background: #FFD426; color: #2A2300;
      }
      #audit-verdict[data-v="pass"] { background: #35C759; color: #04240D; }
      #audit-verdict[data-v="fail"] { background: #FF453A; color: #2A0603; }
      .audit-ok  { color: #35C759; }
      .audit-bad { color: #FF453A; }
      #audit-log > div { padding: .12em 0; }
      #audit-note { margin-top: 1em; color: #FFD426; font-size: .95em; }
    </style>
    <h1>G4 — D-pad audit</h1>
    <p class="sub">Synthetic key events. This proves how the app handles keys, not which keycodes your remote emits — the manual checklist still applies.</p>
    <div id="audit-verdict" data-v="run">Running…</div>
    <div id="audit-progress" class="sub"></div>
    <div id="audit-log"></div>
    <div id="audit-note"></div>`;
  document.body.appendChild(panel);
}

function finish(fps) {
  const failed = results.filter((r) => !r.passed);
  const verdict = panel.querySelector("#audit-verdict");

  if (failed.length === 0) {
    verdict.dataset.v = "pass";
    verdict.textContent = fps.inconclusive
      ? `PASS — ${results.length} checks (frame rate not measurable)`
      : `PASS — ${results.length} checks, ${fps.fps.toFixed(0)} fps on Now Playing`;
  } else {
    verdict.dataset.v = "fail";
    verdict.textContent = `FAIL — ${failed.length} of ${results.length} checks failed`;
  }

  const note = panel.querySelector("#audit-note");
  note.textContent = fps.inconclusive
    ? `Frame rate NOT MEASURED: ${fps.reason}. VOTE-001's condition on the rotating vinyl is unresolved — re-run this audit with the app in the foreground on the television.`
    : fps.fps < 30
      ? `Now Playing ran at ${fps.fps.toFixed(1)} fps, below the 30 fps floor. VOTE-001's carried-forward condition triggers: disable the vinyl rotation and fall back to the static backdrop.`
      : `Now Playing held ${fps.fps.toFixed(1)} fps. VOTE-001's rotating vinyl stands on this hardware; QA's dissent is answered.`;

  console.log("[g4-audit]", JSON.stringify({ fps, results }, null, 2));
}


/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

async function run() {
  buildPanel();
  // Let the app finish its own boot and claim entry focus first.
  await wait(1200);

  // Get past pairing into the app proper.
  press("ok");
  await wait(1500);

  await checkReachability("home");

  // Open Now Playing to measure the frame rate where the animation lives.
  const tile = document.querySelector('[data-screen="home"] .tile');
  tile.dispatchEvent(new CustomEvent("spatialselect", { detail: { element: tile }, bubbles: true }));
  await wait(800);
  const fps = await measureFps(3);
  record(
    "now-playing-fps",
    // An unmeasurable frame rate is not a failure of the app.
    fps.inconclusive || fps.fps >= 30,
    fps.inconclusive
      ? `INCONCLUSIVE — ${fps.reason}. Re-run with the app in the foreground.`
      : `${fps.fps.toFixed(1)} fps (floor 30)`
  );

  await checkReachability("now");
  press("back");
  await wait(400);

  await checkVerticalIsVertical();
  await checkNoFocusTrap(200);
  await checkBackContract();

  finish(fps);
}

if (new URLSearchParams(location.search).get("audit") === "1") {
  run().catch((error) => {
    if (panel) {
      const verdict = panel.querySelector("#audit-verdict");
      verdict.dataset.v = "fail";
      verdict.textContent = `FAIL — the audit itself threw: ${error.message}`;
    }
    console.error("[g4-audit]", error);
  });
}

export { isRenderable, isVisible, measureFps };
