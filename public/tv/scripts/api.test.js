import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, artworkPalette, artworkUrl, createClient } from "./api.js";

const DEV = "developer.token.value";
const MUT = "music-user-token-value";

/** A fetch stand-in that records calls and replays canned payloads. */
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    for (const [pattern, response] of routes) {
      if (url.includes(pattern)) {
        if (typeof response === "number") {
          return { ok: false, status: response, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => response };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  impl.calls = calls;
  return impl;
}

const ARTWORK = {
  url: "https://is1-ssl.mzstatic.com/image/thumb/abc/{w}x{h}{c}.{f}",
  bgColor: "1d1d1f",
  textColor1: "f5f6f8",
  textColor2: "c8c9cc",
  textColor3: "9aa0aa",
  textColor4: "70757e",
};


test("artworkUrl substitutes the exact pixel size Apple's template asks for", () => {
  assert.equal(
    artworkUrl(ARTWORK, 288),
    "https://is1-ssl.mzstatic.com/image/thumb/abc/288x288{c}.jpg"
  );
  // Fractional sizes come from devicePixelRatio maths; Apple wants integers.
  assert.match(artworkUrl(ARTWORK, 287.6), /288x288/);
  assert.equal(artworkUrl(null, 288), null);
  assert.equal(artworkUrl({}, 288), null);
});

test("artworkPalette adds the missing # and returns null when Apple sent no colours", () => {
  const palette = artworkPalette(ARTWORK);
  assert.equal(palette.background, "#1d1d1f");
  assert.equal(palette.primary, "#f5f6f8");
  assert.equal(palette.quaternary, "#70757e");

  // No colour data must not become a guessed colour — the caller falls back to
  // the design system's own accent instead.
  assert.equal(artworkPalette({ url: "x" }), null);
  assert.equal(artworkPalette(null), null);
});

test("artworkPalette leaves an already-hashed value alone", () => {
  const palette = artworkPalette({ bgColor: "#112233", textColor1: "#ffffff" });
  assert.equal(palette.background, "#112233");
  assert.equal(palette.primary, "#ffffff");
});


test("user-scoped calls send the Music User Token; catalog calls do not", async () => {
  const headersSeen = [];
  const impl = async (url, options) => {
    headersSeen.push({ url, headers: options.headers });
    return { ok: true, status: 200, json: async () => ({ data: [] }) };
  };

  const client = createClient({ developerToken: DEV, musicUserToken: MUT, fetchImpl: impl });
  await client.libraryPlaylists();
  await client.charts();

  assert.equal(headersSeen[0].headers["Music-User-Token"], MUT);
  assert.equal(headersSeen[0].headers.Authorization, `Bearer ${DEV}`);
  // The catalog endpoint must not carry the listener's identity around.
  assert.equal(headersSeen[1].headers["Music-User-Token"], undefined);
});

test("a user-scoped call refuses to run without a user token", async () => {
  const client = createClient({ developerToken: DEV, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  await assert.rejects(() => client.libraryPlaylists(), /needs a Music User Token/);
});

test("401 on a library call reports that re-authentication is needed", async () => {
  const lost = [];
  const client = createClient({
    developerToken: DEV,
    musicUserToken: MUT,
    // The catalog route must be specified: the client now probes it to work out
    // WHOSE token expired. Leaving it unspecified would test the other case.
    fetchImpl: fakeFetch([["/v1/me/library/playlists", 401], ["/charts", { results: {} }]]),
    onAuthLost: (error) => lost.push(error),
  });

  await assert.rejects(() => client.libraryPlaylists(), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.needsReauth, true);
    return true;
  });
  assert.equal(lost.length, 1);
});

test("a 500 is not mistaken for an expired session", async () => {
  const lost = [];
  const client = createClient({
    developerToken: DEV,
    musicUserToken: MUT,
    fetchImpl: fakeFetch([["/v1/me/library/playlists", 500]]),
    onAuthLost: (error) => lost.push(error),
  });

  await assert.rejects(() => client.libraryPlaylists(), (error) => {
    assert.equal(error.needsReauth, false);
    return true;
  });
  assert.equal(lost.length, 0, "a server error must not send the viewer back to the pairing screen");
});


test("items are flattened into the shape the screens render", async () => {
  const client = createClient({
    developerToken: DEV,
    musicUserToken: MUT,
    fetchImpl: fakeFetch([["/v1/me/library/albums", {
      data: [{
        id: "l.abc123",
        type: "library-albums",
        attributes: {
          name: "Neon Harbour",
          artistName: "Yuen Kwok",
          releaseDate: "2024-03-15",
          trackCount: 5,
          artwork: ARTWORK,
        },
      }],
    }]]),
  });

  const [item] = await client.libraryAlbums();
  assert.equal(item.title, "Neon Harbour");
  assert.equal(item.artist, "Yuen Kwok");
  assert.equal(item.year, "2024");
  assert.equal(item.trackCount, 5);
  assert.equal(item.palette.background, "#1d1d1f");
  assert.deepEqual(item.play, { type: "library-albums", id: "l.abc123" });
});

test("recommendations are unwrapped from their extra nesting level", async () => {
  const client = createClient({
    developerToken: DEV,
    musicUserToken: MUT,
    fetchImpl: fakeFetch([["/v1/me/recommendations", {
      data: [{
        id: "rec-1",
        relationships: {
          contents: {
            data: [
              { id: "a1", type: "albums", attributes: { name: "One", artistName: "A" } },
              { id: "a2", type: "albums", attributes: { name: "Two", artistName: "B" } },
            ],
          },
        },
      }],
    }]]),
  });

  const items = await client.recommendations();
  assert.deepEqual(items.map((i) => i.title), ["One", "Two"]);
});

test("an empty search term never reaches the network", async () => {
  const impl = fakeFetch([]);
  const client = createClient({ developerToken: DEV, musicUserToken: MUT, fetchImpl: impl });

  assert.deepEqual(await client.search("   "), []);
  assert.equal(impl.calls.length, 0);
});

test("search sends the term as a query parameter, not in the path", async () => {
  const impl = fakeFetch([["/search", { results: { albums: { data: [] }, songs: { data: [] } } }]]);
  const client = createClient({ developerToken: DEV, musicUserToken: MUT, fetchImpl: impl });

  await client.search("Ella Langley");
  assert.match(impl.calls[0], /term=Ella\+Langley/);
});

test("library tracks and catalog tracks use different endpoints", async () => {
  const impl = fakeFetch([["/tracks", { data: [] }]]);
  const client = createClient({ developerToken: DEV, musicUserToken: MUT, fetchImpl: impl });

  await client.tracks({ id: "l.abc", type: "library-playlists" });
  await client.tracks({ id: "pl.xyz", type: "playlists" });

  assert.match(impl.calls[0], /\/v1\/me\/library\/library-playlists\/l\.abc\/tracks/);
  assert.match(impl.calls[1], /\/v1\/catalog\/us\/playlists\/pl\.xyz\/tracks/);
});

test("library artwork yields no palette, because Apple ships colours only on catalog items", () => {
  // Verified against a real account on 2026-08-20: /v1/me/library/albums returns
  // artwork with url, width and height only. Returning null here is what lets
  // the UI keep its own accent instead of rendering an invented colour.
  const libraryArtwork = { url: "https://.../{w}x{h}{c}.{f}", width: 1200, height: 1200 };
  assert.equal(artworkPalette(libraryArtwork), null);
  assert.ok(artworkUrl(libraryArtwork, 288), "the image itself is still available");
});

test("a stale developer token is not reported as the listener's session expiring", async () => {
  // The failure this guards against: the pairing server minted its developer
  // token once at boot, it expired after an hour, every call 401'd, and the app
  // told the viewer THEIR Apple Music session had expired. Re-scanning a QR
  // code could never have fixed it.
  const lost = [];
  const client = createClient({
    developerToken: DEV,
    musicUserToken: MUT,
    // Both the library call and the catalog probe fail: our token is the problem.
    fetchImpl: fakeFetch([["/v1/me/library/playlists", 401], ["/charts", 401]]),
    onAuthLost: (error) => lost.push(error),
  });

  await assert.rejects(() => client.libraryPlaylists(), (error) => {
    assert.equal(error.developerTokenExpired, true);
    assert.match(error.message, /our developer token is stale/);
    return true;
  });
  assert.equal(lost.length, 0, "the viewer must not be sent back to pairing for our own stale token");
});

test("a genuinely expired user token still reaches onAuthLost", async () => {
  const lost = [];
  const client = createClient({
    developerToken: DEV,
    musicUserToken: MUT,
    // The catalog probe succeeds, so the developer token is fine and the
    // listener's really has expired.
    fetchImpl: fakeFetch([["/v1/me/library/playlists", 401], ["/charts", { results: {} }]]),
    onAuthLost: (error) => lost.push(error),
  });

  await assert.rejects(() => client.libraryPlaylists(), (error) => {
    assert.equal(error.developerTokenExpired, false);
    return true;
  });
  assert.equal(lost.length, 1);
});
