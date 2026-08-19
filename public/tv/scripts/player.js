/**
 * MusicKit playback wrapper.
 *
 * Everything here was proven on real hardware by POC-B (gate G1, see
 * docs/POCB_RESULT.md). Two facts from that run shape this file:
 *
 *   1. MusicKit accepts a Music User Token obtained on the PHONE. Setting
 *      `music.musicUserToken` works; the TV never calls authorize() and never
 *      shows an Apple sign-in. That is the whole QR architecture.
 *
 *   2. Full-track playback works inside an Android WebView, but only because
 *      the host app grants PROTECTED_MEDIA_ID and disables the user-gesture
 *      requirement. Those live in MainActivity, not here. If playback ever
 *      regresses to 30 seconds, look there first — nothing in this file can
 *      cause a preview fallback.
 *
 * The UI never touches MusicKit directly. It subscribes to `onChange` and
 * renders whatever state arrives, so the screens stay ignorant of the SDK.
 */

const MUSICKIT_TIMEOUT_MS = 20000;

/** PlaybackStates that MusicKit reports as numbers. */
const STATE = {
  none: 0,
  loading: 1,
  playing: 2,
  paused: 3,
  stopped: 4,
  ended: 5,
  seeking: 6,
  waiting: 8,
  stalled: 9,
  completed: 10,
};

/**
 * Ask MusicKit what "playing" means rather than assuming it is 2.
 *
 * The numbers below are correct for MusicKit JS v3 today, but a version that
 * renumbered them would break silently: the vinyl would simply stop spinning
 * and the play button would show the wrong glyph, with no error anywhere. The
 * SDK ships the enum, so use it when it is there.
 */
function playbackStates() {
  return window.MusicKit?.PlaybackStates || STATE;
}

function musicKitReady() {
  return new Promise((resolve, reject) => {
    if (window.MusicKit) return resolve();
    const timer = setTimeout(
      () => reject(new Error("MusicKit JS did not load. Check the network and Apple's CDN.")),
      MUSICKIT_TIMEOUT_MS
    );
    document.addEventListener("musickitloaded", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/**
 * Build the player.
 *
 * `onChange` receives a plain snapshot — never the MusicKit instance — so the
 * UI cannot accidentally reach past this boundary.
 */
async function createPlayer({ developerToken, musicUserToken, appName = "AppleTune TV", build = "1.0.0", onChange = () => {} }) {
  await musicKitReady();

  await window.MusicKit.configure({
    developerToken,
    app: { name: appName, build },
  });
  const music = window.MusicKit.getInstance();

  // The load-bearing line of the entire product. POC-B proved MusicKit accepts
  // a token minted on a different device; if this ever stops working, the TV
  // would have to sign in on its own and the QR design collapses.
  music.musicUserToken = musicUserToken;
  if (!music.isAuthorized) {
    throw new Error("MusicKit rejected the paired Music User Token.");
  }

  const state = {
    item: null,
    queue: [],
    index: 0,
    playing: false,
    position: 0,
    duration: 0,
  };

  function publish() {
    onChange({ ...state, queue: state.queue.slice() });
  }

  function syncFromMusicKit() {
    state.playing = music.playbackState === playbackStates().playing;
    state.position = music.currentPlaybackTime || 0;
    state.duration = music.currentPlaybackDuration || state.duration;
    publish();
  }

  music.addEventListener("playbackStateDidChange", syncFromMusicKit);
  music.addEventListener("playbackTimeDidChange", syncFromMusicKit);

  music.addEventListener("nowPlayingItemDidChange", () => {
    const now = music.nowPlayingItem;
    if (now) {
      state.item = {
        id: now.id,
        title: now.title || now.attributes?.name || "",
        artist: now.artistName || now.attributes?.artistName || "",
        album: now.albumName || now.attributes?.albumName || "",
        artwork: now.artwork || now.attributes?.artwork || null,
      };
      state.index = music.nowPlayingItemIndex ?? state.index;
    }
    syncFromMusicKit();
  });

  return {
    /**
     * Play something. `handle` is the `{type, id}` an api.js item carries, so
     * callers never construct MusicKit queue descriptors themselves.
     */
    async play(handle, startAt = 0) {
      const queue = {
        songs: () => ({ songs: [handle.id] }),
        albums: () => ({ album: handle.id }),
        playlists: () => ({ playlist: handle.id }),
      };
      const key = handle.type.replace(/^library-/, "");
      const descriptor = (queue[key] || queue.songs)();
      if (startAt) descriptor.startPosition = startAt;

      await music.setQueue(descriptor);
      await music.play();
      syncFromMusicKit();
    },

    async toggle() {
      // Ask MusicKit, not our own flag: a media key on the remote can change
      // playback without going through this wrapper at all.
      if (music.playbackState === playbackStates().playing) {
        await music.pause();
      } else {
        await music.play();
      }
      syncFromMusicKit();
    },

    async next() {
      await music.skipToNextItem();
      syncFromMusicKit();
    },

    async previous() {
      // Below three seconds, "previous" means the previous track. After that it
      // means "restart this one" — the behaviour every music player has, and
      // the one people expect without being told.
      if ((music.currentPlaybackTime || 0) > 3) {
        await music.seekToTime(0);
      } else {
        await music.skipToPreviousItem();
      }
      syncFromMusicKit();
    },

    async seek(seconds) {
      await music.seekToTime(Math.max(0, seconds));
      syncFromMusicKit();
    },

    async stop() {
      await music.stop();
      syncFromMusicKit();
    },

    snapshot() {
      return { ...state };
    },
  };
}

export { STATE, createPlayer, musicKitReady };
