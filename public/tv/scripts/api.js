/**
 * Apple Music API client for the TV app.
 *
 * Two credentials are always in play and they are not interchangeable:
 *
 *   developerToken   identifies US. Catalog access only. Public by design —
 *                    it is meant to be handed to web clients.
 *   musicUserToken   identifies the LISTENER. Required for anything under
 *                    /v1/me. Never logged, never rendered, never in a URL.
 *
 * Artwork colours come from Apple, not from us. Every `Artwork` object carries
 * `bgColor` and `textColor1`–`textColor4` alongside the image URL, so the
 * adaptive Now Playing palette needs no canvas, no pixel sampling, no CORS
 * dance and no main-thread cost. See docs/research/TV_UX_RESEARCH.md §1.
 */

const API = "https://api.music.apple.com";

/** Thrown so callers can distinguish "your session died" from "the network hiccuped". */
class ApiError extends Error {
  constructor(status, endpoint) {
    super(`Apple Music returned HTTP ${status} for ${endpoint}`);
    this.name = "ApiError";
    this.status = status;
    this.endpoint = endpoint;
    // 401/403 on a /v1/me call means the Music User Token is no longer good.
    this.needsReauth = status === 401 || status === 403;
  }
}

/**
 * Turn Apple's artwork template into a real URL.
 *
 * The `url` field contains literal `{w}` and `{h}` placeholders — requesting the
 * exact pixel size matters on a TV, where asking for a 3000px master to fill a
 * 288px tile wastes bandwidth and decode time on a weak SoC.
 */
function artworkUrl(artwork, size) {
  if (!artwork || !artwork.url) return null;
  const pixels = Math.round(size);
  return artwork.url
    .replace("{w}", String(pixels))
    .replace("{h}", String(pixels))
    .replace("{f}", "jpg");
}

/**
 * Normalise Apple's colour fields, which arrive as bare hex with no `#`.
 * Returns null rather than a guess when a release has no colour data, so the
 * caller falls back to the design system's own accent instead of rendering
 * something arbitrary.
 */
function artworkPalette(artwork) {
  if (!artwork || !artwork.bgColor) return null;
  const hash = (value) => (value && !value.startsWith("#") ? `#${value}` : value) || null;
  return {
    background: hash(artwork.bgColor),
    primary: hash(artwork.textColor1),
    secondary: hash(artwork.textColor2),
    tertiary: hash(artwork.textColor3),
    quaternary: hash(artwork.textColor4),
  };
}

/**
 * A client bound to one listener's session.
 *
 * `onAuthLost` fires when Apple rejects the user token. The UI needs to send
 * the viewer back to the pairing screen, and how that re-authentication works
 * is an auth decision, not this file's — see public/CLAUDE.md.
 */
function createClient({ developerToken, musicUserToken, storefront = "us", fetchImpl = fetch, onAuthLost }) {
  if (!developerToken) throw new Error("developerToken is required.");

  async function request(endpoint, { params, userScoped = true } = {}) {
    const url = new URL(endpoint.startsWith("http") ? endpoint : API + endpoint);
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    const headers = { Authorization: `Bearer ${developerToken}` };
    if (userScoped) {
      if (!musicUserToken) throw new Error(`${endpoint} needs a Music User Token.`);
      headers["Music-User-Token"] = musicUserToken;
    }

    const response = await fetchImpl(url.toString(), { headers });
    if (!response.ok) {
      const error = new ApiError(response.status, endpoint);

      // A 401 on a /me call has two possible causes and they need opposite
      // responses: the LISTENER's token expired, or OUR developer token did.
      // Blaming the listener for our own stale credential sends them to re-scan
      // a QR code that will not help. Ask a catalog endpoint — it needs only the
      // developer token — and let the answer decide.
      if (error.needsReauth) {
        error.developerTokenExpired = !(await developerTokenStillValid());
        if (error.developerTokenExpired) {
          error.message += " — our developer token is stale, not your Apple Music session";
        } else if (onAuthLost) {
          onAuthLost(error);
        }
      }
      throw error;
    }
    return response.json();
  }

  /** One cheap catalog call. Succeeds only if the developer token is good. */
  async function developerTokenStillValid() {
    try {
      const probe = await fetchImpl(`${API}/v1/catalog/${storefront}/charts?types=songs&limit=1`, {
        headers: { Authorization: `Bearer ${developerToken}` },
      });
      return probe.ok;
    } catch (networkError) {
      // Unreachable is not the same as unauthorised; do not accuse either side.
      return true;
    }
  }

  /**
   * Flatten one catalog or library item into what the UI actually renders.
   * Keeping this in one place means a shape change from Apple is a one-line
   * fix rather than a hunt through the screens.
   */
  function toItem(raw) {
    const attributes = raw.attributes || {};
    return {
      id: raw.id,
      type: raw.type,
      title: attributes.name || attributes.albumName || "Unknown",
      artist: attributes.artistName || attributes.curatorName || "",
      year: (attributes.releaseDate || "").slice(0, 4),
      trackCount: attributes.trackCount,
      durationMs: attributes.durationInMillis,
      artwork: attributes.artwork || null,
      palette: artworkPalette(attributes.artwork),
      /** Playable handle for MusicKit's setQueue. */
      play: { type: raw.type, id: raw.id },
    };
  }

  const list = (payload) => (payload?.data || []).map(toItem);

  return {
    /** Home shelf 1. The single most valuable row on the screen. */
    async recentlyPlayed(limit = 12) {
      return list(await request("/v1/me/recent/played/tracks", { params: { limit } }));
    },

    /** Home shelf 2. Apple's own recommendations for this listener. */
    async recommendations(limit = 12) {
      const payload = await request("/v1/me/recommendations", { params: { limit } });
      // Recommendations nest their content one level deeper than everything else.
      const groups = payload?.data || [];
      return groups.flatMap((group) => (group.relationships?.contents?.data || []).map(toItem));
    },

    /** Home shelf 3 and the Library screen. */
    async libraryPlaylists(limit = 25) {
      return list(await request("/v1/me/library/playlists", { params: { limit } }));
    },

    async libraryAlbums(limit = 25) {
      return list(await request("/v1/me/library/albums", { params: { limit } }));
    },

    /** Tracks of a playlist or album, for the detail screen. */
    async tracks(item, limit = 100) {
      const isLibrary = String(item.id).startsWith("l.") || item.type?.startsWith("library-");
      const base = isLibrary
        ? `/v1/me/library/${item.type}/${item.id}/tracks`
        : `/v1/catalog/${storefront}/${item.type}/${item.id}/tracks`;
      return list(await request(base, { params: { limit } }));
    },

    /** Search. Catalog only — library search is a separate endpoint we do not need yet. */
    async search(term, limit = 12) {
      if (!term.trim()) return [];
      const payload = await request(`/v1/catalog/${storefront}/search`, {
        params: { term, types: "albums,songs,artists", limit },
        userScoped: false,
      });
      const results = payload?.results || {};
      return [
        ...(results.albums?.data || []),
        ...(results.songs?.data || []),
      ].map(toItem);
    },

    /** Home shelf 4, and the fallback when a listener has no history yet. */
    async charts(limit = 12) {
      const payload = await request(`/v1/catalog/${storefront}/charts`, {
        params: { types: "albums", limit },
        userScoped: false,
      });
      return (payload?.results?.albums?.[0]?.data || []).map(toItem);
    },

    /** Exposed so callers can reach endpoints this client does not wrap yet. */
    request,
  };
}

export { ApiError, artworkPalette, artworkUrl, createClient };
