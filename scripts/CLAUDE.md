# scripts/ — Dev tooling

Zero-dependency Node. Nothing here ships to the device.

| File | Purpose | Run with |
|---|---|---|
| `serve-prototype.js` | Static server for `public/`. Deliberately separate from `pairing-server.js` so the prototype is reviewable **without** the Apple `.p8` present. | `npm run prototype` → http://localhost:8788/tv/ |
| `build-prototype.js` | Inlines the prototype's CSS and ES modules into one self-contained `dist/prototype.html` for review or publishing. | `npm run build:prototype` |

## Rules

1. **No dependencies.** Node built-ins only, same as the rest of the repo.
2. **No background processes.** Never append `&`, never leave a server running
   after a task. Assume the dev server is already up; if it is not, ask.
3. **Nothing here reads `.env` or the `.p8`.** If a script needs a secret, it
   belongs next to `pairing-server.js`, not here.
4. `build-prototype.js` is a dumb text substitution, not a bundler. It supports
   named `import`/`export` only. If you need `export default`, change the source
   module instead of teaching the bundler new tricks.
5. Anything the bundler cannot inline is **reported, not silently dropped** —
   keep it that way.
