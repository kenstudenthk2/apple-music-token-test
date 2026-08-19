/**
 * Demo catalogue for the AppleTune TV prototype.
 *
 * The prototype must render with zero network access so it can be reviewed as a
 * self-contained page. Real artwork is therefore replaced by a deterministic CSS
 * gradient per release, and each release carries the dominant colour that the
 * real app will extract from the Apple Music artwork URL at runtime.
 */

/** Build one release. `accent` is what drives the adaptive Now Playing palette. */
function release(id, title, artist, accent, second, year, tracks) {
  return {
    id,
    title,
    artist,
    accent,
    year,
    // Two-stop diagonal stand-in for real cover art.
    art: `linear-gradient(135deg, ${accent} 0%, ${second} 100%)`,
    tracks,
  };
}

function track(title, seconds) {
  return { title, seconds };
}

const RELEASES = [
  release("r1", "Neon Harbour", "Yuen Kwok", "#ff5f6d", "#ffc371", 2024, [
    track("Neon Harbour", 218),
    track("Kowloon Rain", 244),
    track("Star Ferry", 191),
    track("Midnight Tram", 263),
    track("Signal Hill", 207),
  ]),
  release("r2", "Slow Tide", "Marisol Vane", "#2b5876", "#4e4376", 2023, [
    track("Slow Tide", 232),
    track("Undertow", 198),
    track("Salt & Static", 275),
    track("Low Sun", 214),
  ]),
  release("r3", "Paper Lanterns", "Ito Collective", "#c94b4b", "#4b134f", 2025, [
    track("Paper Lanterns", 201),
    track("Festival Street", 236),
    track("Ash & Ember", 258),
    track("Return Home", 189),
  ]),
  release("r4", "Glass Arcade", "Nova Pike", "#00c6ff", "#0072ff", 2024, [
    track("Glass Arcade", 225),
    track("Coin Slot", 176),
    track("High Score", 243),
    track("Continue?", 262),
  ]),
  release("r5", "Golden Hour Radio", "The Long Way", "#f7971e", "#ffd200", 2022, [
    track("Golden Hour Radio", 249),
    track("Dust Road", 212),
    track("Two Lane", 234),
    track("Porch Light", 268),
  ]),
  release("r6", "Cold Open", "Bela Frank", "#485563", "#29323c", 2025, [
    track("Cold Open", 187),
    track("Second Act", 229),
    track("Cut To Black", 253),
  ]),
  release("r7", "Mango Season", "Priya Rao", "#f9d423", "#e65c00", 2023, [
    track("Mango Season", 205),
    track("Monsoon Bus", 241),
    track("Rooftop", 219),
    track("Late Mangoes", 236),
  ]),
  release("r8", "Analog Ghosts", "Kester", "#654ea3", "#eaafc8", 2024, [
    track("Analog Ghosts", 262),
    track("Tape Hiss", 198),
    track("Rewind", 227),
    track("Blank Side B", 241),
  ]),
  release("r9", "Harbour Lights", "Yuen Kwok", "#11998e", "#38ef7d", 2021, [
    track("Harbour Lights", 214),
    track("Typhoon Signal 8", 259),
    track("Pier 7", 233),
  ]),
  release("r10", "Static Bloom", "Marisol Vane", "#eb3349", "#f45c43", 2025, [
    track("Static Bloom", 228),
    track("Bruise Blue", 246),
    track("Nothing Sticks", 203),
    track("Static Bloom (Reprise)", 165),
  ]),
  release("r11", "Night Bus", "Ito Collective", "#141e30", "#243b55", 2022, [
    track("Night Bus", 271),
    track("Last Stop", 218),
    track("Sodium Lamps", 244),
  ]),
  release("r12", "Sunroom", "The Long Way", "#ff9966", "#ff5e62", 2023, [
    track("Sunroom", 196),
    track("Houseplants", 231),
    track("Afternoon Off", 254),
    track("Dust In The Beam", 209),
  ]),
];

const BY_ID = new Map(RELEASES.map((item) => [item.id, item]));

/** Pick releases by id, preserving the order given. */
function shelf(title, ids) {
  return { title, items: ids.map((id) => BY_ID.get(id)) };
}

const SHELVES = [
  shelf("Recently Played", ["r1", "r4", "r7", "r2", "r10", "r5"]),
  shelf("Made For You", ["r3", "r8", "r11", "r6", "r12", "r9"]),
  shelf("Your Library", ["r5", "r9", "r2", "r12", "r1", "r3"]),
  shelf("New Releases", ["r10", "r6", "r3", "r8", "r4", "r11"]),
];

const PLAYLISTS = [
  { id: "p1", title: "Late Night Drive", count: 42, accent: "#2b5876" },
  { id: "p2", title: "Kitchen Sunday", count: 28, accent: "#f7971e" },
  { id: "p3", title: "Focus, No Words", count: 61, accent: "#11998e" },
  { id: "p4", title: "Cantopop Forever", count: 87, accent: "#eb3349" },
  { id: "p5", title: "Rainy Window", count: 35, accent: "#654ea3" },
  { id: "p6", title: "Gym, Reluctantly", count: 24, accent: "#00c6ff" },
];

export { BY_ID, PLAYLISTS, RELEASES, SHELVES };
