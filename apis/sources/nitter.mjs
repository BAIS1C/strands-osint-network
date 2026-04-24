// Nitter / X scraping — geo-located tweets from curated OSINT handles.
//
// Twitter/X killed their public API in 2023; the only reliable way to get
// tweets without a paid key is via a Nitter mirror. Mirrors are flaky and
// frequently blocked, so this adapter tries a list of mirrors and accepts
// the first one that works per handle. It also gracefully degrades to
// empty if nothing responds: the rest of the sweep still runs.
//
// Handles were picked because their feeds are dense with geo-named signals
// that the synthesize() geoTagText function can map to coordinates.
//
// Output shape:
//   { source: 'Nitter', posts: [{ id, text, author, date, url }], mirror, timestamp }
//
// The Social Signals layer in worldview/app.js consumes data.sources.Nitter.posts
// after inject.mjs geo-tags them.
//
// Set NITTER_HANDLES="handle1,handle2,..." in .env to override the default list.
// Set NITTER_MIRRORS="https://xcancel.com,https://nitter.poast.org,..." to override
// the mirror fallback order.

const DEFAULT_MIRRORS = [
  'https://xcancel.com',
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.net',
  'https://nitter.cz',
  'https://nitter.fdn.fr',
];

// Curated OSINT accounts that post geo-dense content. The geoTagText function
// in dashboard/inject.mjs will place their tweets on the map by matching
// country / city / leader / institution names.
const DEFAULT_HANDLES = [
  'Conflicts',          // Conflicts ranking
  'sentdefender',       // SentDefender
  'IntelCrab',          // IntelCrab
  'visegrad24',         // Visegrad 24
  'IAPonomarenko',      // Illia Ponomarenko
  'OSINTdefender',      // OSINTdefender
  'WarMonitors',        // War Monitors
  'IsraelRadar_com',    // Israel Radar
  'AuroraIntel',        // Aurora Intel
  'DefenceU',           // Defence of Ukraine
  'TheIntelTimes',      // The Intel Times
];

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCharCode(parseInt(c, 16)));
}

function stripHtml(s) {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseNitterRss(xml, handle, mirror) {
  if (!xml || typeof xml !== 'string') return [];
  const out = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const rawTitle = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] || '').trim();
    const rawDesc = (block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] || '').trim();
    // Nitter titles often begin with "R to @someone:" or the tweet text itself.
    // Description carries the HTML version; strip and prefer it if longer.
    const titleText = decodeEntities(rawTitle);
    const descText = decodeEntities(stripHtml(rawDesc));
    const text = (descText && descText.length > titleText.length) ? descText : titleText;
    const link = (block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)?.[1] || '').trim();
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '').trim();
    const guid = (block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] || '').trim();

    if (!text) continue;
    // Rewrite nitter link to x.com so clicking the inspector opens the real tweet
    let url = link;
    try {
      const u = new URL(link);
      // Nitter paths mirror Twitter's: /handle/status/id
      if (u.pathname.match(/^\/[^/]+\/status\/\d+/)) {
        url = `https://x.com${u.pathname}`;
      }
    } catch { /* leave as-is */ }

    out.push({
      id: guid || `${handle}-${pubDate}`,
      text: text.substring(0, 280),
      author: `@${handle}`,
      date: pubDate || new Date().toISOString(),
      url: url || undefined,
      mirror,
    });
  }
  return out;
}

async function fetchOne(mirror, handle, timeout = 7000) {
  const url = `${mirror}/${handle}/rss`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'S.O.N/2.0 (+https://strandsnation.xyz)' },
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, status: res.status };
    const text = await res.text();
    // Heuristic — mirror returns a Nitter error page instead of an RSS feed.
    if (!text.includes('<rss') && !text.includes('<item')) {
      return { ok: false, status: res.status, reason: 'not-rss' };
    }
    return { ok: true, text };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, reason: e.name || e.message };
  }
}

async function fetchHandleAnyMirror(handle, mirrors) {
  for (const mirror of mirrors) {
    const r = await fetchOne(mirror, handle);
    if (r.ok) {
      const posts = parseNitterRss(r.text, handle, mirror);
      if (posts.length) return { posts, mirror };
    }
  }
  return { posts: [], mirror: null };
}

export async function briefing() {
  const mirrors = (process.env.NITTER_MIRRORS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const handles = (process.env.NITTER_HANDLES || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const mirrorList = mirrors.length ? mirrors : DEFAULT_MIRRORS;
  const handleList = handles.length ? handles : DEFAULT_HANDLES;

  const allPosts = [];
  const workingMirrors = new Set();

  // Sequential per-handle with aggressive failover — keeps the sweep from
  // exploding 11 handles × 6 mirrors = 66 parallel HTTP requests that all
  // time out when Nitter is generally down.
  for (const handle of handleList) {
    try {
      const { posts, mirror } = await fetchHandleAnyMirror(handle, mirrorList);
      if (mirror) workingMirrors.add(mirror);
      for (const p of posts.slice(0, 8)) allPosts.push(p);
    } catch {
      // swallow — one bad handle shouldn't kill the whole source
    }
  }

  return {
    source: 'Nitter',
    timestamp: new Date().toISOString(),
    handlesQueried: handleList.length,
    handlesReturned: new Set(allPosts.map(p => p.author)).size,
    workingMirrors: [...workingMirrors],
    posts: allPosts,
  };
}

if (process.argv[1]?.endsWith('nitter.mjs')) {
  const data = await briefing();
  console.log(JSON.stringify(data, null, 2));
}
