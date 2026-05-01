// S.O.N · CCTV / public-webcam adapter
//
// Curated list of geopolitically-relevant public cameras with known
// lat/lon coordinates. No external API call needed (URLs are stable
// public endpoints). We lean on three classes of stream so something
// plays in any browser:
//
//   kind: 'youtube'  → live YouTube embed (iframe src)
//   kind: 'hls'      → .m3u8 HLS stream, needs hls.js in client
//   kind: 'mjpeg'    → MJPEG or JPEG-refresh URL, renders inline
//   kind: 'iframe'   → generic iframe embed (Windy, EarthCam, etc.)
//
// All entries are CURATED — no scraping, no rate limits. When a stream
// goes dark we swap it manually. This is intentional: trustworthy
// surveillance curation beats a flaky scraper every time.
//
// Sources: YouTube live streams of public webcams, EarthCam public
// embeds, Windy.com webcam embeds, municipal traffic cam pages.
//
// Focus: chokepoints, conflict zones, strategic border crossings,
// major ports, capital squares. Not tourism.

const CAMERAS = [
  // ─── STRAIT OF HORMUZ / GULF ───────────────────────────────────

  // ─── RED SEA / BAB EL-MANDEB ───────────────────────────────────

  // ─── TAIWAN STRAIT ─────────────────────────────────────────────

  // ─── UKRAINE / BLACK SEA ───────────────────────────────────────
  {
    id: 'kyiv-maidan',
    name: 'Kyiv · Maidan Square',
    lat: 50.45, lon: 30.52,
    region: 'Ukraine',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/wMo4qAYQJQ0?autoplay=1&mute=1',
    note: 'Public square, often streamed during major events',
    critical: true,
  },

  // ─── LEVANT / GAZA / LEBANON ───────────────────────────────────
  {
    id: 'jerusalem-old-city',
    name: 'Jerusalem · Old City',
    lat: 31.78, lon: 35.23,
    region: 'Levant',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/w8h_hu-B5hw?autoplay=1&mute=1',
    note: 'EarthCam public live feed',
  },

  // ─── GIBRALTAR / MEDITERRANEAN ─────────────────────────────────

  // ─── BOSPHORUS ─────────────────────────────────────────────────

  // ─── MALACCA / SINGAPORE ───────────────────────────────────────
  {
    id: 'singapore-mbs',
    name: 'Singapore · Marina Bay',
    lat: 1.28, lon: 103.86,
    region: 'Singapore',
    category: 'port',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/c-TAm9-11Ms?autoplay=1&mute=1',
    note: 'Busiest container port, Malacca anchor',
    critical: true,
  },

  // ─── PANAMA ────────────────────────────────────────────────────

  // ─── KOREAN DMZ ────────────────────────────────────────────────

  // ─── US CAPITOL / WHITE HOUSE ──────────────────────────────────
  {
    id: 'dc-whitehouse',
    name: 'Washington DC · White House',
    lat: 38.90, lon: -77.04,
    region: 'US',
    category: 'capital',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/fv-OCQpDmXE?autoplay=1&mute=1',
    note: 'Live ambient stream',
  },

  // ─── MOSCOW ────────────────────────────────────────────────────

  // ─── BEIJING ───────────────────────────────────────────────────

  // ─── OTHER STRATEGIC ───────────────────────────────────────────
  {
    id: 'tokyo-shibuya',
    name: 'Tokyo · Shibuya Crossing',
    lat: 35.66, lon: 139.70,
    region: 'Japan',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/gJuZZCOGTLA?autoplay=1&mute=1',
    note: 'EarthCam public feed',
  },
  {
    id: 'dubai-marina',
    name: 'Dubai · Marina',
    lat: 25.08, lon: 55.14,
    region: 'Gulf',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/nVS6Vk-wqfQ?autoplay=1&mute=1',
    note: 'EarthCam public feed',
  },
];

export async function briefing() {
  // Pure curation — no network call, but we still flag last-verified for
  // future health-checks.
  return {
    cameras: CAMERAS,
    totalCameras: CAMERAS.length,
    categories: [...new Set(CAMERAS.map(c => c.category))],
    regions:    [...new Set(CAMERAS.map(c => c.region))],
    lastVerified: '2026-04-22',
  };
}

export default { briefing };
