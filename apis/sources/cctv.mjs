// S.O.N CCTV adapter — self-healing webcam library
// v2: 2026-05-09 — migrated from hardcoded VIDEO_IDs to channel-based API
// resolution for YouTube streams. Uses the same pattern as news_live.mjs:
// stable CHANNEL_IDs resolve to the current live VIDEO_ID at sweep time.
//
// Fallback hierarchy:
//   1. YOUTUBE_API_KEY set → resolve live VIDEO_ID per channel (self-healing)
//   2. No key → use hardcoded fallback URL (will rot but won't crash)
//   3. Non-YouTube cams (iframe, hls) → probe URL directly
//
// Boot-time health validation: probe each camera, cache for 6h,
// filter dead/private/embed-disabled streams, attach thumbnails for healthy.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, '..', '..', 'runs', 'cache', 'cctv-health.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — tighter than old 24h since we self-heal now
const PROBE_TIMEOUT_MS = 6000;
const API_RESOLVE_TIMEOUT_MS = 5000;

// In-memory cache for API-resolved video IDs: { channelId: { videoId, cachedAt } }
const resolveCache = new Map();
const RESOLVE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — one resolve per two sweeps

// ─── Camera Registry ────────────────────────────────────────────────────
// Each YouTube cam has:
//   channelId: stable UCxxxx identifier (never rotates)
//   fallbackUrl: last-known-good embed URL (used when no API key)
//
// Non-YouTube cams (iframe, hls) keep their url as-is.

const CAMERAS = [
  // === Geopolitical / Chokepoint / Critical ===
  { id: 'kyiv-maidan', name: 'Kyiv · Maidan Square', lat: 50.45, lon: 30.52, region: 'Ukraine', category: 'city', kind: 'youtube', channelId: 'UC8lMKnge8OUOpaISZz8MHOA', fallbackUrl: 'https://www.youtube.com/embed/wMo4qAYQJQ0?autoplay=1&mute=1', channel: 'Maidan Live', critical: true },
  { id: 'istanbul-bosphorus-yt', name: 'Istanbul · Bosphorus', lat: 41.0425, lon: 29.0095, region: 'Bosphorus', category: 'chokepoint', kind: 'youtube', channelId: 'UCjWp-bPDrSANOkYHSBn3jdQ', fallbackUrl: 'https://www.youtube.com/embed/qXRYokWh3rU?autoplay=1&mute=1', channel: 'Istanbul Live', critical: true },
  { id: 'singapore-mbs', name: 'Singapore · Marina Bay', lat: 1.28, lon: 103.86, region: 'Singapore', category: 'port', kind: 'youtube', channelId: 'UC8M7o9SUmXJFEVpSWq_ZqjA', fallbackUrl: 'https://www.youtube.com/embed/c-TAm9-11Ms?autoplay=1&mute=1', channel: 'MBS Live', critical: true },
  { id: 'panama-miraflores-acp', name: 'Panama · Miraflores Locks', lat: 8.9925, lon: -79.5879, region: 'Panama', category: 'canal', kind: 'iframe', url: 'https://pancanal.com/wp-content/uploads/camaras/camara-miraflores.html', channel: 'Canal de Panama', critical: true },

  // === Capitals / Political ===
  { id: 'dc-whitehouse', name: 'Washington DC · White House', lat: 38.90, lon: -77.04, region: 'US', category: 'capital', kind: 'youtube', channelId: 'UCBhjMOUGqGsq1a6XkKgkLmA', fallbackUrl: 'https://www.youtube.com/embed/fv-OCQpDmXE?autoplay=1&mute=1', channel: 'EarthCam' },
  { id: 'moscow-kremlin-yt', name: 'Moscow · Red Square', lat: 55.7539, lon: 37.6208, region: 'Russia', category: 'capital', kind: 'youtube', channelId: 'UC1z0bFqE4Y4S2-x9Zp0w3tA', fallbackUrl: 'https://www.youtube.com/embed/js1y_TSHLDg?autoplay=1&mute=1', channel: 'Moscow Live' },
  { id: 'mexico-zocalo', name: 'Mexico City · Zocalo', lat: 19.4326, lon: -99.1332, region: 'Mexico', category: 'capital', kind: 'youtube', channelId: 'UC9rCxYp0NsXhwYHmDW0VPRw', fallbackUrl: 'https://www.youtube.com/embed/uV3wWHSvkfs?autoplay=1&mute=1', channel: 'webcamsdemexico' },

  // === Asia-Pacific ===
  { id: 'tokyo-shibuya-scramble', name: 'Tokyo · Shibuya Scramble', lat: 35.6595, lon: 139.7005, region: 'Japan', category: 'city', kind: 'youtube', channelId: 'UCGCBesENn3HfPLk7YA9UW7Q', fallbackUrl: 'https://www.youtube.com/embed/dfVK7ld38Ys?autoplay=1&mute=1', channel: 'ANNnewsCH' },
  { id: 'tokyo-dome', name: 'Tokyo · Dome City', lat: 35.7056, lon: 139.7519, region: 'Japan', category: 'city', kind: 'youtube', channelId: 'UCqmVzPDgB1U-fKhP0Oi_EPA', fallbackUrl: 'https://www.youtube.com/embed/7XzfKy8CzdY?autoplay=1&mute=1', channel: 'Tokyo Dome' },
  { id: 'seoul-hangang', name: 'Seoul · Hangang/Banpo', lat: 37.5110, lon: 126.9970, region: 'Korea', category: 'city', kind: 'youtube', channelId: 'UCQqXb6QLBerTNb_TBcR1jHA', fallbackUrl: 'https://www.youtube.com/embed/-JhoMGoAfFc?autoplay=1&mute=1', channel: 'Daily Seoul' },
  { id: 'seoul-gangnam', name: 'Seoul · Gangnam', lat: 37.4979, lon: 127.0276, region: 'Korea', category: 'city', kind: 'youtube', channelId: 'UCBhjMOUGqGsq1a6XkKgkLmA', fallbackUrl: 'https://www.youtube.com/embed/JbnJAsk1zII?autoplay=1&mute=1', channel: 'EarthCam' },
  { id: 'bangkok-sathorn', name: 'Bangkok · Sathorn/Silom', lat: 13.7250, lon: 100.5340, region: 'Thailand', category: 'city', kind: 'youtube', channelId: 'UCFKdFNMfbRUCMOJxJaMJQYQ', fallbackUrl: 'https://www.youtube.com/embed/pKbXm_Zoweo?autoplay=1&mute=1', channel: 'Live Webcam Bangkok' },
  { id: 'taipei-xiangshan', name: 'Taipei · Xiangshan', lat: 25.0269, lon: 121.5708, region: 'Taiwan', category: 'city', kind: 'youtube', channelId: 'UCyxD8_jv5zBjX1BLHBX9jIQ', fallbackUrl: 'https://www.youtube.com/embed/z_fY1pj1VBw?autoplay=1&mute=1', channel: 'Taipei Official' },
  { id: 'kl-skyline', name: 'Kuala Lumpur · Skyline', lat: 3.1730, lon: 101.6622, region: 'Malaysia', category: 'city', kind: 'youtube', channelId: 'UCvSnZwBZBXZC3v0tSmtGp3A', fallbackUrl: 'https://www.youtube.com/embed/x-9YJdKzXR0?autoplay=1&mute=1', channel: 'KL Skyline' },
  { id: 'hk-peak-24', name: 'Hong Kong · Peak', lat: 22.2783, lon: 114.1747, region: 'HongKong', category: 'city', kind: 'youtube', channelId: 'UCwVuqpYNGVB5p56Z0YLJoMg', fallbackUrl: 'https://www.youtube.com/embed/r1VOcQ1xUN0?autoplay=1&mute=1', channel: 'HK Peak Live' },
  { id: 'hk-earthtv', name: 'Hong Kong · Victoria Harbor', lat: 22.2946, lon: 114.1694, region: 'HongKong', category: 'city', kind: 'youtube', channelId: 'UCeSaIjRaYfBT4TYP14r1KPg', fallbackUrl: 'https://www.youtube.com/embed/qLogxA4vi_s?autoplay=1&mute=1', channel: 'earthTV' },
  { id: 'sydney-harbour', name: 'Sydney · Harbour', lat: -33.8568, lon: 151.2153, region: 'Australia', category: 'city', kind: 'youtube', channelId: 'UCwhnVkCGvl47CQYFHuYIVvA', fallbackUrl: 'https://www.youtube.com/embed/KPrrWB1eo1I?autoplay=1&mute=1', channel: 'WebcamSydney' },

  // === Europe ===
  { id: 'jerusalem-old-city', name: 'Jerusalem · Old City', lat: 31.78, lon: 35.23, region: 'Levant', category: 'city', kind: 'youtube', channelId: 'UCBhjMOUGqGsq1a6XkKgkLmA', fallbackUrl: 'https://www.youtube.com/embed/w8h_hu-B5hw?autoplay=1&mute=1', channel: 'EarthCam' },
  { id: 'london-abbey-road', name: 'London · Abbey Road', lat: 51.5320, lon: -0.1780, region: 'UK', category: 'city', kind: 'youtube', channelId: 'UCBhjMOUGqGsq1a6XkKgkLmA', fallbackUrl: 'https://www.youtube.com/embed/j-d93A6v73Q?autoplay=1&mute=1', channel: 'EarthCam' },
  { id: 'london-trafalgar', name: 'London · Trafalgar Square', lat: 51.5080, lon: -0.1281, region: 'UK', category: 'city', kind: 'youtube', channelId: 'UCT1csErNaGFWdAa_wrBnMKQ', fallbackUrl: 'https://www.youtube.com/embed/WLJqZpzhTe0?autoplay=1&mute=1', channel: 'London Live' },
  { id: 'paris-eiffel-peninsula', name: 'Paris · Eiffel Tower', lat: 48.8584, lon: 2.2945, region: 'France', category: 'city', kind: 'youtube', channelId: 'UC1ALJt3MzXj5-eNUBgL-_yQ', fallbackUrl: 'https://www.youtube.com/embed/iZipA1LL_sU?autoplay=1&mute=1', channel: 'Eiffel Tower Live' },
  { id: 'venice-grand-canal-yt', name: 'Venice · Grand Canal', lat: 45.4408, lon: 12.3155, region: 'Italy', category: 'city', kind: 'youtube', channelId: 'UCXEVwWmjKTCYK6X6Ckv9JWA', fallbackUrl: 'https://www.youtube.com/embed/P393gTj527k?autoplay=1&mute=1', channel: 'Venice Italy' },
  { id: 'dublin-temple-bar', name: 'Dublin · Temple Bar', lat: 53.3456, lon: -6.2644, region: 'Ireland', category: 'city', kind: 'youtube', channelId: 'UCBhjMOUGqGsq1a6XkKgkLmA', fallbackUrl: 'https://www.youtube.com/embed/3nyPER2kzqk?autoplay=1&mute=1', channel: 'EarthCam' },

  // === Americas ===
  { id: 'nyc-times-square-4k', name: 'NYC · Times Square 4K', lat: 40.7580, lon: -73.9855, region: 'US', category: 'city', kind: 'youtube', channelId: 'UCBhjMOUGqGsq1a6XkKgkLmA', fallbackUrl: 'https://www.youtube.com/embed/rnXIjl_Rzy4?autoplay=1&mute=1', channel: 'EarthCam' },
  { id: 'nyc-skyline-24', name: 'NYC · Skyline', lat: 40.7128, lon: -74.0060, region: 'US', category: 'city', kind: 'youtube', channelId: 'UCt5CjOdxwiK28vUvRxExQpA', fallbackUrl: 'https://www.youtube.com/embed/VGnFLdQW39A?autoplay=1&mute=1', channel: 'NYC Live Cam' },
  { id: 'la-venice-beach', name: 'LA · Venice Beach', lat: 33.9850, lon: -118.4695, region: 'US', category: 'city', kind: 'youtube', channelId: 'UCFw-bSWpPGR6TnYVqdT1pPQ', fallbackUrl: 'https://www.youtube.com/embed/98jOtUeM3m8?autoplay=1&mute=1', channel: 'Venice Beach Live' },
  { id: 'chicago-lakefront', name: 'Chicago · Lakefront', lat: 41.8881, lon: -87.6221, region: 'US', category: 'city', kind: 'youtube', channelId: 'UCCJRCGwh7oVYLe0hXD6F5Wg', fallbackUrl: 'https://www.youtube.com/embed/7nOlLczmWeg?autoplay=1&mute=1', channel: 'Lakefront Live' },
  { id: 'miami-collins', name: 'Miami · South Beach', lat: 25.7826, lon: -80.1340, region: 'US', category: 'city', kind: 'youtube', channelId: 'UCGMST7BuL1VWc-Hqg-LFWBg', fallbackUrl: 'https://www.youtube.com/embed/dk5gL33BqxM?autoplay=1&mute=1', channel: 'BLC Streams' },
  { id: 'rio-copacabana', name: 'Rio · Copacabana', lat: -22.9711, lon: -43.1822, region: 'Brazil', category: 'city', kind: 'youtube', channelId: 'UCR2XMHgq-o1BNwMlBjl_xKQ', fallbackUrl: 'https://www.youtube.com/embed/c0AZN6rz8Jk?autoplay=1&mute=1', channel: 'Rio World Live' },
  { id: 'rio-earthcam', name: 'Rio · Copacabana South', lat: -22.9861, lon: -43.1890, region: 'Brazil', category: 'city', kind: 'youtube', channelId: 'UCBhjMOUGqGsq1a6XkKgkLmA', fallbackUrl: 'https://www.youtube.com/embed/6QoLEltTzIM?autoplay=1&mute=1', channel: 'EarthCam' },

  // === Gulf / Middle East ===
  { id: 'dubai-marina', name: 'Dubai · Marina', lat: 25.08, lon: 55.14, region: 'Gulf', category: 'city', kind: 'youtube', channelId: 'UCBhjMOUGqGsq1a6XkKgkLmA', fallbackUrl: 'https://www.youtube.com/embed/nVS6Vk-wqfQ?autoplay=1&mute=1', channel: 'EarthCam' },

  // === Non-YouTube: iframe / earthTV ===
  { id: 'berlin-brandenburg-earthtv', name: 'Berlin · Brandenburg Gate', lat: 52.5163, lon: 13.3777, region: 'Germany', category: 'capital', kind: 'iframe', url: 'https://www.earthtv.com/en/embed/berlin-brandenburger-tor', channel: 'earthTV' },
  { id: 'jakarta-thamrin-earthtv', name: 'Jakarta · Thamrin', lat: -6.1944, lon: 106.8228, region: 'Indonesia', category: 'city', kind: 'iframe', url: 'https://www.earthtv.com/en/embed/jakarta-thamrin-district', channel: 'earthTV' },

  // === HLS Direct Streams (no YouTube dependency) ===
  { id: 'sf-bay-bridge-caltrans', name: 'SF · Bay Bridge', lat: 37.8199, lon: -122.3784, region: 'US', category: 'highway', kind: 'hls', url: 'https://wzmedia.dot.ca.gov/D4/80_EB_TreasureIsland.stream/playlist.m3u8', channel: 'Caltrans D4' },
  { id: 'la-101-caltrans', name: 'LA · 101 Hollywood', lat: 34.1017, lon: -118.3390, region: 'US', category: 'highway', kind: 'hls', url: 'https://wzmedia.dot.ca.gov/D7/101_HollywoodBlvd.stream/playlist.m3u8', channel: 'Caltrans D7' },
  { id: 'nyc-lincoln-tunnel', name: 'NYC · Lincoln Tunnel', lat: 40.7614, lon: -74.0028, region: 'US', category: 'highway', kind: 'iframe', url: 'https://511ny.org/map-embed.aspx#702', channel: '511NY' },
  { id: 'jackson-hole-square', name: 'Jackson Hole · Town Square', lat: 43.4799, lon: -110.7624, region: 'US', category: 'city', kind: 'iframe', url: 'https://www.see.cam/us/wy/jackson-hole/town-square', channel: 'see.cam' },
];

// ─── YouTube API Resolution (self-healing) ──────────────────────────────
// Same pattern as news_live.mjs: call search.list with channelId + eventType=live.
// Falls back to fallbackUrl if no key, or if channel isn't currently streaming.

const loggedErrors = new Set();

async function resolveYouTubeLive(apiKey, cam) {
  if (!cam.channelId) return null;

  // Check in-memory cache
  const hit = resolveCache.get(cam.channelId);
  if (hit && Date.now() - hit.cachedAt < RESOLVE_CACHE_TTL_MS) return hit;

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${cam.channelId}&eventType=live&type=video&maxResults=1&key=${apiKey}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), API_RESOLVE_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!r.ok) {
      if (!loggedErrors.has(`cctv-${cam.id}-${r.status}`)) {
        loggedErrors.add(`cctv-${cam.id}-${r.status}`);
        const reason = r.status === 403 ? 'quota or key issue' : r.status === 404 ? 'bad channel ID' : `HTTP ${r.status}`;
        console.warn(`[CCTV] ${cam.id} API resolve failed: ${reason}`);
      }
      resolveCache.set(cam.channelId, { videoId: null, cachedAt: Date.now() });
      return null;
    }
    const j = await r.json();
    const item = j.items?.[0];
    if (!item?.id?.videoId) {
      // Not currently live. Cache the miss.
      resolveCache.set(cam.channelId, { videoId: null, cachedAt: Date.now() });
      return null;
    }
    const resolved = {
      videoId: item.id.videoId,
      title: item.snippet?.title || cam.name,
      thumbnail: item.snippet?.thumbnails?.medium?.url || null,
      cachedAt: Date.now(),
    };
    resolveCache.set(cam.channelId, resolved);
    return resolved;
  } catch (e) {
    clearTimeout(t);
    if (!loggedErrors.has(`cctv-${cam.id}-net`)) {
      loggedErrors.add(`cctv-${cam.id}-net`);
      console.warn(`[CCTV] ${cam.id} network error: ${e.message}`);
    }
    return null;
  }
}

// ─── Health Probing ─────────────────────────────────────────────────────

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
    if (res.status === 401) return { healthy: false, reason: 'embed disabled' };
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

// ─── Cache ──────────────────────────────────────────────────────────────

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

// ─── Briefing ───────────────────────────────────────────────────────────

export async function briefing() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const useApi = !!apiKey;

  // Phase 1: Resolve live VIDEO_IDs for YouTube cameras via API (if key available)
  // This runs in parallel for all YouTube cameras with channelIds.
  const resolved = new Map(); // cam.id → { videoId, thumbnail, title }
  if (useApi) {
    const ytCams = CAMERAS.filter(c => c.kind === 'youtube' && c.channelId);
    const results = await Promise.all(ytCams.map(async cam => {
      const live = await resolveYouTubeLive(apiKey, cam);
      return { camId: cam.id, live };
    }));
    for (const { camId, live } of results) {
      if (live?.videoId) resolved.set(camId, live);
    }
  }

  // Phase 2: Build final camera list with resolved or fallback URLs
  const cameras = CAMERAS.map(cam => {
    if (cam.kind !== 'youtube') {
      // Non-YouTube: use url directly
      return { ...cam };
    }

    const live = resolved.get(cam.id);
    if (live?.videoId) {
      // API resolved a current live stream — self-healed!
      return {
        ...cam,
        url: `https://www.youtube.com/embed/${live.videoId}?autoplay=1&mute=1`,
        thumbnailUrl: live.thumbnail || `https://i.ytimg.com/vi/${live.videoId}/hqdefault.jpg`,
        resolvedTitle: live.title,
        resolvedAt: new Date(live.cachedAt).toISOString(),
        resolutionMethod: 'api',
      };
    }

    // Fallback to hardcoded URL (may be stale)
    return {
      ...cam,
      url: cam.fallbackUrl,
      resolutionMethod: useApi ? 'fallback-not-live' : 'fallback-no-key',
    };
  });

  // Phase 3: Health-probe all cameras (cache results)
  const cached = loadCache();
  let validated;

  if (cached && Array.isArray(cached.cameras) && cached.cameras.length === cameras.length) {
    // Use cache but overlay any API-resolved URLs
    const byId = new Map(cached.cameras.map(c => [c.id, c]));
    validated = cameras.map(c => {
      const cachedCam = byId.get(c.id);
      if (c.resolutionMethod === 'api') {
        // API-resolved: mark healthy (we just confirmed it's live)
        return { ...c, healthy: true, probedAt: new Date().toISOString() };
      }
      return { ...c, ...(cachedCam || { healthy: true }), url: c.url };
    });
  } else {
    // Full probe cycle
    const results = [];
    for (let i = 0; i < cameras.length; i += 12) {
      const batch = cameras.slice(i, i + 12);
      const r = await Promise.all(batch.map(async cam => {
        if (cam.resolutionMethod === 'api') {
          // API confirmed live — skip probe
          return { ...cam, healthy: true, probedAt: new Date().toISOString() };
        }
        // Probe the URL
        let probe;
        if (cam.kind === 'youtube') probe = await probeYouTube(cam);
        else if (cam.kind === 'iframe' || cam.kind === 'hls' || cam.kind === 'mjpeg') probe = await probeUrl(cam);
        else probe = { healthy: true };
        return { ...cam, ...probe, probedAt: new Date().toISOString() };
      }));
      results.push(...r);
    }
    validated = results;
    saveCache(new Date().toISOString(), validated);
  }

  const healthy = validated.filter(c => c.healthy);
  const dropped = validated.filter(c => !c.healthy);
  const apiResolved = validated.filter(c => c.resolutionMethod === 'api').length;
  const fallback = validated.filter(c => c.resolutionMethod?.startsWith('fallback')).length;

  return {
    cameras: healthy,
    totalCameras: healthy.length,
    droppedCount: dropped.length,
    droppedCameras: dropped.map(c => ({ id: c.id, name: c.name, reason: c.reason })),
    categories: [...new Set(healthy.map(c => c.category))],
    regions:    [...new Set(healthy.map(c => c.region))],
    apiResolved,
    fallbackCount: fallback,
    apiKeyPresent: useApi,
    healthCheckedAt: validated[0]?.probedAt || null,
    cacheUsed: !!cached,
  };
}

export { CAMERAS };
export default { briefing };
