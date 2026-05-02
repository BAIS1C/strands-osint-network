// S.O.N CCTV adapter - 33 verified streams audited 2026-04-23
// Per CCTV_LIBRARY_VERIFIED_2026-04-23.md
// Boot-time health validation: probe each camera, cache for 24h,
// filter dead/private/embed-disabled streams, attach thumbnails for healthy.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, '..', '..', 'runs', 'cache', 'cctv-health.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROBE_TIMEOUT_MS = 6000;

const CAMERAS = [
  { id: 'kyiv-maidan', name: 'Kyiv · Maidan Square', lat: 50.45, lon: 30.52, region: 'Ukraine', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/wMo4qAYQJQ0?autoplay=1&mute=1', channel: 'Maidan Live', verified: '2026-04-23', critical: true },
  { id: 'jerusalem-old-city', name: 'Jerusalem · Old City', lat: 31.78, lon: 35.23, region: 'Levant', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/w8h_hu-B5hw?autoplay=1&mute=1', channel: 'EarthCam', verified: '2026-04-23' },
  { id: 'istanbul-bosphorus-yt', name: 'Istanbul · Bosphorus', lat: 41.0425, lon: 29.0095, region: 'Bosphorus', category: 'chokepoint', kind: 'youtube', url: 'https://www.youtube.com/embed/qXRYokWh3rU?autoplay=1&mute=1', channel: 'Istanbul Live', verified: '2026-04-23', critical: true },
  { id: 'singapore-mbs', name: 'Singapore · Marina Bay', lat: 1.28, lon: 103.86, region: 'Singapore', category: 'port', kind: 'youtube', url: 'https://www.youtube.com/embed/c-TAm9-11Ms?autoplay=1&mute=1', channel: 'MBS Live', verified: '2026-04-23', critical: true },
  { id: 'panama-miraflores-acp', name: 'Panama · Miraflores Locks', lat: 8.9925, lon: -79.5879, region: 'Panama', category: 'canal', kind: 'iframe', url: 'https://pancanal.com/wp-content/uploads/camaras/camara-miraflores.html', channel: 'Canal de Panama', verified: '2026-04-23', critical: true },
  { id: 'dc-whitehouse', name: 'Washington DC · White House', lat: 38.90, lon: -77.04, region: 'US', category: 'capital', kind: 'youtube', url: 'https://www.youtube.com/embed/fv-OCQpDmXE?autoplay=1&mute=1', channel: 'EarthCam', verified: '2026-04-23' },
  { id: 'moscow-kremlin-yt', name: 'Moscow · Red Square', lat: 55.7539, lon: 37.6208, region: 'Russia', category: 'capital', kind: 'youtube', url: 'https://www.youtube.com/embed/js1y_TSHLDg?autoplay=1&mute=1', channel: 'Moscow Live', verified: '2026-04-23' },
  { id: 'berlin-brandenburg-earthtv', name: 'Berlin · Brandenburg Gate', lat: 52.5163, lon: 13.3777, region: 'Germany', category: 'capital', kind: 'iframe', url: 'https://www.earthtv.com/en/embed/berlin-brandenburger-tor', channel: 'earthTV', verified: '2026-04-23' },
  { id: 'tokyo-shibuya-scramble', name: 'Tokyo · Shibuya Scramble', lat: 35.6595, lon: 139.7005, region: 'Japan', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/dfVK7ld38Ys?autoplay=1&mute=1', channel: 'ANNnewsCH', verified: '2026-04-23' },
  { id: 'tokyo-dome', name: 'Tokyo · Dome City', lat: 35.7056, lon: 139.7519, region: 'Japan', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/7XzfKy8CzdY?autoplay=1&mute=1', channel: 'Tokyo Dome', verified: '2026-04-23' },
  { id: 'seoul-hangang', name: 'Seoul · Hangang/Banpo', lat: 37.5110, lon: 126.9970, region: 'Korea', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/-JhoMGoAfFc?autoplay=1&mute=1', channel: 'Daily Seoul', verified: '2026-04-23' },
  { id: 'seoul-gangnam', name: 'Seoul · Gangnam', lat: 37.4979, lon: 127.0276, region: 'Korea', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/JbnJAsk1zII?autoplay=1&mute=1', channel: 'EarthCam', verified: '2026-04-23' },
  { id: 'bangkok-sathorn', name: 'Bangkok · Sathorn/Silom', lat: 13.7250, lon: 100.5340, region: 'Thailand', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/pKbXm_Zoweo?autoplay=1&mute=1', channel: 'Live Webcam Bangkok', verified: '2026-04-23' },
  { id: 'taipei-xiangshan', name: 'Taipei · Xiangshan', lat: 25.0269, lon: 121.5708, region: 'Taiwan', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/z_fY1pj1VBw?autoplay=1&mute=1', channel: 'Taipei Official', verified: '2026-04-23' },
  { id: 'kl-skyline', name: 'Kuala Lumpur · Skyline', lat: 3.1730, lon: 101.6622, region: 'Malaysia', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/x-9YJdKzXR0?autoplay=1&mute=1', channel: 'KL Skyline', verified: '2026-04-23' },
  { id: 'jakarta-thamrin-earthtv', name: 'Jakarta · Thamrin', lat: -6.1944, lon: 106.8228, region: 'Indonesia', category: 'city', kind: 'iframe', url: 'https://www.earthtv.com/en/embed/jakarta-thamrin-district', channel: 'earthTV', verified: '2026-04-23' },
  { id: 'hk-peak-24', name: 'Hong Kong · Peak', lat: 22.2783, lon: 114.1747, region: 'HongKong', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/r1VOcQ1xUN0?autoplay=1&mute=1', channel: 'HK Peak Live', verified: '2026-04-23' },
  { id: 'hk-earthtv', name: 'Hong Kong · Victoria Harbor', lat: 22.2946, lon: 114.1694, region: 'HongKong', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/qLogxA4vi_s?autoplay=1&mute=1', channel: 'earthTV', verified: '2026-04-23' },
  { id: 'london-abbey-road', name: 'London · Abbey Road', lat: 51.5320, lon: -0.1780, region: 'UK', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/j-d93A6v73Q?autoplay=1&mute=1', channel: 'EarthCam', verified: '2026-04-23' },
  { id: 'london-trafalgar', name: 'London · Trafalgar Square', lat: 51.5080, lon: -0.1281, region: 'UK', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/WLJqZpzhTe0?autoplay=1&mute=1', channel: 'London Live', verified: '2026-04-23' },
  { id: 'paris-eiffel-peninsula', name: 'Paris · Eiffel Tower', lat: 48.8584, lon: 2.2945, region: 'France', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/iZipA1LL_sU?autoplay=1&mute=1', channel: 'Eiffel Tower Live', verified: '2026-04-23' },
  { id: 'paris-palais-iena', name: 'Paris · Palais Iena', lat: 48.8625, lon: 2.2942, region: 'France', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/OzYp4NRZlwQ?autoplay=1&mute=1', channel: 'CESE', verified: '2026-04-23' },
  { id: 'venice-grand-canal-yt', name: 'Venice · Grand Canal', lat: 45.4408, lon: 12.3155, region: 'Italy', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/P393gTj527k?autoplay=1&mute=1', channel: 'Venice Italy', verified: '2026-04-23' },
  { id: 'dublin-temple-bar', name: 'Dublin · Temple Bar', lat: 53.3456, lon: -6.2644, region: 'Ireland', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/3nyPER2kzqk?autoplay=1&mute=1', channel: 'EarthCam', verified: '2026-04-23' },
  { id: 'nyc-times-square-4k', name: 'NYC · Times Square 4K', lat: 40.7580, lon: -73.9855, region: 'US', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/rnXIjl_Rzy4?autoplay=1&mute=1', channel: 'EarthCam', verified: '2026-04-23' },
  { id: 'nyc-times-square-crossroads', name: 'NYC · Times Square Crossroads', lat: 40.7580, lon: -73.9855, region: 'US', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/PGrq-2mju2s?autoplay=1&mute=1', channel: 'EarthCam', verified: '2026-04-23' },
  { id: 'nyc-skyline-24', name: 'NYC · Skyline', lat: 40.7128, lon: -74.0060, region: 'US', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/VGnFLdQW39A?autoplay=1&mute=1', channel: 'NYC Live Cam', verified: '2026-04-23' },
  { id: 'la-venice-beach', name: 'LA · Venice Beach', lat: 33.9850, lon: -118.4695, region: 'US', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/98jOtUeM3m8?autoplay=1&mute=1', channel: 'Venice Beach Live', verified: '2026-04-23' },
  { id: 'chicago-lakefront', name: 'Chicago · Lakefront', lat: 41.8881, lon: -87.6221, region: 'US', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/7nOlLczmWeg?autoplay=1&mute=1', channel: 'Lakefront Live', verified: '2026-04-23' },
  { id: 'miami-collins', name: 'Miami · South Beach', lat: 25.7826, lon: -80.1340, region: 'US', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/dk5gL33BqxM?autoplay=1&mute=1', channel: 'BLC Streams', verified: '2026-04-23' },
  { id: 'sf-bay-bridge-caltrans', name: 'SF · Bay Bridge', lat: 37.8199, lon: -122.3784, region: 'US', category: 'highway', kind: 'hls', url: 'https://wzmedia.dot.ca.gov/D4/80_EB_TreasureIsland.stream/playlist.m3u8', channel: 'Caltrans D4', verified: '2026-04-23' },
  { id: 'mexico-zocalo', name: 'Mexico City · Zocalo', lat: 19.4326, lon: -99.1332, region: 'Mexico', category: 'capital', kind: 'youtube', url: 'https://www.youtube.com/embed/uV3wWHSvkfs?autoplay=1&mute=1', channel: 'webcamsdemexico', verified: '2026-04-23' },
  { id: 'rio-copacabana', name: 'Rio · Copacabana', lat: -22.9711, lon: -43.1822, region: 'Brazil', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/c0AZN6rz8Jk?autoplay=1&mute=1', channel: 'Rio World Live', verified: '2026-04-23' },
  { id: 'rio-earthcam', name: 'Rio · Copacabana South', lat: -22.9861, lon: -43.1890, region: 'Brazil', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/6QoLEltTzIM?autoplay=1&mute=1', channel: 'EarthCam', verified: '2026-04-23' },
  { id: 'sydney-harbour', name: 'Sydney · Harbour', lat: -33.8568, lon: 151.2153, region: 'Australia', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/KPrrWB1eo1I?autoplay=1&mute=1', channel: 'WebcamSydney', verified: '2026-04-23' },
  { id: 'dubai-marina', name: 'Dubai · Marina', lat: 25.08, lon: 55.14, region: 'Gulf', category: 'city', kind: 'youtube', url: 'https://www.youtube.com/embed/nVS6Vk-wqfQ?autoplay=1&mute=1', channel: 'EarthCam', verified: '2026-04-23' },
];

function extractYouTubeId(url) {
  const m = url.match(/\/embed\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function probeYouTube(cam) {
  const videoId = extractYouTubeId(cam.url);
  if (!videoId) return { healthy: false, reason: 'no video id parsed' };
  const oembed = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  try {
    const res = await fetch(oembed, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (res.status === 200) {
      const j = await res.json().catch(() => ({}));
      return {
        healthy: true,
        thumbnailUrl: j.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        oembedTitle: j.title || null,
        oembedAuthor: j.author_name || null,
      };
    }
    if (res.status === 401) return { healthy: false, reason: 'embed disabled (private or owner-blocked)' };
    if (res.status === 404) return { healthy: false, reason: 'video not found' };
    return { healthy: false, reason: `oembed HTTP ${res.status}` };
  } catch (e) {
    return { healthy: false, reason: e.name === 'TimeoutError' ? 'oembed timeout' : e.message };
  }
}

async function probeUrl(cam) {
  try {
    const res = await fetch(cam.url, { method: 'HEAD', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (res.ok) return { healthy: true };
    return { healthy: false, reason: `HTTP ${res.status}` };
  } catch (e) {
    return { healthy: false, reason: e.name === 'TimeoutError' ? 'timeout' : e.message };
  }
}

async function validateCamera(cam) {
  let probe;
  if (cam.kind === 'youtube') probe = await probeYouTube(cam);
  else if (cam.kind === 'iframe' || cam.kind === 'hls' || cam.kind === 'mjpeg') probe = await probeUrl(cam);
  else probe = { healthy: true };
  return { ...cam, ...probe, probedAt: new Date().toISOString() };
}

function loadCache() {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    const ageMs = Date.now() - new Date(raw.builtAt).getTime();
    if (ageMs > CACHE_TTL_MS) return null;
    return raw;
  } catch { return null; }
}

function saveCache(builtAt, cameras) {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify({ builtAt, cameras }, null, 2));
  } catch (e) {
    console.error('[CCTV] cache write failed:', e.message);
  }
}

export async function briefing() {
  const cached = loadCache();
  let validated;
  if (cached && Array.isArray(cached.cameras) && cached.cameras.length === CAMERAS.length) {
    const byId = new Map(cached.cameras.map(c => [c.id, c]));
    validated = CAMERAS.map(c => ({ ...c, ...(byId.get(c.id) || { healthy: true }) }));
  } else {
    const results = [];
    for (let i = 0; i < CAMERAS.length; i += 12) {
      const batch = CAMERAS.slice(i, i + 12);
      const r = await Promise.all(batch.map(validateCamera));
      results.push(...r);
    }
    validated = results;
    saveCache(new Date().toISOString(), validated);
  }

  const healthy = validated.filter(c => c.healthy);
  const dropped = validated.filter(c => !c.healthy);

  return {
    cameras: healthy,
    totalCameras: healthy.length,
    droppedCount: dropped.length,
    droppedCameras: dropped.map(c => ({ id: c.id, name: c.name, reason: c.reason })),
    categories: [...new Set(healthy.map(c => c.category))],
    regions:    [...new Set(healthy.map(c => c.region))],
    lastVerified: '2026-04-23',
    healthCheckedAt: validated[0]?.probedAt || null,
    cacheUsed: !!cached,
  };
}

export default { briefing };
