#!/usr/bin/env node
// S.O.N Dashboard Data Synthesizer
// Reads runs/latest.json, fetches RSS news, generates signal-based ideas,
// and injects everything into dashboard/public/jarvis.html
//
// Exports synthesize(), generateIdeas(), fetchAllNews() for use by server.mjs

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import config from '../son.config.mjs';
import { createLLMProvider } from '../lib/llm/index.mjs';
import { generateLLMIdeas } from '../lib/llm/ideas.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// === Helpers ===
const cyrillic = /[\u0400-\u04FF]/;
function isEnglish(text) {
  if (!text) return false;
  return !cyrillic.test(text.substring(0, 80));
}

// === Geo-tagging keyword map ===
const geoKeywords = {
  'Ukraine':[49,32],'Russia':[56,38],'Moscow':[55.7,37.6],'Kyiv':[50.4,30.5],
  'China':[35,105],'Beijing':[39.9,116.4],'Iran':[32,53],'Tehran':[35.7,51.4],
  'Israel':[31.5,35],'Gaza':[31.4,34.4],'Palestine':[31.9,35.2],
  'Syria':[35,38],'Iraq':[33,44],'Saudi':[24,45],'Yemen':[15,48],'Lebanon':[34,36],
  'India':[20,78],'Japan':[36,138],'Korea':[37,127],'Pyongyang':[39,125.7],
  'Taiwan':[23.5,121],'Philippines':[13,122],'Myanmar':[20,96],
  'Canada':[56,-96],'Mexico':[23,-102],'Brazil':[-14,-51],'Argentina':[-38,-63],
  'Colombia':[4,-74],'Venezuela':[7,-66],'Cuba':[22,-80],'Chile':[-35,-71],
  'Germany':[51,10],'France':[46,2],'UK':[54,-2],'Britain':[54,-2],'London':[51.5,-0.1],
  'Spain':[40,-4],'Italy':[42,12],'Poland':[52,20],'NATO':[50,4],'EU':[50,4],
  'Turkey':[39,35],'Greece':[39,22],'Romania':[46,25],'Finland':[64,26],'Sweden':[62,15],
  'Africa':[0,20],'Nigeria':[10,8],'South Africa':[-30,25],'Kenya':[-1,38],
  'Egypt':[27,30],'Libya':[27,17],'Sudan':[13,30],'Ethiopia':[9,38],
  'Somalia':[5,46],'Congo':[-4,22],'Uganda':[1,32],'Morocco':[32,-6],
  'Pakistan':[30,70],'Afghanistan':[33,65],'Bangladesh':[24,90],
  'Australia':[-25,134],'Indonesia':[-2,118],'Thailand':[15,100],
  'US':[39,-98],'America':[39,-98],'Washington':[38.9,-77],'Pentagon':[38.9,-77],
  'Trump':[38.9,-77],'White House':[38.9,-77],
  'Wall Street':[40.7,-74],'New York':[40.7,-74],'California':[37,-120],
  'Nepal':[28,84],'Cambodia':[12.5,105],'Malawi':[-13.5,34],'Burundi':[-3.4,29.9],
  'Oman':[21,57],'Netherlands':[52.1,5.3],'Gabon':[-0.8,11.6],
  'Peru':[-10,-76],'Ecuador':[-2,-78],'Bolivia':[-17,-65],
  'Singapore':[1.35,103.8],'Malaysia':[4.2,101.9],'Vietnam':[16,108],
  'Algeria':[28,3],'Tunisia':[34,9],'Zimbabwe':[-20,30],'Mozambique':[-18,35],
  // Americas expansion
  'Texas':[31,-100],'Florida':[28,-82],'Chicago':[41.9,-87.6],'Los Angeles':[34,-118],
  'San Francisco':[37.8,-122.4],'Seattle':[47.6,-122.3],'Miami':[25.8,-80.2],
  'Toronto':[43.7,-79.4],'Ottawa':[45.4,-75.7],'Vancouver':[49.3,-123.1],
  'São Paulo':[-23.5,-46.6],'Rio':[-22.9,-43.2],'Buenos Aires':[-34.6,-58.4],
  'Bogotá':[4.7,-74.1],'Lima':[-12,-77],'Santiago':[-33.4,-70.7],
  'Caracas':[10.5,-66.9],'Havana':[23.1,-82.4],'Panama':[9,-79.5],
  'Guatemala':[14.6,-90.5],'Honduras':[14.1,-87.2],'El Salvador':[13.7,-89.2],
  'Costa Rica':[10,-84],'Jamaica':[18.1,-77.3],'Haiti':[19,-72],
  'Dominican':[18.5,-70],'Puerto Rico':[18.2,-66.5],
  // More Asia-Pacific
  'Sri Lanka':[7,80],'Hong Kong':[22.3,114.2],'Taipei':[25,121.5],
  'Seoul':[37.6,127],'Osaka':[34.7,135.5],'Mumbai':[19.1,72.9],
  'Delhi':[28.6,77.2],'Shanghai':[31.2,121.5],'Shenzhen':[22.5,114.1],
  'Auckland':[-36.8,174.8],'Papua New Guinea':[-6.3,147],
  // More Europe
  'Berlin':[52.5,13.4],'Paris':[48.9,2.3],'Madrid':[40.4,-3.7],
  'Rome':[41.9,12.5],'Warsaw':[52.2,21],'Prague':[50.1,14.4],
  'Vienna':[48.2,16.4],'Budapest':[47.5,19.1],'Bucharest':[44.4,26.1],
  'Kyiv':[50.4,30.5],'Oslo':[59.9,10.7],'Copenhagen':[55.7,12.6],
  'Brussels':[50.8,4.4],'Zurich':[47.4,8.5],'Dublin':[53.3,-6.3],
  'Lisbon':[38.7,-9.1],'Athens':[37.9,23.7],'Minsk':[53.9,27.6],
  // More Africa
  'Nairobi':[-1.3,36.8],'Lagos':[6.5,3.4],'Accra':[5.6,-0.2],
  'Addis Ababa':[9,38.7],'Cape Town':[-33.9,18.4],'Johannesburg':[-26.2,28],
  'Kinshasa':[-4.3,15.3],'Khartoum':[15.6,32.5],'Mogadishu':[2.1,45.3],
  'Dakar':[14.7,-17.5],'Abuja':[9.1,7.5],
  // Tech/Economy keywords with US locations
  'Fed':[38.9,-77],'Congress':[38.9,-77],'Senate':[38.9,-77],
  'Silicon Valley':[37.4,-122],'NASA':[28.6,-80.6],'Pentagon':[38.9,-77],
  'IMF':[38.9,-77],'World Bank':[38.9,-77],'UN':[40.7,-74],
};

function geoTagText(text) {
  if (!text) return null;
  for (const [keyword, [lat, lon]] of Object.entries(geoKeywords)) {
    if (text.includes(keyword)) {
      return { lat, lon, region: keyword };
    }
  }
  return null;
}

function sanitizeExternalUrl(raw) {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

// Multi-format link extractor for RSS items. Handles:
//   - Atom: <link rel="alternate" href="..."/>
//   - RSS classic: <link>...</link> (with optional CDATA)
//   - GUID permalink fallback: <guid isPermaLink="true">URL</guid>
// Many modern feeds (Reuters, Bloomberg via Google News, Atom-based publishers)
// were silently producing unclickable items because the previous parser only
// matched the classic <link>...</link> form. Fix per RECON_SPRINT_ARCHITECTURE
// 2026-04-30 Section 3.5.
function extractItemLink(block) {
  // Atom href attribute (must come first — many feeds are mixed and have a
  // self-referential <link rel="self" href="..."/> we don't want, so prefer
  // rel="alternate" or no rel at all)
  const atomAlt = block.match(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i);
  if (atomAlt?.[1]) return atomAlt[1].trim();
  const atomBare = block.match(/<link\b(?![^>]*\brel=["']self)[^>]*\bhref=["']([^"']+)["']/i);
  if (atomBare?.[1]) return atomBare[1].trim();
  // RSS classic
  const rssClassic = block.match(/<link\b[^>]*>(?:<!\[CDATA\[)?([^<]+?)(?:\]\]>)?<\/link>/i);
  if (rssClassic?.[1]) {
    const candidate = rssClassic[1].trim();
    if (candidate && /^https?:/i.test(candidate)) return candidate;
  }
  // GUID permalink fallback
  const guid = block.match(/<guid\b[^>]*\bisPermaLink=["']true["'][^>]*>([^<]+)<\/guid>/i);
  if (guid?.[1]) {
    const candidate = guid[1].trim();
    if (candidate && /^https?:/i.test(candidate)) return candidate;
  }
  return null;
}

// === RSS Fetching ===
async function fetchRSS(url, source) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'S.O.N/2.0 (+https://strandsnation.xyz)' },
    });
    if (!res.ok) {
      console.log(`RSS fetch failed (${source}): HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = [];
    // Match <item> or <item attr="..."> variants (RSS 2.0, RDF, mixed)
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = decodeEntities(
        (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] || '').trim()
      );
      const link = sanitizeExternalUrl(extractItemLink(block) || '');
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]
        || block.match(/<dc:date>([\s\S]*?)<\/dc:date>/)?.[1]
        || block.match(/<published>([\s\S]*?)<\/published>/)?.[1]
        || '').trim();
      if (title && title !== source) items.push({ title, date: pubDate, source, url: link || undefined });
    }
    return items;
  } catch (e) {
    console.log(`RSS fetch failed (${source}):`, e.message);
    return [];
  }
}

async function fetchFeedEntry(urlOrUrls, source) {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  for (const url of urls) {
    const items = await fetchRSS(url, source);
    if (items.length) return items;
  }
  return [];
}

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

export async function fetchAllNews() {
  // 80+ curated RSS feeds across 8 categories. All free, no API keys.
  // Reuters / Bloomberg / FT / WSJ use Google News query proxies since
  // they killed direct RSS. Everything else is publisher-direct.
  //
  // v2: 2026-05-09 — expanded from 22 to 85 feeds. Density parity with
  // World Monitor's 435-feed approach (we curate tighter, they go wide).
  const feeds = [
    // ─── Western Flagships ──────────────────────────────────────────
    [['https://feeds.bbci.co.uk/news/world/rss.xml', 'http://feeds.bbci.co.uk/news/world/rss.xml'], 'BBC'],
    [['https://feeds.bbci.co.uk/news/business/rss.xml', 'http://feeds.bbci.co.uk/news/business/rss.xml'], 'BBC Business'],
    ['https://feeds.bbci.co.uk/news/technology/rss.xml', 'BBC Tech'],
    ['http://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'BBC Science'],
    ['https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'NYT'],
    ['https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml', 'NYT Americas'],
    ['https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml', 'NYT Asia'],
    ['https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', 'NYT Middle East'],
    ['https://rss.nytimes.com/services/xml/rss/nyt/Africa.xml', 'NYT Africa'],
    ['https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml', 'NYT Europe'],
    ['https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', 'NYT Tech'],
    ['https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'NYT Business'],
    [['https://www.theguardian.com/world/rss', 'https://www.theguardian.com/uk/rss'], 'Guardian'],
    ['https://www.theguardian.com/technology/rss', 'Guardian Tech'],
    ['https://www.theguardian.com/business/rss', 'Guardian Business'],
    ['https://feeds.washingtonpost.com/rss/world', 'WaPo'],

    // ─── Wire Services via Google News (site-restricted) ────────────
    [['https://news.google.com/rss/search?q=when:1d+site:reuters.com&hl=en-US&gl=US&ceid=US:en', 'https://news.google.com/rss/search?q=when:12h+Reuters+world&hl=en-US&gl=US&ceid=US:en'], 'Reuters'],
    [['https://news.google.com/rss/search?q=when:1d+site:bloomberg.com&hl=en-US&gl=US&ceid=US:en', 'https://news.google.com/rss/search?q=when:12h+Bloomberg+markets&hl=en-US&gl=US&ceid=US:en'], 'Bloomberg'],
    [['https://news.google.com/rss/search?q=when:1d+site:ft.com&hl=en-US&gl=US&ceid=US:en', 'https://news.google.com/rss/search?q=when:12h+%22Financial+Times%22&hl=en-US&gl=US&ceid=US:en'], 'FT'],
    ['https://news.google.com/rss/search?q=when:1d+site:wsj.com&hl=en-US&gl=US&ceid=US:en', 'WSJ'],
    [['https://news.google.com/rss/search?q=when:1d+site:apnews.com&hl=en-US&gl=US&ceid=US:en', 'https://news.google.com/rss/search?q=when:12h+%22AP+News%22&hl=en-US&gl=US&ceid=US:en'], 'AP'],

    // ─── Middle East / Gulf / Africa ────────────────────────────────
    ['https://www.aljazeera.com/xml/rss/all.xml', 'Al Jazeera'],
    ['https://www.timesofisrael.com/feed/', 'Times of Israel'],
    ['https://english.alarabiya.net/tools/rss', 'Al Arabiya'],
    ['https://www.middleeasteye.net/rss', 'Middle East Eye'],
    ['https://www.arabnews.com/rss.xml', 'Arab News'],
    ['https://www.jpost.com/rss/rssfeedsfrontpage.aspx', 'Jerusalem Post'],
    ['https://www.dailymaverick.co.za/feed/', 'Daily Maverick'],

    // ─── Asia-Pacific ───────────────────────────────────────────────
    ['https://www.scmp.com/rss/91/feed', 'SCMP'],
    ['https://asia.nikkei.com/rss/feed/nar', 'Nikkei Asia'],
    ['https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511', 'CNA'],
    ['https://www.straitstimes.com/news/asia/rss.xml', 'Straits Times'],
    ['https://www.bangkokpost.com/rss/data/topstories.xml', 'Bangkok Post'],
    ['https://www.thejakartapost.com/feed', 'Jakarta Post'],
    ['https://www.rappler.com/feed/', 'Rappler'],
    ['https://english.kyodonews.net/rss/all.xml', 'Kyodo News'],
    ['https://www.koreaherald.com/common/rss_xml.php?ct=102', 'Korea Herald'],
    ['https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', 'Times of India'],
    ['https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml', 'Hindustan Times'],
    ['https://www.dawn.com/feed', 'Dawn (Pakistan)'],
    ['https://www.abc.net.au/news/feed/51120/rss.xml', 'ABC Australia'],
    ['https://www.stuff.co.nz/rss', 'Stuff NZ'],

    // ─── Europe ─────────────────────────────────────────────────────
    ['https://rss.dw.com/rdf/rss-en-all', 'Deutsche Welle'],
    ['https://www.france24.com/en/rss', 'France 24'],
    ['https://www.euronews.com/rss', 'Euronews'],
    ['https://feeds.skynews.com/feeds/rss/world.xml', 'Sky News'],
    ['https://www.telegraph.co.uk/rss.xml', 'Telegraph'],
    ['https://www.independent.co.uk/news/world/rss', 'Independent'],
    ['https://www.irishtimes.com/cmlink/news-1.1319192', 'Irish Times'],
    ['https://www.politico.eu/feed/', 'Politico EU'],
    ['https://www.kyivindependent.com/feed/', 'Kyiv Independent'],

    // ─── Americas (beyond US) ───────────────────────────────────────
    ['https://www.cbc.ca/webfeed/rss/rss-world', 'CBC'],
    ['https://globalnews.ca/world/feed/', 'Global News CA'],
    ['https://riotimesonline.com/feed/', 'Rio Times'],

    // ─── Defense / Security / Geopolitics ───────────────────────────
    ['https://breakingdefense.com/feed/', 'Breaking Defense'],
    ['https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml', 'Defense News'],
    ['https://www.janes.com/feeds/news', 'Janes'],
    ['https://www.defenseone.com/rss/', 'Defense One'],
    ['https://warontherocks.com/feed/', 'War on the Rocks'],
    ['https://thediplomat.com/feed/', 'The Diplomat'],
    ['https://foreignpolicy.com/feed/', 'Foreign Policy'],
    ['https://www.cfr.org/rss.xml', 'CFR'],

    // ─── Markets / Finance / Economy ────────────────────────────────
    ['https://www.cnbc.com/id/100727362/device/rss/rss.html', 'CNBC World'],
    ['https://feeds.marketwatch.com/marketwatch/topstories/', 'MarketWatch'],
    ['https://www.cnbc.com/id/10001147/device/rss/rss.html', 'CNBC Markets'],
    ['https://www.investopedia.com/feedbuilder/feed/getfeed/?feedName=rss_headline', 'Investopedia'],
    ['https://finance.yahoo.com/news/rssindex', 'Yahoo Finance'],

    // ─── Technology / AI / Cyber ────────────────────────────────────
    ['https://feeds.arstechnica.com/arstechnica/technology-lab', 'Ars Technica'],
    ['https://www.wired.com/feed/rss', 'Wired'],
    ['https://www.theverge.com/rss/index.xml', 'The Verge'],
    ['https://techcrunch.com/feed/', 'TechCrunch'],
    ['https://www.technologyreview.com/feed/', 'MIT Tech Review'],
    ['https://krebsonsecurity.com/feed/', 'Krebs Security'],
    ['https://www.bleepingcomputer.com/feed/', 'BleepingComputer'],
    ['https://feeds.feedburner.com/TheHackersNews', 'Hacker News (Security)'],

    // ─── Energy / Commodities / Climate ─────────────────────────────
    ['https://oilprice.com/rss/main', 'OilPrice'],
    ['https://www.carbonbrief.org/feed/', 'Carbon Brief'],
    ['https://www.mining.com/feed/', 'Mining.com'],

    // ─── Science / Space / Health ───────────────────────────────────
    ['https://www.space.com/feeds/all', 'Space.com'],
    ['https://spacenews.com/feed/', 'SpaceNews'],
    ['https://www.nature.com/nature.rss', 'Nature'],
    ['https://www.newscientist.com/feed/home/', 'New Scientist'],
    ['https://www.who.int/feeds/entity/news/en/rss.xml', 'WHO News'],

    // ─── Crypto / Web3 ─────────────────────────────────────────────
    ['https://cointelegraph.com/rss', 'CoinTelegraph'],
    ['https://www.coindesk.com/arc/outboundfeeds/rss/', 'CoinDesk'],
    ['https://decrypt.co/feed', 'Decrypt'],
    ['https://thedefiant.io/feed', 'The Defiant'],
  ];

  const results = await Promise.allSettled(
    feeds.map(([url, source]) => fetchFeedEntry(url, source))
  );

  const allNews = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // De-duplicate by title prefix and geo-tag
  const seen = new Set();
  const geoNews = [];
  const nonGeoNews = [];
  for (const item of allNews) {
    if (!item.title) continue;
    const key = item.title.substring(0, 40).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const geo = geoTagText(item.title);
    const entry = {
      title: item.title.substring(0, 120),
      source: item.source,
      date: item.date,
      url: item.url,
    };
    if (geo) {
      geoNews.push({
        ...entry,
        lat: geo.lat + (Math.random() - 0.5) * 2,
        lon: geo.lon + (Math.random() - 0.5) * 2,
        region: geo.region
      });
    } else {
      // Keep non-geo items for the ticker (no map marker, still flows to band)
      nonGeoNews.push({ ...entry, region: 'Global' });
    }
  }

  // Merge: geo-tagged first (they get map markers), then non-geo (ticker only)
  geoNews.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  nonGeoNews.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return [...geoNews.slice(0, 80), ...nonGeoNews.slice(0, 40)];
}

// === Leverageable Ideas from Signals ===
export function generateIdeas(V2) {
  const ideas = [];
  const vix = V2.fred.find(f => f.id === 'VIXCLS');
  const hy = V2.fred.find(f => f.id === 'BAMLH0A0HYM2');
  const spread = V2.fred.find(f => f.id === 'T10Y2Y');

  if (V2.tg.urgent.length > 3 && V2.energy.wti > 68) {
    ideas.push({
      title: 'Conflict-Energy Nexus Active',
      text: `${V2.tg.urgent.length} urgent conflict signals with WTI at $${V2.energy.wti}. Geopolitical risk premium may expand. Consider energy exposure.`,
      type: 'long', confidence: 'Medium', horizon: 'swing'
    });
  }
  if (vix && vix.value > 20) {
    ideas.push({
      title: 'Elevated Volatility Regime',
      text: `VIX at ${vix.value} — fear premium elevated. Portfolio hedges justified. Short-term equity upside is capped.`,
      type: 'hedge', confidence: vix.value > 25 ? 'High' : 'Medium', horizon: 'tactical'
    });
  }
  if (vix && vix.value > 20 && hy && hy.value > 3) {
    ideas.push({
      title: 'Safe Haven Demand Rising',
      text: `VIX ${vix.value} + HY spread ${hy.value}% = risk-off building. Gold, treasuries, quality dividends may outperform.`,
      type: 'hedge', confidence: 'Medium', horizon: 'tactical'
    });
  }
  if (V2.energy.wtiRecent.length > 1) {
    const latest = V2.energy.wtiRecent[0];
    const oldest = V2.energy.wtiRecent[V2.energy.wtiRecent.length - 1];
    const pct = ((latest - oldest) / oldest * 100).toFixed(1);
    if (Math.abs(pct) > 3) {
      ideas.push({
        title: pct > 0 ? 'Oil Momentum Building' : 'Oil Under Pressure',
        text: `WTI moved ${pct > 0 ? '+' : ''}${pct}% recently to $${V2.energy.wti}/bbl. ${pct > 0 ? 'Energy and commodity names benefit.' : 'Demand concerns may be emerging.'}`,
        type: pct > 0 ? 'long' : 'watch', confidence: 'Medium', horizon: 'swing'
      });
    }
  }
  if (spread) {
    ideas.push({
      title: spread.value > 0 ? 'Yield Curve Normalizing' : 'Yield Curve Inverted',
      text: `10Y-2Y spread at ${spread.value.toFixed(2)}. ${spread.value > 0 ? 'Recession signal fading — cyclical rotation possible.' : 'Inversion persists — defensive positioning warranted.'}`,
      type: 'watch', confidence: 'Medium', horizon: 'strategic'
    });
  }
  const debt = parseFloat(V2.treasury.totalDebt);
  if (debt > 35e12) {
    ideas.push({
      title: 'Fiscal Trajectory Supports Hard Assets',
      text: `National debt at $${(debt / 1e12).toFixed(1)}T. Long-term gold, bitcoin, and real asset appreciation thesis intact.`,
      type: 'long', confidence: 'High', horizon: 'strategic'
    });
  }
  const totalThermal = V2.thermal.reduce((s, t) => s + t.det, 0);
  if (totalThermal > 30000 && V2.tg.urgent.length > 2) {
    ideas.push({
      title: 'Satellite Confirms Conflict Intensity',
      text: `${totalThermal.toLocaleString()} thermal detections + ${V2.tg.urgent.length} urgent OSINT flags. Defense sector procurement may accelerate.`,
      type: 'watch', confidence: 'Medium', horizon: 'swing'
    });
  }

  // Yield Curve + Labor Interaction
  const unemployment = V2.bls.find(b => b.id === 'LNS14000000' || b.id === 'UNRATE');
  const payrolls = V2.bls.find(b => b.id === 'CES0000000001' || b.id === 'PAYEMS');
  if (spread && unemployment && payrolls) {
    const weakLabor = (unemployment.value > 4.3) || (payrolls.momChange && payrolls.momChange < -50);
    if (spread.value > 0.3 && weakLabor) {
      ideas.push({
        title: 'Steepening Curve Meets Weak Labor',
        text: `10Y-2Y at ${spread.value.toFixed(2)} + UE ${unemployment.value}%. Curve steepening with deteriorating employment = recession positioning warranted.`,
        type: 'hedge', confidence: 'High', horizon: 'tactical'
      });
    }
  }

  // ACLED Conflict + Energy Momentum
  const conflictEvents = V2.acled?.totalEvents || 0;
  if (conflictEvents > 50 && V2.energy.wtiRecent.length > 1) {
    const wtiMove = V2.energy.wtiRecent[0] - V2.energy.wtiRecent[V2.energy.wtiRecent.length - 1];
    if (wtiMove > 2) {
      ideas.push({
        title: 'Conflict Fueling Energy Momentum',
        text: `${conflictEvents} ACLED events this week + WTI up $${wtiMove.toFixed(1)}. Conflict-energy transmission channel active.`,
        type: 'long', confidence: 'Medium', horizon: 'swing'
      });
    }
  }

  // Defense + Conflict Intensity
  const totalFatalities = V2.acled?.totalFatalities || 0;
  const totalThermalAll = V2.thermal.reduce((s, t) => s + t.det, 0);
  if (totalFatalities > 500 && totalThermalAll > 20000) {
    ideas.push({
      title: 'Defense Procurement Acceleration Signal',
      text: `${totalFatalities.toLocaleString()} conflict fatalities + ${totalThermalAll.toLocaleString()} thermal detections. Defense contractors may see accelerated procurement.`,
      type: 'long', confidence: 'Medium', horizon: 'swing'
    });
  }

  // HY Spread + VIX Divergence
  if (hy && vix) {
    const hyWide = hy.value > 3.5;
    const vixLow = vix.value < 18;
    const hyTight = hy.value < 2.5;
    const vixHigh = vix.value > 25;
    if (hyWide && vixLow) {
      ideas.push({
        title: 'Credit Stress Ignored by Equity Vol',
        text: `HY spread ${hy.value.toFixed(1)}% (wide) but VIX only ${vix.value.toFixed(0)} (complacent). Equity may be underpricing credit deterioration.`,
        type: 'watch', confidence: 'Medium', horizon: 'tactical'
      });
    } else if (hyTight && vixHigh) {
      ideas.push({
        title: 'Equity Fear Exceeds Credit Stress',
        text: `VIX at ${vix.value.toFixed(0)} but HY spread only ${hy.value.toFixed(1)}%. Equity vol may be overshooting — credit markets aren't confirming.`,
        type: 'watch', confidence: 'Medium', horizon: 'tactical'
      });
    }
  }

  // Supply Chain + Inflation Pipeline
  const ppi = V2.bls.find(b => b.id === 'WPUFD49104' || b.id === 'PCU--PCU--');
  const cpi = V2.bls.find(b => b.id === 'CUUR0000SA0' || b.id === 'CPIAUCSL');
  if (ppi && cpi && V2.gscpi) {
    const supplyPressure = V2.gscpi.value > 0.5;
    const ppiRising = ppi.momChangePct > 0.3;
    if (supplyPressure && ppiRising) {
      ideas.push({
        title: 'Inflation Pipeline Building Pressure',
        text: `GSCPI at ${V2.gscpi.value.toFixed(2)} (${V2.gscpi.interpretation}) + PPI momentum +${ppi.momChangePct?.toFixed(1)}%. Input costs flowing through — CPI may follow.`,
        type: 'long', confidence: 'Medium', horizon: 'strategic'
      });
    }
  }

  return ideas.slice(0, 8);
}

// === Synthesize raw sweep data into dashboard format ===
export async function synthesize(data) {
  const air = (data.sources.OpenSky?.hotspots || []).map(h => ({
    region: h.region, total: h.totalAircraft || 0, noCallsign: h.noCallsign || 0,
    highAlt: h.highAltitude || 0,
    top: Object.entries(h.byCountry || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }));
  const thermal = (data.sources.FIRMS?.hotspots || []).map(h => ({
    region: h.region, det: h.totalDetections || 0, night: h.nightDetections || 0,
    hc: h.highConfidence || 0,
    fires: (h.highIntensity || []).slice(0, 8).map(f => ({ lat: f.lat, lon: f.lon, frp: f.frp || 0 }))
  }));
  const tSignals = data.sources.FIRMS?.signals || [];

  // Flatten FIRMS high-intensity detections across hotspots so the 'thermal' layer
  // (which reads data.firms.detections in app.js) has geo-points.
  const firmsDetections = [];
  for (const h of (data.sources.FIRMS?.hotspots || [])) {
    for (const f of (h.highIntensity || [])) {
      if (typeof f.lat !== 'number' || typeof f.lon !== 'number') continue;
      firmsDetections.push({
        id: `firms-${f.lat.toFixed(3)}-${f.lon.toFixed(3)}-${f.time || ''}`,
        lat: f.lat, lon: f.lon, brightness: f.brightness, frp: f.frp,
        date: f.date, time: f.time, confidence: f.confidence, daynight: f.daynight,
        region: h.region,
      });
    }
  }
  const firms = { detections: firmsDetections, totalHotspots: (data.sources.FIRMS?.hotspots || []).length };

  const chokepointsList = Object.values(data.sources.Maritime?.chokepoints || {}).map(c => ({
    label: c.label || c.name, note: c.note || '', lat: c.lat || 0, lon: c.lon || 0
  }));
  // Keyed chokepoint object is what worldview/app.js renderShips expects.
  const chokepointsObj = data.sources.Maritime?.chokepoints || {};
  // Live vessels from AIS stream buffer (populated by apis/live/aisstream.mjs if key present).
  const maritimeVessels = data.sources.Maritime?.vessels || [];
  const ships = { vessels: maritimeVessels, chokepoints: chokepointsObj };
  const nuke = (data.sources.Safecast?.sites || []).map(s => ({
    site: s.site, anom: s.anomaly || false, cpm: s.avgCPM, n: s.recentReadings || 0
  }));
  const nukeSignals = (data.sources.Safecast?.signals || []).filter(s => s);
  const sdrData = data.sources.KiwiSDR || {};
  const sdrNet = sdrData.network || {};
  const sdrConflict = sdrData.conflictZones || {};
  const sdrZones = Object.values(sdrConflict).map(z => ({
    region: z.region, count: z.count || 0,
    receivers: (z.receivers || []).slice(0, 5).map(r => ({ name: r.name || '', lat: r.lat || 0, lon: r.lon || 0 }))
  }));
  const tgData = data.sources.Telegram || {};
  const tgUrgent = (tgData.urgentPosts || []).filter(p => isEnglish(p.text)).map(p => ({
    channel: p.channel, text: p.text?.substring(0, 200), views: p.views, date: p.date, urgentFlags: p.urgentFlags || []
  }));
  const tgTop = (tgData.topPosts || []).filter(p => isEnglish(p.text)).map(p => ({
    channel: p.channel, text: p.text?.substring(0, 200), views: p.views, date: p.date, urgentFlags: []
  }));
  const who = (data.sources.WHO?.diseaseOutbreakNews || []).slice(0, 10).map(w => ({
    title: w.title?.substring(0, 120), date: w.date, summary: w.summary?.substring(0, 150)
  }));
  const fred = (data.sources.FRED?.indicators || []).map(f => ({
    id: f.id, label: f.label, value: f.value, date: f.date,
    recent: f.recent || [],
    momChange: f.momChange, momChangePct: f.momChangePct
  }));
  const energyData = data.sources.EIA || {};
  const oilPrices = energyData.oilPrices || {};
  const wtiRecent = (oilPrices.wti?.recent || []).map(d => d.value);
  const energy = {
    wti: oilPrices.wti?.value, brent: oilPrices.brent?.value,
    natgas: energyData.gasPrice?.value, crudeStocks: energyData.inventories?.crudeStocks?.value,
    wtiRecent, signals: energyData.signals || []
  };
  const bls = data.sources.BLS?.indicators || [];
  const treasuryData = data.sources.Treasury || {};
  const debtArr = treasuryData.debt || [];
  const treasury = { totalDebt: debtArr[0]?.totalDebt || '0', signals: treasuryData.signals || [] };
  const gscpi = data.sources.GSCPI?.latest || null;
  const defense = (data.sources.USAspending?.recentDefenseContracts || []).slice(0, 5).map(c => ({
    recipient: c.recipient?.substring(0, 40), amount: c.amount, desc: c.description?.substring(0, 80)
  }));
  const noaa = {
    totalAlerts: data.sources.NOAA?.totalSevereAlerts || 0,
    alerts: (data.sources.NOAA?.topAlerts || []).filter(a => a.lat != null && a.lon != null).slice(0, 10).map(a => ({
      event: a.event, severity: a.severity, headline: a.headline?.substring(0, 120),
      lat: a.lat, lon: a.lon
    }))
  };

  // EPA RadNet — pass through geo-tagged readings
  const epaData = data.sources.EPA || {};
  const epaStations = [];
  const seenEpa = new Set();
  for (const r of (epaData.readings || [])) {
    if (r.lat == null || r.lon == null) continue;
    const key = `${r.lat},${r.lon}`;
    if (seenEpa.has(key)) continue;
    seenEpa.add(key);
    epaStations.push({ location: r.location, state: r.state, lat: r.lat, lon: r.lon, analyte: r.analyte, result: r.result, unit: r.unit });
  }
  const epa = { totalReadings: epaData.totalReadings || 0, stations: epaStations.slice(0, 10) };

  // Space/CelesTrak satellite data
  const spaceData = data.sources.Space || {};
  // Approximate subsatellite position from TLE orbital elements
  function estimateSatPosition(sat) {
    if (!sat?.inclination || !sat?.epoch) return null;
    const epoch = new Date(sat.epoch);
    const now = new Date();
    const elapsed = (now - epoch) / 1000;
    const period = (sat.period || 92.7) * 60; // minutes to seconds
    const orbits = elapsed / period;
    const frac = orbits % 1;
    const lat = sat.inclination * Math.sin(frac * 2 * Math.PI);
    const lonShift = (elapsed / 86400) * 360;
    const orbitLon = frac * 360;
    const lon = ((orbitLon - lonShift) % 360 + 540) % 360 - 180;
    return { lat: +lat.toFixed(2), lon: +lon.toFixed(2), name: sat.name };
  }
  const issPos = estimateSatPosition(spaceData.iss);
  const spaceStations = (spaceData.spaceStations || []).map(s => estimateSatPosition(s)).filter(Boolean);
  const space = {
    totalNewObjects: spaceData.totalNewObjects || 0,
    militarySats: spaceData.militarySatellites || 0,
    militaryByCountry: spaceData.militaryByCountry || {},
    constellations: spaceData.constellations || {},
    iss: spaceData.iss || null,
    issPosition: issPos,
    stationPositions: spaceStations.slice(0, 5),
    recentLaunches: (spaceData.recentLaunches || []).slice(0, 10).map(l => ({
      name: l.name, country: l.country, epoch: l.epoch,
      apogee: l.apogee, perigee: l.perigee, type: l.objectType
    })),
    launchByCountry: spaceData.launchByCountry || {},
    signals: spaceData.signals || [],
    // SAT layer: SatelliteTracker.renderAll() expects {name, noradId, tle1, tle2}.
    // Combine recent launches + space stations + ISS, filter to those carrying
    // TLE lines. Fix per LAYER_AUDIT_2026-04-24.md #3 + RECON sprint Section 3.3.
    satellites: [
      ...(spaceData.recentLaunches || []),
      ...(spaceData.spaceStations || []),
      ...(spaceData.iss ? [spaceData.iss] : []),
    ].filter(s => s && s.tle1 && s.tle2)
     .map(s => ({
       name: s.name, noradId: s.noradId,
       tle1: s.tle1, tle2: s.tle2,
       country: s.country, type: s.objectType,
     })),
  };

  // ACLED conflict events
  const acledData = data.sources.ACLED || {};
  const acledEvents = acledData.error ? [] : (acledData.deadliestEvents || []).slice(0, 500).map(e => ({
    id: e.data_id || `acled-${e.date}-${e.lat}-${e.lon}`,
    date: e.date, type: e.type, event_type: e.type,
    country: e.country, location: e.location, actor1: e.actor1, actor2: e.actor2,
    fatalities: e.fatalities || 0, lat: e.lat || null, lon: e.lon || null,
    notes: e.notes,
  }));
  const acled = acledData.error ? { totalEvents: 0, totalFatalities: 0, byRegion: {}, byType: {}, deadliestEvents: [], events: [] } : {
    totalEvents: acledData.totalEvents || 0,
    totalFatalities: acledData.totalFatalities || 0,
    byRegion: acledData.byRegion || {},
    byType: acledData.byType || {},
    deadliestEvents: acledEvents.slice(0, 15),
    events: acledEvents, // worldview/app.js renderConflict reads this
  };

  // GDELT news articles + geo events
  const gdeltData = data.sources.GDELT || {};
  const gdelt = {
    totalArticles: gdeltData.totalArticles || 0,
    conflicts: (gdeltData.conflicts || []).length,
    economy: (gdeltData.economy || []).length,
    health: (gdeltData.health || []).length,
    crisis: (gdeltData.crisis || []).length,
    topTitles: (gdeltData.allArticles || []).slice(0, 5).map(a => a.title?.substring(0, 80)),
    geoPoints: (gdeltData.geoPoints || []).slice(0, 200).map(p => ({
      lat: p.lat, lon: p.lon, name: (p.name || '').substring(0, 120), count: p.count || 1
    }))
  };

  const health = Object.entries(data.sources).map(([name, src]) => ({
    n: name, err: Boolean(src.error), stale: Boolean(src.stale)
  }));
  const sourceHealth = data.health || {};
  const sourceErrors = data.errors || [];
  const sourceTiming = data.timing || {};

  // === ADS-B military aircraft (synthesize source-name ADS-B into stable V2.adsb) ===
  // The hyphen in 'ADS-B' means data.sources['ADS-B'] not data.sources.ADSB,
  // which is why the MIL layer never rendered despite the adapter running.
  const adsbSource = data.sources['ADS-B'] || {};
  const adsb = {
    militaryAircraft: adsbSource.militaryAircraft || [],
    total: adsbSource.totalMilitary || 0,
  };

  // === Crypto via CoinGecko (BTC/ETH/SOL/AVAX/RNDR/AR) ===
  // Overrides the YFinance crypto path — CoinGecko has clean coverage for all six.
  const cryptoData = data.sources.Crypto || {};

  // === Yahoo Finance live market data ===
  const yfData = data.sources.YFinance || {};
  const yfQuotes = yfData.quotes || {};
  const markets = {
    indexes: (yfData.indexes || []).map(q => ({
      symbol: q.symbol, name: q.name, price: q.price,
      change: q.change, changePct: q.changePct, history: q.history || []
    })),
    rates: (yfData.rates || []).map(q => ({
      symbol: q.symbol, name: q.name, price: q.price,
      change: q.change, changePct: q.changePct
    })),
    commodities: (yfData.commodities || []).map(q => ({
      symbol: q.symbol, name: q.name, price: q.price,
      change: q.change, changePct: q.changePct, history: q.history || []
    })),
    // Prefer CoinGecko crypto (guaranteed SOL/AVAX/RNDR/AR coverage);
    // fall back to YFinance if CoinGecko failed.
    crypto: (cryptoData.crypto && cryptoData.crypto.length)
      ? cryptoData.crypto
      : (yfData.crypto || []).map(q => ({
          symbol: (q.symbol || '').replace('-USD', ''),
          name: q.name,
          price: q.price,
          change: q.change,
          changePct: q.changePct,
        })),
    vix: yfQuotes['^VIX'] ? {
      value: yfQuotes['^VIX'].price,
      change: yfQuotes['^VIX'].change,
      changePct: yfQuotes['^VIX'].changePct,
    } : null,
    timestamp: yfData.summary?.timestamp || null,
  };

  // Override stale EIA prices with live Yahoo Finance data if available
  const yfWti = yfQuotes['CL=F'];
  const yfBrent = yfQuotes['BZ=F'];
  const yfNatgas = yfQuotes['NG=F'];
  if (yfWti?.price) energy.wti = yfWti.price;
  if (yfBrent?.price) energy.brent = yfBrent.price;
  if (yfNatgas?.price) energy.natgas = yfNatgas.price;
  if (yfWti?.history?.length) energy.wtiRecent = yfWti.history.map(h => h.close);

  // Fetch RSS
  const news = await fetchAllNews();

  // Social Signals — Bluesky posts (optionally Nitter RSS if adapter present).
  // Geo-tagged from text so the Worldview Social layer has points to render.
  const blueskyData = data.sources.Bluesky || {};
  const socialPosts = [];
  for (const [bucket, posts] of Object.entries(blueskyData.topics || {})) {
    for (const p of posts) {
      const geo = geoTagText(p.text);
      if (!geo) continue;
      socialPosts.push({
        id: `bsky-${p.author}-${(p.date || '').substring(0, 19)}`,
        text: p.text?.substring(0, 240),
        author: p.author,
        date: p.date,
        likes: p.likes || 0,
        source: 'bluesky',
        bucket,
        lat: geo.lat + (Math.random() - 0.5) * 1.5,
        lon: geo.lon + (Math.random() - 0.5) * 1.5,
        region: geo.region,
      });
    }
  }
  // Nitter/X adapter (optional, added by Social Signals task).
  // If the adapter pre-geo-tagged posts, honour it; otherwise geo-tag text here.
  const nitterData = data.sources.Nitter || data.sources.X || {};
  for (const p of (nitterData.posts || [])) {
    let lat = p.lat, lon = p.lon, region = p.region;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      const geo = geoTagText(p.text || '');
      if (!geo) continue;
      lat = geo.lat + (Math.random() - 0.5) * 1.5;
      lon = geo.lon + (Math.random() - 0.5) * 1.5;
      region = geo.region;
    }
    socialPosts.push({
      id: `x-${p.id || `${p.author}-${p.date}`}`,
      text: (p.text || '').substring(0, 240),
      author: p.author,
      date: p.date,
      likes: p.likes || 0,
      source: 'x',
      lat, lon,
      region,
      url: sanitizeExternalUrl(p.url),
    });
  }
  const social = { posts: socialPosts, bluesky: blueskyData.topics || {} };

  // CCTV — curated public webcams with known lat/lon. Merged with 24/7 news
  // YouTube live streams resolved at sweep-time by news_live.mjs (only when
  // YOUTUBE_API_KEY is set; otherwise newsLive returns an empty streams array).
  const cctvData = data.sources.CCTV || {};
  const newsLiveData = data.sources.NewsLive || {};
  const newsLiveStreams = (newsLiveData.streams || []).map(s => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    url: s.url,
    kind: s.kind,             // 'youtube'
    category: s.category,     // 'news-live'
    region: s.country,
    network: s.network,
    country: s.country,
    title: s.title,
    thumbnail: s.thumbnail,
    critical: false,
  }));
  const mergedCams = [...(cctvData.cameras || []), ...newsLiveStreams];
  const cctv = {
    cameras: mergedCams,
    totalCameras: (cctvData.totalCameras || 0) + newsLiveStreams.length,
    categories: [...new Set([...(cctvData.categories || []), ...(newsLiveStreams.length ? ['news-live'] : [])])],
    regions: cctvData.regions || [],
    newsLiveCount: newsLiveStreams.length,
    newsLiveRegistrySize: newsLiveData.channelRegistry || 0,
    newsLiveStatus: newsLiveData.status || 'disabled',
  };

  const newsFeed = buildNewsFeed(news, gdeltData, tgUrgent, tgTop);

  // === STABLE PUBLIC KEYS for renderBands() in worldview/app.js ===
  // The client-side three-band layout reads these alias keys directly. Adding
  // new sources means mapping them into these shapes, not rewriting the UI.
  //
  //   data.news.items       — flat list of headlines (RSS + GDELT)
  //   data.social.items     — flat list of posts (bluesky + x, pre-filtered client-side by source)
  //   data.alerts.list      — operator-surfaced alerts (delta criticals + NOAA severe + ACLED top events)
  //   data.satellites       — { upcomingPasses } pass predictions (stub until satellite.js wired)

  const newsItems = newsFeed
    .filter(n => n.title || n.headline)
    .slice(0, 60)
    .map(n => ({
      id: n.id,
      title: n.title || n.headline,
      headline: n.headline || n.title,
      source: n.source,
      url: n.url,
      published: n.published || n.timestamp,
      region: n.region,
      lat: n.lat, lon: n.lon,
      kind: n.type === 'rss' ? 'rss' : 'news',
    }));

  const socialItems = (social.posts || []).map(p => ({
    id: p.id,
    text: p.text,
    author: p.author,
    date: p.date,
    likes: p.likes,
    source: (p.source || '').toLowerCase(),  // 'bluesky' | 'x' | 'nitter' | 'twitter'
    lat: p.lat, lon: p.lon,
    region: p.region,
    url: p.url,
    bucket: p.bucket,
  }));

  const alertsList = [];
  // NOAA severe weather — already geo-tagged
  for (const a of (noaa.alerts || [])) {
    alertsList.push({
      id: `noaa-${(a.headline || '').substring(0, 30)}`,
      title: a.event,
      message: a.headline,
      severity: a.severity,
      source: 'NOAA',
      lat: a.lat, lon: a.lon,
    });
  }
  // ACLED conflict peaks (top 10 by fatalities)
  for (const e of (acled.deadliestEvents || []).slice(0, 10)) {
    alertsList.push({
      id: `acled-${e.id}`,
      title: `${e.event_type || 'Conflict'} · ${e.country || ''}`,
      message: `${e.fatalities || 0} fatalities · ${e.location || ''}`,
      source: 'ACLED',
      lat: e.lat, lon: e.lon,
    });
  }
  // Space/launch signals
  for (const s of (space.signals || [])) {
    alertsList.push({
      id: `space-${(s.message || '').substring(0, 20)}`,
      title: s.title || 'Space signal',
      message: s.message,
      source: 'Space',
    });
  }

  // Satellite pass predictions — placeholder until satellite.js propagator is
  // wired into apis/sources/space.mjs. For now surface ISS + station sub-points
  // so the SAT band has something meaningful (current sub-latitude) rather
  // than being empty.
  const upcomingPasses = [];
  if (space.issPosition) {
    upcomingPasses.push({
      name: 'ISS',
      aos: new Date().toISOString(),
      note: `Sub-point: ${space.issPosition.lat.toFixed(1)}, ${space.issPosition.lon.toFixed(1)}`,
    });
  }
  for (const s of (space.stationPositions || [])) {
    upcomingPasses.push({
      name: s.name,
      aos: new Date().toISOString(),
      note: `Sub-point: ${s.lat.toFixed(1)}, ${s.lon.toFixed(1)}`,
    });
  }

  // AIR layer: pass through raw OpenSky state vectors so renderCivilianFlights()
  // has individual aircraft positions to plot. Without this, the densest layer
  // on the dashboard rendered zero entities. Fix per LAYER_AUDIT_2026-04-24.md #1.
  const opensky = {
    states: data.sources.OpenSky?.states || [],
  };

  const V2 = {
    meta: data.son, air, thermal, firms, tSignals,
    chokepoints: chokepointsList, ships,
    nuke, nukeSignals,
    sdr: { total: sdrNet.totalReceivers || 0, online: sdrNet.online || 0, zones: sdrZones },
    tg: { posts: tgData.totalPosts || 0, urgent: tgUrgent, topPosts: tgTop },
    who, fred, energy, bls, treasury, gscpi, defense, noaa, epa, acled, gdelt, space, health, sourceHealth, sourceErrors, sourceTiming, news,
    adsb,    // MIL layer: militaryAircraft array — previously orphaned by ADS-B source-name hyphen
    opensky, // AIR layer: raw state vectors for civilian flight rendering
    social: { ...social, items: socialItems }, // posts (legacy) + items (stable)
    cctv,
    markets,
    ideas: [], ideasSource: 'disabled',
    newsFeed,
    // --- Stable public keys consumed by renderBands() ---
    alerts: { list: alertsList },
    satellites: { upcomingPasses },
  };
  // news stays as RSS object from fetchAllNews(); alias items alongside
  V2.news = Array.isArray(news) ? { items: newsItems, raw: news } : { ...news, items: newsItems };

  return V2;
}

// === Unified News Feed for Ticker + Worldview News Layer ===
// Every item gets lat/lon when geoTagText finds a location, so the 'news'
// layer in Worldview can render geo-points. Items without geo still flow
// to the ticker (no marker).
function buildNewsFeed(rssNews, gdeltData, tgUrgent, tgTop) {
  const feed = [];

  // RSS news — already geo-tagged in fetchAllNews()
  for (const n of rssNews) {
    feed.push({
      id: `rss-${n.source}-${(n.title || '').substring(0, 30)}`,
      headline: n.title, title: n.title,
      source: n.source, type: 'rss',
      timestamp: n.date, published: n.date,
      region: n.region, urgent: false, url: n.url,
      lat: n.lat, lon: n.lon,
    });
  }

  // GDELT top articles — geo-tag from title
  for (const a of (gdeltData.allArticles || []).slice(0, 40)) {
    if (!a.title) continue;
    const geo = geoTagText(a.title);
    feed.push({
      id: `gdelt-${(a.url || a.title).substring(0, 40)}`,
      headline: a.title.substring(0, 100), title: a.title,
      source: a.domain || 'GDELT', type: 'gdelt',
      timestamp: a.date || new Date().toISOString(),
      published: a.date,
      region: geo?.region || 'Global',
      urgent: false,
      url: sanitizeExternalUrl(a.url),
      lat: geo ? geo.lat + (Math.random() - 0.5) * 1.2 : undefined,
      lon: geo ? geo.lon + (Math.random() - 0.5) * 1.2 : undefined,
    });
  }

  // GDELT geoPoints — explicit geo-tagged events from the GEO 2.0 API.
  // These already have lat/lon so they always show up on the map.
  for (const p of (gdeltData.geoPoints || []).slice(0, 40)) {
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
    feed.push({
      id: `gdelt-geo-${p.lat.toFixed(3)}-${p.lon.toFixed(3)}`,
      headline: (p.name || 'GDELT event').substring(0, 100),
      title: p.name,
      source: 'GDELT · GEO', type: 'gdelt-geo',
      timestamp: new Date().toISOString(),
      region: p.name,
      urgent: (p.count || 1) > 3,
      lat: p.lat, lon: p.lon,
      count: p.count || 1,
    });
  }

  // Telegram urgent — try geo-tagging the text
  for (const p of tgUrgent.slice(0, 10)) {
    const text = (p.text || '').replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
    const geo = geoTagText(text);
    feed.push({
      id: `tg-u-${p.channel}-${(p.date || '').substring(0, 19)}`,
      headline: text.substring(0, 100), title: text,
      source: p.channel?.toUpperCase() || 'TELEGRAM',
      type: 'telegram',
      timestamp: p.date, published: p.date,
      region: geo?.region || 'OSINT',
      urgent: true,
      lat: geo?.lat, lon: geo?.lon,
    });
  }

  // Telegram top (non-urgent) — also try geo-tagging
  for (const p of tgTop.slice(0, 5)) {
    const text = (p.text || '').replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
    const geo = geoTagText(text);
    feed.push({
      id: `tg-t-${p.channel}-${(p.date || '').substring(0, 19)}`,
      headline: text.substring(0, 100), title: text,
      source: p.channel?.toUpperCase() || 'TELEGRAM',
      type: 'telegram',
      timestamp: p.date, published: p.date,
      region: geo?.region || 'OSINT',
      urgent: false,
      lat: geo?.lat, lon: geo?.lon,
    });
  }

  // Sort by timestamp descending, limit to 150 (bigger set — Worldview only
  // renders the geo-tagged subset anyway)
  feed.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  return feed.slice(0, 150);
}

// === CLI Mode: inject into HTML file ===
function getCliArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

async function cliInject() {
  const data = JSON.parse(readFileSync(join(ROOT, 'runs/latest.json'), 'utf8'));
  const htmlOverride = getCliArg('--html');
  const shouldOpen = !process.argv.includes('--no-open');

  console.log('Fetching RSS news feeds...');
  const V2 = await synthesize(data);
  const llmProvider = createLLMProvider(config.llm);

  if (llmProvider?.isConfigured) {
    try {
      console.log(`[LLM] Generating ideas via ${llmProvider.name}...`);
      const llmIdeas = await generateLLMIdeas(llmProvider, V2, null, []);
      if (llmIdeas?.length) {
        V2.ideas = llmIdeas;
        V2.ideasSource = 'llm';
        console.log(`[LLM] Generated ${llmIdeas.length} ideas`);
      } else {
        V2.ideas = [];
        V2.ideasSource = 'llm-failed';
        console.log('[LLM] No ideas returned');
      }
    } catch (err) {
      V2.ideas = [];
      V2.ideasSource = 'llm-failed';
      console.log('[LLM] Idea generation failed:', err.message);
    }
  } else {
    V2.ideas = [];
    V2.ideasSource = 'disabled';
  }
  console.log(`Generated ${V2.ideas.length} leverageable ideas`);

  const json = JSON.stringify(V2);
  console.log('\n--- Synthesis ---');
  console.log('Size:', json.length, 'bytes | Air:', V2.air.length, '| Thermal:', V2.thermal.length,
    '| News:', V2.news.length, '| Ideas:', V2.ideas.length, '| Sources:', V2.health.length);

  const htmlPath = htmlOverride || join(ROOT, 'dashboard/public/jarvis.html');
  let html = readFileSync(htmlPath, 'utf8');
  // Use a replacer function so JSON is inserted literally even if it contains `$`.
  html = html.replace(/^(let|const) D = .*;\s*$/m, () => 'let D = ' + json + ';');
  writeFileSync(htmlPath, html);
  console.log('Data injected into jarvis.html!');

  if (!shouldOpen) return;

  // Auto-open dashboard in default browser
  // NOTE: On Windows, `start` in PowerShell is an alias for Start-Service, not cmd's start.
  // We must use `cmd /c start ""` to ensure it works in both cmd.exe and PowerShell.
  const openCmd = process.platform === 'win32' ? 'cmd /c start ""' :
                  process.platform === 'darwin' ? 'open' : 'xdg-open';
  const dashUrl = htmlPath.replace(/\\/g, '/');
  exec(`${openCmd} "${dashUrl}"`, (err) => {
    if (err) console.log('Could not auto-open browser:', err.message);
    else console.log('Dashboard opened in browser!');
  });
}

// Run CLI if invoked directly
const isMain = process.argv[1]
  && fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/');
if (isMain) {
  await cliInject();
}
