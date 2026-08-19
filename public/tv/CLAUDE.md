# public/tv/ — The TV front end

Everything the viewer sees on the television. D-pad only: no pointer, no touch,
no hardware keyboard. Plain HTML/CSS/ES modules, no build step, no dependencies.

## Menu

| File | Owns | Load it when |
|---|---|---|
| `index.html` | Screen markup for all five screens | You are adding or changing a screen |
| `styles/tokens.css` | Design tokens, focus primitive, reduced motion | You need a colour, size, duration, or the focus contract |
| `styles/app.css` | Screen and component layout | You are styling a screen or component |
| `scripts/spatial-nav.js` | D-pad focus engine | Focus moves wrongly, or you need `init`/`focus`/`onBack` |
| `scripts/app.js` | Screen state, rendering, playback simulation | You are wiring behaviour |
| `scripts/demo-data.js` | Fake catalogue for the prototype | You need more or different sample content |
| `scripts/audit.js` | The G4 D-pad audit. Inert unless the URL carries `?audit=1` | You are changing a G4 criterion, or the audit reports something puzzling |
| `package.json` | Marks this subtree as ESM so Node can lint it | Rarely |

Specs live in `docs/design/`. Read `DESIGN_SYSTEM.md` for component specs and
`NAVIGATION_MODEL.md` for the screen map and BACK contract — not this file.

## Contracts you must not break

1. **Focus is app-managed.** Exactly one element carries `data-focused="true"`
   at any moment. Browser `:focus` outlines are suppressed in `tokens.css`.
   Every D-pad target carries **both** `class="focusable"` and `data-focusable`.
2. **Animate only `transform` and `opacity`.** TV SoCs have no fast path for
   anything else. Never animate `width`, `height`, `top`, `left`, `box-shadow`,
   `filter`, or `background-color`. Elevation cross-fades a pseudo-element.
3. **Never use `scrollLeft` / `scrollTop`.** Rows and stacks move with
   `transform: translate3d()`, which is composited.
4. **Nothing functional outside the safe area.** Use `.safe-area` or the
   `--safe-x` / `--safe-y` insets. Backgrounds and row "peek" may bleed.
5. **Every size in `rem`.** The root font-size scales with viewport width, so
   `rem` is what makes 720p / 1080p / 4K identical. Never use `px` for layout.
6. **Minimum body text is `--fs-body` (24px @1080p).** Nothing smaller carries
   meaning.
7. **All tokens come from `tokens.css`.** No hard-coded colours in `app.css`
   except pure white inside the QR bitmap, which must be `#FFFFFF` to scan.
8. **No external requests.** No CDN fonts, no remote images, no analytics. The
   prototype must render with the network switched off.

## Adding a screen

1. Add a `<section class="screen" data-screen="<name>">` to `index.html`.
2. Register it in the screen table in `scripts/app.js`.
3. Give every interactive element `class="focusable" data-focusable`.
4. Define where focus lands on entry, and what BACK does — both belong in
   `docs/design/NAVIGATION_MODEL.md` before you write the code.

## Running it

```bash
npm run prototype        # http://localhost:8788/tv/  — no .p8 needed
npm run build:prototype  # single-file dist/prototype.html for review
```
