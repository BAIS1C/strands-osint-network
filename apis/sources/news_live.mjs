// 24/7 News Live — YouTube Data API v3 resolver for continuously-streaming broadcasters.
//
// Why this adapter exists:
//   Hardcoding VIDEO_IDs for 24/7 news livestreams is fragile. Networks restart
//   their live feed every few weeks to months, which rotates the video ID and
//   breaks every embed we baked in. Channel IDs (UCxxx...) are stable forever.
//
// How it works:
//   For each entry in CHANNEL_REGISTRY, we hit the YouTube Data API:
//     search.list?part=snippet&channelId=UCxxx&eventType=live&type=video&key=...
//   If the channel is currently broadcasting live, we get the CURRENT video ID.
//   If it's not streaming right now, we skip it quietly.
//
// Cost:
//   search.list = 100 quota units per call. Default free quota = 10,000 units/day.
//   With ~20 channels × 4 sweeps/hour × 24 hours = 1,920 calls/day × 100 = 192k units.
//   That blows the free tier, so the adapter caches live IDs for 15 minutes
//   (matches the sweep interval). Effective cost: ~1 call per channel per sweep.
//
// Set YOUTUBE_API_KEY in .env. Register a free key at:
//   https://console.cloud.google.com → APIs & Services → Credentials → YouTube Data API v3

const CHANNEL_REGISTRY = [
  // --- Global English-language 24/7 news ---
  { id: 'aje',         name: 'Al Jazeera English',    network: 'Al Jazeera Media',   country: 'Qatar',       lat: 25.2697, lon: 51.5200, channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
  { id: 'dw-news',     name: 'DW News',               network: 'Deutsche Welle',     country: 'Germany',     lat: 50.7374, lon: 7.0982,  channelId: 'UCknLrEdhRCp1aegoMqRaCZg' },
  { id: 'france24-en', name: 'FRANCE 24 English',     network: 'France Médias Monde',country: 'France',      lat: 48.8566, lon: 2.3522,  channelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg' },
  { id: 'sky-news',    name: 'Sky News',              network: 'Sky Group',          country: 'UK',          lat: 51.5074, lon: -0.1278, channelId: 'UCoMdktPbSTixAyNGwb-UYkQ' },
  { id: 'euronews-en', name: 'Euronews English',      network: 'Euronews',           country: 'France',      lat: 45.7578, lon: 4.8320,  channelId: 'UCSrZ3UV4jOidv8ppoVuvW9Q' },
  { id: 'trt-world',   name: 'TRT World',             network: 'TRT',                country: 'Turkey',      lat: 41.0082, lon: 28.9784, channelId: 'UC7fWeaHhqgM4Ry-RMpM2YYw' },

  // --- US broadcasters (most have 24/7 streaming news services) ---
  { id: 'bloomberg-tv',   name: 'Bloomberg Television', network: 'Bloomberg',    country: 'US', lat: 40.7589, lon: -73.9849, channelId: 'UCUMZ7gohGI9HcU9VNsr2FJQ' },
  { id: 'bloomberg-orig', name: 'Bloomberg Originals',  network: 'Bloomberg',    country: 'US', lat: 40.7589, lon: -73.9849, channelId: 'UCIALMKvObZNtJ6AmdCLP7Lg' },
  { id: 'cnbc',           name: 'CNBC',                 network: 'NBCUniversal', country: 'US', lat: 40.8893, lon: -74.0125, channelId: 'UCvJJ_dzjViJCoLf5uKUTwoA' },
  { id: 'nbc-news-now',   name: 'NBC News NOW',         network: 'NBCUniversal', country: 'US', lat: 40.7589, lon: -73.9849, channelId: 'UCeY0bbntWzzVIaj2z3QigXg' },
  { id: 'cbs-news',       name: 'CBS News',             network: 'Paramount',    country: 'US', lat: 40.7589, lon: -73.9849, channelId: 'UC8p1vwvWtl6T73JiExfWs1g' },
  { id: 'abc-news',       name: 'ABC News',             network: 'Disney',       country: 'US', lat: 40.7589, lon: -73.9849, channelId: 'UCBi2mrWuNuyYy4gbM6fU18Q' },
  { id: 'livenow-fox',    name: 'LiveNOW from FOX',     network: 'Fox Corp',     country: 'US', lat: 40.7589, lon: -73.9849, channelId: 'UCiiUIhyAlQMICm0_zJw5y3Q' },
  { id: 'newsnation',     name: 'NewsNation',           network: 'Nexstar',      country: 'US', lat: 41.8781, lon: -87.6298, channelId: 'UC62RZjFGW0fzdIoLe8_Xe5w' },

  // --- Asia ---
  { id: 'nhk-world',     name: 'NHK WORLD-JAPAN',    network: 'NHK',            country: 'Japan',        lat: 35.6762, lon: 139.6503, channelId: 'UCSPEjw8F2nQDtmUKPFNF7_A' },
  { id: 'arirang',       name: 'Arirang News',       network: 'Arirang',        country: 'South Korea',  lat: 37.5665, lon: 126.9780, channelId: 'UCXfvzhJd_DCwsszvDMvsGpQ' },
  { id: 'kbs-world',     name: 'KBS World News',     network: 'KBS',            country: 'South Korea',  lat: 37.5665, lon: 126.9780, channelId: 'UCKWtASqgUBQGPmnk4Sfb3wA' },
  { id: 'wion',          name: 'WION',               network: 'Zee Media',      country: 'India',        lat: 28.6139, lon: 77.2090,  channelId: 'UC_gUM8rL-Lrg6O3adPW9K1g' },
  { id: 'cna',           name: 'CNA',                network: 'Mediacorp',      country: 'Singapore',    lat: 1.3521,  lon: 103.8198, channelId: 'UCD844fB1VzbmFpSe4u9SZ7Q' },

  // --- Oceania ---
  { id: 'abc-au',        name: 'ABC News (Australia)', network: 'ABC',          country: 'Australia',    lat: -33.8688, lon: 151.2093, channelId: 'UCVgO39Bk5sMo66-6o6Supjg' },

  // --- Middle East ---
  { id: 'i24-en',        name: 'i24NEWS English',    network: 'i24NEWS',        country: 'Israel',       lat: 32.0853, lon: 34.7818,  channelId: 'UC2PrSuR40FIvrJ0Xg0qjFCg' },
  { id: 'al-arabiya-en', name: 'Al Arabiya English', network: 'MBC',            country: 'UAE',          lat: 25.2048, lon: 55.2708,  channelId: 'UCv5FM4qAWUs0n7xaUoJPTLg' },

  // --- Americas beyond US ---
  { id: 'cbc-news',      name: 'CBC News',           network: 'CBC',            country: 'Canada',       lat: 43.6532, lon: -79.3832, channelId: 'UCuFFtHWoLl5fauMMD5Ww2jA' },
];

// In-memory cache: { [channelId]: { videoId, cachedAt, title, thumbnail, error? } }
const cache = new Map();
// Cache window. Default 30 min balances freshness vs free-tier quota.
// Override with YOUTUBE_CACHE_MINUTES in .env (set to 60 for strictly-free-tier budget).
const CACHE_TTL_MS = (Number(process.env.YOUTUBE_CACHE_MINUTES) || 30) * 60 * 1000;

// Diagnostic: we log bad channel IDs once per process so the operator can spot
// typos or deleted channels without log spam on every sweep.
const loggedErrors = new Set();

async function resolveLiveVideo(apiKey, ch) {
  // Check cache first — saves quota units on back-to-back sweeps.
  const hit = cache.get(ch.channelId);
  if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) return hit;

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${ch.channelId}&eventType=live&type=video&maxResults=1&key=${apiKey}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!r.ok) {
      // 403 = quota exhausted or key invalid. 404 = bad channel ID.
      // Surface loudly once so operator can fix.
      if (!loggedErrors.has(`${ch.id}-${r.status}`)) {
        loggedErrors.add(`${ch.id}-${r.status}`);
        const body = await r.text().catch(() => '');
        const reason = r.status === 403 ? 'quota or key issue'
                     : r.status === 404 ? 'bad channel ID (check registry)'
                     : `HTTP ${r.status}`;
        console.warn(`[NewsLive] ${ch.id} (${ch.name}) failed: ${reason}`, body.slice(0, 200));
      }
      cache.set(ch.channelId, { videoId: null, cachedAt: Date.now(), error: r.status });
      return null;
    }
    const j = await r.json();
    const item = j.items?.[0];
    if (!item?.id?.videoId) {
      // Not currently live — cache the null so we don't hammer the API.
      cache.set(ch.channelId, { videoId: null, cachedAt: Date.now() });
      return null;
    }
    const resolved = {
      videoId: item.id.videoId,
      title: item.snippet?.title || ch.name,
      thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
      cachedAt: Date.now(),
    };
    cache.set(ch.channelId, resolved);
    return resolved;
  } catch (e) {
    clearTimeout(t);
    if (!loggedErrors.has(`${ch.id}-network`)) {
      loggedErrors.add(`${ch.id}-network`);
      console.warn(`[NewsLive] ${ch.id} network error: ${e.message}`);
    }
    return null;
  }
}

export async function briefing() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return {
      source: 'News-Live/YouTube',
      timestamp: new Date().toISOString(),
      status: 'no_key',
      message: 'Set YOUTUBE_API_KEY (free at console.cloud.google.com → YouTube Data API v3) to resolve currently-live streams per broadcaster.',
      streams: [],
      channelRegistry: CHANNEL_REGISTRY.length,
      registry: CHANNEL_REGISTRY.map(c => ({ id: c.id, name: c.name, country: c.country })),
    };
  }

  // Resolve in parallel. Each call is cheap; we just don't want serial latency
  // if all 25 are live at once.
  const resolved = await Promise.all(CHANNEL_REGISTRY.map(async ch => {
    const live = await resolveLiveVideo(apiKey, ch);
    if (!live?.videoId) return null;
    return {
      id: `news-live-${ch.id}`,
      name: ch.name,
      network: ch.network,
      country: ch.country,
      lat: ch.lat,
      lon: ch.lon,
      video_id: live.videoId,
      url: `https://www.youtube.com/embed/${live.videoId}`,
      kind: 'youtube',
      category: 'news-live',
      title: live.title,
      thumbnail: live.thumbnail,
      verified_live: new Date(live.cachedAt).toISOString(),
    };
  }));

  const streams = resolved.filter(Boolean);

  // Summary line so operator can see channel health on each sweep.
  const badIds = [...cache.entries()]
    .filter(([, v]) => v.error === 404)
    .map(([k]) => CHANNEL_REGISTRY.find(c => c.channelId === k)?.id)
    .filter(Boolean);

  return {
    source: 'News-Live/YouTube',
    timestamp: new Date().toISOString(),
    status: 'ok',
    streams,
    channelRegistry: CHANNEL_REGISTRY.length,
    liveCount: streams.length,
    offlineCount: CHANNEL_REGISTRY.length - streams.length,
    cacheMinutes: CACHE_TTL_MS / 60000,
    invalidChannelIds: badIds,
  };
}

export { CHANNEL_REGISTRY };

// Run standalone for quick verification: `node apis/sources/news_live.mjs`
if (process.argv[1]?.endsWith('news_live.mjs')) {
  const data = await briefing();
  console.log(JSON.stringify(data, null, 2));
}
