// S.O.N · CCTV / public-webcam adapter
//
// 33 verified live streams, audited 2026-04-23. Three classes of stream so
// something plays in any browser:
//
//   kind: 'youtube'  → live YouTube embed (iframe src)
//   kind: 'hls'      → .m3u8 HLS stream, needs hls.js in client
//   kind: 'mjpeg'    → MJPEG or JPEG-refresh URL, renders inline
//   kind: 'iframe'   → generic iframe embed (earthTV, Panama Canal Authority, etc.)
//
// All entries are CURATED — no scraping, no rate limits. When a stream goes
// dark we swap it manually; the `verified` field is the last-known-good date
// per camera. Trustworthy surveillance curation beats a flaky scraper.
//
// History:
//   2026-04-22  6 cameras, mostly Windy.com embeds (later all dead — Windy bans iframe)
//   2026-04-23  33 cameras audited and verified, full continent coverage
//   2026-05-01  Registry rewritten from CCTV_LIBRARY_VERIFIED_2026-04-23.md
//
// Focus: chokepoints, conflict zones, strategic border crossings, major ports,
// capital squares, plus city-cam ambient feeds. Not tourism.

const CAMERAS = [
  // ─── UKRAINE / BLACK SEA ───────────────────────────────────────
  {
    id: 'kyiv-maidan',
    name: 'Kyiv · Maidan Square',
    lat: 50.45, lon: 30.52,
    region: 'Ukraine',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/wMo4qAYQJQ0?autoplay=1&mute=1',
    channel: 'Maidan Live',
    verified: '2026-04-23',
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
    channel: 'EarthCam',
    verified: '2026-04-23',
    note: 'EarthCam public live feed',
  },

  // ─── BOSPHORUS ─────────────────────────────────────────────────
  {
    id: 'istanbul-bosphorus-yt',
    name: 'Istanbul · Bosphorus Live',
    lat: 41.0425, lon: 29.0095,
    region: 'Bosphorus',
    category: 'chokepoint',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/qXRYokWh3rU?autoplay=1&mute=1',
    channel: 'Istanbul Live',
    verified: '2026-04-23',
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
    channel: 'MBS Live',
    verified: '2026-04-23',
    note: 'Busiest container port, Malacca anchor',
    critical: true,
  },

  // ─── PANAMA ────────────────────────────────────────────────────
  {
    id: 'panama-miraflores-acp',
    name: 'Panama · Miraflores Locks (ACP)',
    lat: 8.9925, lon: -79.5879,
    region: 'Panama',
    category: 'canal',
    kind: 'iframe',
    url: 'https://pancanal.com/wp-content/uploads/camaras/camara-miraflores.html',
    channel: 'Canal de Panamá',
    verified: '2026-04-23',
    note: 'Official ACP public iframe-ready cam',
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
    channel: 'EarthCam',
    verified: '2026-04-23',
    note: 'Live ambient stream',
  },

  // ─── MOSCOW ────────────────────────────────────────────────────
  {
    id: 'moscow-kremlin-yt',
    name: 'Moscow · Red Square',
    lat: 55.7539, lon: 37.6208,
    region: 'Russia',
    category: 'capital',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/js1y_TSHLDg?autoplay=1&mute=1',
    channel: 'Moscow Live',
    verified: '2026-04-23',
  },

  // ─── BERLIN ────────────────────────────────────────────────────
  {
    id: 'berlin-brandenburg-earthtv',
    name: 'Berlin · Brandenburg Gate',
    lat: 52.5163, lon: 13.3777,
    region: 'Germany',
    category: 'capital',
    kind: 'iframe',
    url: 'https://www.earthtv.com/en/embed/berlin-brandenburger-tor',
    channel: 'earthTV',
    verified: '2026-04-23',
  },

  // ─── ASIA-PACIFIC CITY CAMS ────────────────────────────────────
  {
    id: 'tokyo-shibuya-scramble',
    name: 'Tokyo · Shibuya Scramble',
    lat: 35.6595, lon: 139.7005,
    region: 'Japan',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/dfVK7ld38Ys?autoplay=1&mute=1',
    channel: 'ANNnewsCH',
    verified: '2026-04-23',
    note: '24/7 ambient, ANN News feed',
  },
  {
    id: 'tokyo-dome',
    name: 'Tokyo · Dome City',
    lat: 35.7056, lon: 139.7519,
    region: 'Japan',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/7XzfKy8CzdY?autoplay=1&mute=1',
    channel: 'Tokyo Dome City',
    verified: '2026-04-23',
  },
  {
    id: 'seoul-hangang',
    name: 'Seoul · Hangang/Banpo Bridge',
    lat: 37.5110, lon: 126.9970,
    region: 'Korea',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/-JhoMGoAfFc?autoplay=1&mute=1',
    channel: 'Daily Seoul',
    verified: '2026-04-23',
  },
  {
    id: 'seoul-gangnam',
    name: 'Seoul · Gangnam (EarthCam)',
    lat: 37.4979, lon: 127.0276,
    region: 'Korea',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/JbnJAsk1zII?autoplay=1&mute=1',
    channel: 'EarthCam',
    verified: '2026-04-23',
  },
  {
    id: 'bangkok-sathorn',
    name: 'Bangkok · Sathorn/Silom',
    lat: 13.7250, lon: 100.5340,
    region: 'Thailand',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/pKbXm_Zoweo?autoplay=1&mute=1',
    channel: 'Live Webcam Bangkok',
    verified: '2026-04-23',
  },
  {
    id: 'taipei-xiangshan',
    name: 'Taipei · Xiangshan Panorama',
    lat: 25.0269, lon: 121.5708,
    region: 'Taiwan',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/z_fY1pj1VBw?autoplay=1&mute=1',
    channel: 'Taipei City Official',
    verified: '2026-04-23',
  },
  {
    id: 'kl-skyline',
    name: 'Kuala Lumpur · Skyline (Petronas)',
    lat: 3.1730, lon: 101.6622,
    region: 'Malaysia',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/x-9YJdKzXR0?autoplay=1&mute=1',
    channel: 'KL Skyline Cam',
    verified: '2026-04-23',
  },
  {
    id: 'jakarta-thamrin-earthtv',
    name: 'Jakarta · Thamrin',
    lat: -6.1944, lon: 106.8228,
    region: 'Indonesia',
    category: 'city',
    kind: 'iframe',
    url: 'https://www.earthtv.com/en/embed/jakarta-thamrin-district',
    channel: 'earthTV',
    verified: '2026-04-23',
  },
  {
    id: 'hk-peak-24',
    name: 'Hong Kong · Victoria Harbour (Peak)',
    lat: 22.2783, lon: 114.1747,
    region: 'HongKong',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/r1VOcQ1xUN0?autoplay=1&mute=1',
    channel: 'HK Peak Live',
    verified: '2026-04-23',
  },
  {
    id: 'hk-earthtv',
    name: 'Hong Kong · Victoria Harbor (earthTV)',
    lat: 22.2946, lon: 114.1694,
    region: 'HongKong',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/qLogxA4vi_s?autoplay=1&mute=1',
    channel: 'earthTV',
    verified: '2026-04-23',
  },

  // ─── EUROPE CITY CAMS ──────────────────────────────────────────
  {
    id: 'london-abbey-road',
    name: 'London · Abbey Road Crossing',
    lat: 51.5320, lon: -0.1780,
    region: 'UK',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/j-d93A6v73Q?autoplay=1&mute=1',
    channel: 'EarthCam',
    verified: '2026-04-23',
  },
  {
    id: 'london-trafalgar',
    name: 'London · Trafalgar Square',
    lat: 51.5080, lon: -0.1281,
    region: 'UK',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/WLJqZpzhTe0?autoplay=1&mute=1',
    channel: 'London Live',
    verified: '2026-04-23',
  },
  {
    id: 'paris-eiffel-peninsula',
    name: 'Paris · Eiffel Tower (Peninsula)',
    lat: 48.8584, lon: 2.2945,
    region: 'France',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/iZipA1LL_sU?autoplay=1&mute=1',
    channel: 'Eiffel Tower Live Cam',
    verified: '2026-04-23',
  },
  {
    id: 'paris-palais-iena',
    name: 'Paris · Palais d\'Iéna',
    lat: 48.8625, lon: 2.2942,
    region: 'France',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/OzYp4NRZlwQ?autoplay=1&mute=1',
    channel: 'CESE',
    verified: '2026-04-23',
  },
  {
    id: 'venice-grand-canal-yt',
    name: 'Venice · Grand Canal',
    lat: 45.4408, lon: 12.3155,
    region: 'Italy',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/P393gTj527k?autoplay=1&mute=1',
    channel: 'Venice Italy Live',
    verified: '2026-04-23',
  },
  {
    id: 'dublin-temple-bar',
    name: 'Dublin · Temple Bar',
    lat: 53.3456, lon: -6.2644,
    region: 'Ireland',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/3nyPER2kzqk?autoplay=1&mute=1',
    channel: 'EarthCam',
    verified: '2026-04-23',
  },

  // ─── NORTH AMERICA CITY CAMS ───────────────────────────────────
  {
    id: 'nyc-times-square-4k',
    name: 'NYC · Times Square 4K',
    lat: 40.7580, lon: -73.9855,
    region: 'US',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/rnXIjl_Rzy4?autoplay=1&mute=1',
    channel: 'EarthCam',
    verified: '2026-04-23',
  },
  {
    id: 'nyc-times-square-crossroads',
    name: 'NYC · Times Square Crossroads',
    lat: 40.7580, lon: -73.9855,
    region: 'US',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/PGrq-2mju2s?autoplay=1&mute=1',
    channel: 'EarthCam',
    verified: '2026-04-23',
  },
  {
    id: 'nyc-skyline-24',
    name: 'NYC · Skyline / Streets',
    lat: 40.7128, lon: -74.0060,
    region: 'US',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/VGnFLdQW39A?autoplay=1&mute=1',
    channel: 'NYC Live Cam',
    verified: '2026-04-23',
  },
  {
    id: 'la-venice-beach',
    name: 'LA · Venice Beach North',
    lat: 33.9850, lon: -118.4695,
    region: 'US',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/98jOtUeM3m8?autoplay=1&mute=1',
    channel: 'Venice Beach Live',
    verified: '2026-04-23',
  },
  {
    id: 'chicago-lakefront',
    name: 'Chicago · Lakefront 24/7',
    lat: 41.8881, lon: -87.6221,
    region: 'US',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/7nOlLczmWeg?autoplay=1&mute=1',
    channel: 'Lakefront Live',
    verified: '2026-04-23',
  },
  {
    id: 'miami-collins',
    name: 'Miami · South Beach Collins',
    lat: 25.7826, lon: -80.1340,
    region: 'US',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/dk5gL33BqxM?autoplay=1&mute=1',
    channel: 'BLC Streams',
    verified: '2026-04-23',
  },
  {
    id: 'sf-bay-bridge-caltrans',
    name: 'SF · Bay Bridge (Caltrans)',
    lat: 37.8199, lon: -122.3784,
    region: 'US',
    category: 'highway',
    kind: 'hls',
    url: 'https://wzmedia.dot.ca.gov/D4/80_EB_TreasureIsland.stream/playlist.m3u8',
    channel: 'Caltrans D4',
    verified: '2026-04-23',
  },
  {
    id: 'mexico-zocalo',
    name: 'Mexico City · Zócalo',
    lat: 19.4326, lon: -99.1332,
    region: 'Mexico',
    category: 'capital',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/uV3wWHSvkfs?autoplay=1&mute=1',
    channel: 'webcamsdemexico',
    verified: '2026-04-23',
  },

  // ─── SOUTH AMERICA ─────────────────────────────────────────────
  {
    id: 'rio-copacabana',
    name: 'Rio · Copacabana',
    lat: -22.9711, lon: -43.1822,
    region: 'Brazil',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/c0AZN6rz8Jk?autoplay=1&mute=1',
    channel: 'Rio World Live',
    verified: '2026-04-23',
  },
  {
    id: 'rio-earthcam',
    name: 'Rio · Copacabana South (EarthCam)',
    lat: -22.9861, lon: -43.1890,
    region: 'Brazil',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/6QoLEltTzIM?autoplay=1&mute=1',
    channel: 'EarthCam',
    verified: '2026-04-23',
  },

  // ─── OCEANIA ───────────────────────────────────────────────────
  {
    id: 'sydney-harbour',
    name: 'Sydney · Harbour Bridge & Opera House',
    lat: -33.8568, lon: 151.2153,
    region: 'Australia',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/KPrrWB1eo1I?autoplay=1&mute=1',
    channel: 'WebcamSydney',
    verified: '2026-04-23',
  },

  // ─── GULF ──────────────────────────────────────────────────────
  {
    id: 'dubai-marina',
    name: 'Dubai · Marina',
    lat: 25.08, lon: 55.14,
    region: 'Gulf',
    category: 'city',
    kind: 'youtube',
    url: 'https://www.youtube.com/embed/nVS6Vk-wqfQ?autoplay=1&mute=1',
    channel: 'EarthCam',
    verified: '2026-04-23',
    note: 'EarthCam public feed',
  },
];

export async function briefing() {
  // Pure curation — no network call. `verified` per camera lets the client
  // surface a "stale" badge when a stream's last-verified date crosses a
  // threshold (e.g. 90 days), prompting an audit refresh.
  return {
    cameras: CAMERAS,
    totalCameras: CAMERAS.length,
    categories: [...new Set(CAMERAS.map(c => c.category))],
    regions:    [...new Set(CAMERAS.map(c => c.region))],
    lastVerified: '2026-04-23',
  };
}

export default { briefing };
