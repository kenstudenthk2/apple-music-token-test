/**
 * Static file server for the TV prototype.
 *
 * Kept separate from pairing-server.js on purpose: the prototype must be
 * reviewable by anyone on the team without the Apple .p8 private key present,
 * and pairing-server.js refuses to start without it.
 *
 * Usage: node scripts/serve-prototype.js   ->   http://localhost:8788/tv/
 */

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const PORT = Number(process.env.PROTOTYPE_PORT || 8788);

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

/**
 * Map a URL path to a file inside public/, or null if it escapes the directory.
 * Path traversal is rejected by comparing the resolved path against PUBLIC_DIR.
 */
function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "/tv/index.html" : decoded;
  let target = path.join(PUBLIC_DIR, relative);

  if (!target.startsWith(PUBLIC_DIR + path.sep) && target !== PUBLIC_DIR) {
    return null;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  }
  return fs.existsSync(target) ? target : null;
}

const server = http.createServer((req, res) => {
  const file = req.method === "GET" ? resolveFile(req.url) : null;

  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found.");
    return;
  }

  const body = fs.readFileSync(file);
  res.writeHead(200, {
    "Content-Type": CONTENT_TYPES[path.extname(file)] || "application/octet-stream",
    "Content-Length": body.length,
    // The prototype changes constantly during design review.
    "Cache-Control": "no-store",
  });
  res.end(body);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Prototype: http://localhost:${PORT}/tv/`);
});
