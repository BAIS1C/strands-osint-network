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
  {
    id: 'hormuz-bandar-abbas',
    name: 'Bandar Abbas Port Approach',
    lat: 27.18, lon: 56.28,
    region: 'Hormuz',
    category: 'port',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1734094027',
    note: 'Iran side of Hormuz, major oil loading terminal',
    critical: true,
  },
  {
    id: 'hormuz-fujairah',
    name: 'Fujairah Anchorage',
    lat: 25.12, lon: 56.37,
    region: 'Hormuz',
    category: 'port',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1614085432',
    note: 'UAE side, largest bunkering port in Middle East',
    critical: true,
  },

  // ─── RED SEA / BAB EL-MANDEB ───────────────────────────────────
  {
    id: 'suez-port-said',
    name: 'Port Said Canal Entrance',
    lat: 31.25, lon: 32.30,
    region: 'Suez',
    category: 'canal',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1613999982',
    note: 'Northern Suez Canal entry from the Mediterranean',
    critical: true,
  },

  // ─── TAIWAN STRAIT ─────────────────────────────────────────────
  {
    id: 'taiwan-keelung',
    name: 'Keelung Harbor',
    lat: 25.13, lon: 121.74,
    region: 'Taiwan',
    category: 'port',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1737117080',
    note: 'Northern Taiwan port, PLA-Navy ops watch',
    critical: true,
  },
  {
    id: 'taiwan-taipei101',
    name: 'Taipei 101 · City View',
    lat: 25.03, lon: 121.56,
    region: 'Taiwan',
    category: 'city',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1727254854',
    note: 'Taipei urban ambient',
  },

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
  {
    id: 'odesa-port',
    name: 'Odesa Port',
    lat: 46.48, lon: 30.74,
    region: 'Ukraine',
    category: 'port',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1615047036',
    note: 'Black Sea grain corridor',
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
  {
    id: 'beirut-port',
    name: 'Beirut Port',
    lat: 33.90, lon: 35.52,
    region: 'Levant',
    category: 'port',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1615146928',
    note: 'Rebuilt after 2020 blast',
  },

  // ─── GIBRALTAR / MEDITERRANEAN ─────────────────────────────────
  {
    id: 'gibraltar-strait',
    name: 'Strait of Gibraltar',
    lat: 36.14, lon: -5.35,
    region: 'Gibraltar',
    category: 'chokepoint',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1614014672',
    note: 'Atlantic-Med chokepoint, Royal Navy coverage',
    critical: true,
  },

  // ─── BOSPHORUS ─────────────────────────────────────────────────
  {
    id: 'bosphorus-istanbul',
    name: 'Bosphorus · Istanbul',
    lat: 41.02, lon: 29.00,
    region: 'Bosphorus',
    category: 'chokepoint',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1674129823',
    note: 'Black Sea access, military passage monitoring',
    critical: true,
  },

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
  {
    id: 'panama-miraflores',
    name: 'Panama · Miraflores Locks',
    lat: 8.99, lon: -79.59,
    region: 'Panama',
    category: 'canal',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1614014828',
    note: 'Canal authority public feed',
    critical: true,
  },

  // ─── KOREAN DMZ ────────────────────────────────────────────────
  {
    id: 'korea-dmz',
    name: 'Korean DMZ · Panmunjom',
    lat: 37.96, lon: 126.67,
    region: 'Korea',
    category: 'border',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1727254901',
    note: 'Joint Security Area, closest public webcam',
    critical: true,
  },

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
  {
    id: 'moscow-redsquare',
    name: 'Moscow · Red Square',
    lat: 55.75, lon: 37.62,
    region: 'Russia',
    category: 'capital',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1647961927',
    note: 'Kremlin adjacent',
  },

  // ─── BEIJING ───────────────────────────────────────────────────
  {
    id: 'beijing-tiananmen',
    name: 'Beijing · Tiananmen (proxy)',
    lat: 39.90, lon: 116.40,
    region: 'China',
    category: 'capital',
    kind: 'iframe',
    url: 'https://www.windy.com/webcams/1727256031',
    note: 'Nearest public cam (no direct feed on Tiananmen itself)',
  },

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
