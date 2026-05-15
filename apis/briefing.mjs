#!/usr/bin/env node

// S.O.N Master Orchestrator — runs all intelligence sources in parallel
// Outputs structured JSON for Claude to synthesize into actionable briefing

import './utils/env.mjs'; // Load API keys from .env
import { pathToFileURL } from 'node:url';

// === Tier 1: Core OSINT & Geopolitical ===
import { briefing as gdelt } from './sources/gdelt.mjs';
import { briefing as opensky } from './sources/opensky.mjs';
import { briefing as firms } from './sources/firms.mjs';
import { briefing as ships } from './sources/ships.mjs';
import { briefing as safecast } from './sources/safecast.mjs';
import { briefing as acled } from './sources/acled.mjs';
import { briefing as reliefweb } from './sources/reliefweb.mjs';
import { briefing as who } from './sources/who.mjs';
import { briefing as ofac } from './sources/ofac.mjs';
import { briefing as opensanctions } from './sources/opensanctions.mjs';
import { briefing as adsb } from './sources/adsb.mjs';

// === Tier 2: Economic & Financial ===
// FRED + EIA disabled 2026-05-01 — both providers no longer issue free API keys.
// Imports preserved as comments for future re-enable if pricing changes.
// import { briefing as fred } from './sources/fred.mjs';
import { briefing as treasury } from './sources/treasury.mjs';
import { briefing as bls } from './sources/bls.mjs';
// import { briefing as eia } from './sources/eia.mjs';
import { briefing as gscpi } from './sources/gscpi.mjs';
import { briefing as usaspending } from './sources/usaspending.mjs';
import { briefing as comtrade } from './sources/comtrade.mjs';

// === Tier 3: Weather, Environment, Technology, Social ===
import { briefing as noaa } from './sources/noaa.mjs';
import { briefing as epa } from './sources/epa.mjs';
import { briefing as patents } from './sources/patents.mjs';
import { briefing as reddit } from './sources/reddit.mjs';
import { briefing as telegram } from './sources/telegram.mjs';
import { briefing as kiwisdr } from './sources/kiwisdr.mjs';
import { briefing as cctv } from './sources/cctv.mjs';
import { briefing as newsLive } from './sources/news_live.mjs';

// === Tier 4: Space & Satellites ===
import { briefing as space } from './sources/space.mjs';

// === Tier 5: Live Market Data ===
import { briefing as yfinance } from './sources/yfinance.mjs';
import { briefing as crypto } from './sources/crypto.mjs';

// Verbose per-source progress logging. Set SON_VERBOSE_SWEEP=0 in .env to silence.
const VERBOSE = process.env.SON_VERBOSE_SWEEP !== '0';

// Source-specific data summarisers — keep tight, one-line, no clever formatting.
// Returns a short human-readable description of what the adapter actually delivered.
function summarizeSource(name, data) {
  if (!data) return '(no data)';
  // Common explicit-error shapes
  if (data.error) return `(${String(data.error).substring(0, 70)})`;
  if (data.status === 'error') return `(${String(data.error || 'error').substring(0, 70)})`;

  switch (name) {
    case 'OpenSky':       return `${data.states?.length || 0} states, ${data.hotspots?.length || 0} hotspots`;
    case 'ADS-B':         return `${data.totalMilitary || data.militaryAircraft?.length || 0} mil aircraft`;
    case 'GDELT':         return `${data.allArticles?.length || 0} articles, ${data.geoPoints?.length || 0} geo`;
    case 'ACLED':         return `${data.deadliestEvents?.length || 0} events, ${data.totalFatalities || 0} fatal`;
    case 'FIRMS':         return `${data.totalHotspots || data.detections?.length || 0} hotspots`;
    case 'NOAA':          return `${data.totalSevereAlerts || 0} severe, ${data.topAlerts?.length || 0} top`;
    case 'Maritime':      return `${data.activeVessels || 0} vessels, ${data.aisStatus || ''}`;
    case 'Space':         return `${data.totalNewObjects || 0} new objects, ${data.spaceStations?.length || 0} stations`;
    case 'NewsLive':      return `${data.streams?.length || 0} streams${data.status ? ' · ' + data.status : ''}`;
    case 'CCTV':          return `${data.cameras?.length || 0} cameras`;
    case 'YFinance':      return `${(data.indexes?.length || 0) + (data.commodities?.length || 0) + (data.rates?.length || 0)} quotes`;
    case 'Crypto':        return `${data.crypto?.length || 0} coins`;
    case 'Reddit':        return `${data.posts?.length || data.totalPosts || 0} posts`;
    case 'Telegram':      return `${data.totalPosts || 0} posts, ${data.urgent?.length || 0} urgent`;
    case 'Bluesky':       return `${Object.values(data.topics || {}).flat().length} posts`;
    case 'Nitter':        return `${data.posts?.length || 0} posts`;
    case 'KiwiSDR':       return `${data.online || 0}/${data.totalReceivers || 0} receivers`;
    case 'WHO':           return `${data.outbreaks?.length || 0} outbreaks`;
    case 'EPA':           return `${data.totalReadings || 0} readings`;
    case 'Safecast':      return `${data.totalMeasurements || 0} measurements`;
    case 'OFAC':          return `${data.totalEntities || 0} entities`;
    case 'OpenSanctions': return `${data.entityCount || 0} entities`;
    case 'ReliefWeb':     return `${data.totalReports || 0} reports`;
    case 'Patents':       return `${data.totalPatents || 0} patents`;
    case 'FRED':          return `${data.totalSeries || 0} series`;
    case 'BLS':           return `${data.totalSeries || 0} series`;
    case 'EIA':           return `${data.totalSeries || 0} series`;
    case 'GSCPI':         return `${data.value ?? '—'}`;
    case 'Treasury':      return `${data.totalDebt ? '$' + data.totalDebt + 'T' : 'debt'} · ${data.yieldCurve ? 'yc ok' : 'yc —'}`;
    case 'USAspending':   return `${data.totalContracts || 0} contracts`;
    case 'Comtrade':      return `${data.totalFlows || 0} flows`;
  }

  // Fallback: report any array fields we can find
  const arrays = Object.entries(data)
    .filter(([_, v]) => Array.isArray(v))
    .slice(0, 2)
    .map(([k, v]) => `${v.length} ${k}`);
  return arrays.length ? arrays.join(', ') : 'ok';
}

// Detect "degraded" health: the function returned without throwing, but the
// payload signals it didn't actually deliver (key missing, auth failure, etc).
// Distinguishes from clean "ok" so the boot banner gives honest counts.
function classifyHealth(data) {
  if (!data) return 'ok';
  if (data.error || data.status === 'error') {
    const msg = String(data.error || '').toLowerCase();
    if (/no .* key|no .*_key|no .* credentials|no key|missing key|api[_ ]?key/.test(msg)) return 'key-gated';
    return 'degraded';
  }
  // Some adapters return status: 'no_key' instead of error
  if (data.status === 'no_key' || data.status === 'no_credentials') return 'key-gated';
  return 'ok';
}

export async function runSource(name, fn, ...args) {
  const start = Date.now();
  if (VERBOSE) console.error(`  → ${name}`);
  try {
    const data = await fn(...args);
    const ms = Date.now() - start;
    const health = classifyHealth(data);
    const summary = summarizeSource(name, data);
    if (VERBOSE) {
      const icon = health === 'ok' ? '✓' : health === 'key-gated' ? 'K' : '!';
      console.error(`  ${icon} ${name.padEnd(14)} ${String(ms).padStart(5)}ms · ${summary}`);
    }
    return { name, status: 'ok', health, durationMs: ms, data };
  } catch (e) {
    const ms = Date.now() - start;
    if (VERBOSE) {
      console.error(`  ✗ ${name.padEnd(14)} ${String(ms).padStart(5)}ms · ${(e.message || 'error').substring(0, 70)}`);
    }
    return { name, status: 'error', health: 'failed', durationMs: ms, error: e.message };
  }
}

export async function fullBriefing() {
  console.error('\n[S.O.N] ▶ Intelligence sweep — 29 sources, parallel');
  const start = Date.now();

  const results = await Promise.allSettled([
    // Tier 1: Core OSINT & Geopolitical
    runSource('GDELT', gdelt),
    runSource('OpenSky', opensky),
    runSource('FIRMS', firms),
    runSource('Maritime', ships),
    runSource('Safecast', safecast),
    runSource('ACLED', acled),
    runSource('ReliefWeb', reliefweb),
    runSource('WHO', who),
    runSource('OFAC', ofac),
    runSource('OpenSanctions', opensanctions),
    runSource('ADS-B', adsb),

    // Tier 2: Economic & Financial
    // FRED + EIA removed 2026-05-01: free key access discontinued by providers.
    // runSource('FRED', fred, process.env.FRED_API_KEY),
    runSource('Treasury', treasury),
    runSource('BLS', bls, process.env.BLS_API_KEY),
    // runSource('EIA', eia, process.env.EIA_API_KEY),
    runSource('GSCPI', gscpi),
    runSource('USAspending', usaspending),
    runSource('Comtrade', comtrade),

    // Tier 3: Weather, Environment, Technology, Social
    runSource('NOAA', noaa),
    runSource('EPA', epa),
    runSource('Patents', patents),
    // runSource('Bluesky', bluesky),  // DEAD: public.api.bsky.app returns 403 as of 2026-04. Re-enable when fixed.
    runSource('Reddit', reddit),
    runSource('Telegram', telegram),
    runSource('KiwiSDR', kiwisdr),
    // runSource('Nitter', nitter),  // DEAD: all 6 mirrors offline as of 2026-04. Retire.
    runSource('CCTV', cctv),
    runSource('NewsLive', newsLive),

    // Tier 4: Space & Satellites
    runSource('Space', space),

    // Tier 5: Live Market Data
    runSource('YFinance', yfinance),
    runSource('Crypto', crypto),
  ]);

  const sources = results.map(r => r.status === 'fulfilled' ? r.value : { status: 'failed', health: 'failed', error: r.reason?.message });
  const totalMs = Date.now() - start;

  // Honest health buckets: clean, key-gated (ran but no key), degraded
  // (ran with explicit error), failed (threw exception).
  const okClean    = sources.filter(s => s.status === 'ok' && s.health === 'ok');
  const keyGated   = sources.filter(s => s.health === 'key-gated');
  const degraded   = sources.filter(s => s.health === 'degraded');
  const failed     = sources.filter(s => s.status !== 'ok');

  const output = {
    son: {
      version: '2.0.0',
      product: 'S.O.N',
      timestamp: new Date().toISOString(),
      totalDurationMs: totalMs,
      sourcesQueried: sources.length,
      sourcesOk: okClean.length,
      sourcesKeyGated: keyGated.length,
      sourcesDegraded: degraded.length,
      sourcesFailed: failed.length,
      // Legacy alias for any UI still reading the old field name
      sourcesOkLegacy: sources.filter(s => s.status === 'ok').length,
    },
    sources: Object.fromEntries(
      sources.filter(s => s.status === 'ok').map(s => [s.name, s.data])
    ),
    health: Object.fromEntries(
      sources.map(s => [s.name, s.health || 'unknown'])
    ),
    errors: failed.map(s => ({ name: s.name, error: s.error })),
    timing: Object.fromEntries(
      sources.map(s => [s.name, { status: s.status, health: s.health, ms: s.durationMs }])
    ),
  };

  // Honest summary line: ok / key-gated / degraded / failed
  const summary = [
    `${okClean.length} ok`,
    keyGated.length ? `${keyGated.length} key-gated` : null,
    degraded.length ? `${degraded.length} degraded` : null,
    failed.length ? `${failed.length} failed` : null,
  ].filter(Boolean).join(' · ');
  console.error(`[S.O.N] ◼ Sweep complete in ${(totalMs / 1000).toFixed(1)}s · ${summary}`);
  if (keyGated.length && VERBOSE) {
    console.error(`[S.O.N]   key-gated: ${keyGated.map(s => s.name).join(', ')}`);
  }
  if (degraded.length && VERBOSE) {
    console.error(`[S.O.N]   degraded:  ${degraded.map(s => s.name).join(', ')}`);
  }
  if (failed.length && VERBOSE) {
    console.error(`[S.O.N]   failed:    ${failed.map(s => s.name).join(', ')}`);
  }
  return output;
}

// Run and output when executed directly
const entryHref = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (entryHref && import.meta.url === entryHref) {
  const data = await fullBriefing();
  console.log(JSON.stringify(data, null, 2));
}
