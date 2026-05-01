#!/usr/bin/env node
// S.O.N — Strands OSINT Network Dev Server (absorbed S.O.N)
// Serves the Jarvis dashboard, runs sweep cycle, pushes live updates via SSE

import express from 'express';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import config from './son.config.mjs';
import { fullBriefing } from './apis/briefing.mjs';
import { synthesize, generateIdeas } from './dashboard/inject.mjs';
import { MemoryManager } from './lib/delta/index.mjs';
import { createLLMProvider } from './lib/llm/index.mjs';
import { generateLLMIdeas } from './lib/llm/ideas.mjs';
import { TelegramAlerter } from './lib/alerts/telegram.mjs';
import { DiscordAlerter } from './lib/alerts/discord.mjs';
import { TOOL_SCHEMAS, buildToolExecutors, runToolLoop, CHAT_SYSTEM_PROMPT } from './lib/chat/tools.mjs';
import { start as startAisListener, getStatus as getAisStatus } from './apis/live/aisstream.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const RUNS_DIR = join(ROOT, 'runs');
const MEMORY_DIR = join(RUNS_DIR, 'memory');

// Ensure directories exist
for (const dir of [RUNS_DIR, MEMORY_DIR, join(MEMORY_DIR, 'cold')]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// === State ===
let currentData = null;    // Current synthesized dashboard data
let lastSweepTime = null;  // Timestamp of last sweep
let sweepStartedAt = null; // Timestamp when current/last sweep started
let sweepInProgress = false;
const startTime = Date.now();
const sseClients = new Set();

// === Delta/Memory ===
const memory = new MemoryManager(RUNS_DIR);

// === LLM + Telegram + Discord ===
const llmProvider = createLLMProvider(config.llm);
const telegramAlerter = new TelegramAlerter(config.telegram);
const discordAlerter = new DiscordAlerter(config.discord || {});

if (llmProvider) {
  // Probe once at startup so the console shows real reachability, not just config presence.
  // Async fire-and-forget — the boot banner prints below regardless, this just adds a
  // follow-up line once the ping resolves.
  console.log(`[S.O.N] LLM configured: ${llmProvider.name} (${llmProvider.model}) — probing...`);
  if (llmProvider.ping) {
    llmProvider.ping().then(ok => {
      console.log(`[S.O.N] LLM status: ${ok ? 'ONLINE' : 'OFFLINE (start LM Studio to enable the Consigliere)'}`);
    }).catch(() => {
      console.log('[S.O.N] LLM status: OFFLINE (probe threw)');
    });
  }
}
if (telegramAlerter.isConfigured) {
  console.log('[S.O.N] Telegram alerts enabled');

  // ─── Two-Way Bot Commands ───────────────────────────────────────────────

  telegramAlerter.onCommand('/status', async () => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const sourcesOk = currentData?.meta?.sourcesOk || 0;
    const sourcesTotal = currentData?.meta?.sourcesQueried || 0;
    const sourcesFailed = currentData?.meta?.sourcesFailed || 0;
    const llmStatus = llmProvider?.isConfigured ? `✅ ${llmProvider.name}` : '❌ Disabled';
    const nextSweep = lastSweepTime
      ? new Date(new Date(lastSweepTime).getTime() + config.refreshIntervalMinutes * 60000).toLocaleTimeString()
      : 'pending';

    return [
      `🖥️ *S.O.N STATUS*`,
      ``,
      `Uptime: ${h}h ${m}m`,
      `Last sweep: ${lastSweepTime ? new Date(lastSweepTime).toLocaleTimeString() + ' UTC' : 'never'}`,
      `Next sweep: ${nextSweep} UTC`,
      `Sweep in progress: ${sweepInProgress ? '🔄 Yes' : '⏸️ No'}`,
      `Sources: ${sourcesOk}/${sourcesTotal} OK${sourcesFailed > 0 ? ` (${sourcesFailed} failed)` : ''}`,
      `LLM: ${llmStatus}`,
      `SSE clients: ${sseClients.size}`,
      `Dashboard: http://localhost:${config.port}`,
    ].join('\n');
  });

  telegramAlerter.onCommand('/sweep', async () => {
    if (sweepInProgress) return '🔄 Sweep already in progress. Please wait.';
    // Fire and forget — don't block the bot response
    runSweepCycle().catch(err => console.error('[S.O.N] Manual sweep failed:', err.message));
    return '🚀 Manual sweep triggered. You\'ll receive alerts if anything significant is detected.';
  });

  telegramAlerter.onCommand('/brief', async () => {
    if (!currentData) return '⏳ No data yet — waiting for first sweep to complete.';

    const tg = currentData.tg || {};
    const energy = currentData.energy || {};
    const delta = memory.getLastDelta();
    const ideas = (currentData.ideas || []).slice(0, 3);

    const sections = [
      `📋 *S.O.N BRIEF*`,
      `_${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC_`,
      ``,
    ];

    // Delta direction
    if (delta?.summary) {
      const dirEmoji = { 'risk-off': '📉', 'risk-on': '📈', 'mixed': '↔️' }[delta.summary.direction] || '↔️';
      sections.push(`${dirEmoji} Direction: *${delta.summary.direction.toUpperCase()}* | ${delta.summary.totalChanges} changes, ${delta.summary.criticalChanges} critical`);
      sections.push('');
    }

    // Key metrics
    const vix = currentData.fred?.find(f => f.id === 'VIXCLS');
    const hy = currentData.fred?.find(f => f.id === 'BAMLH0A0HYM2');
    if (vix || energy.wti) {
      sections.push(`📊 VIX: ${vix?.value || '--'} | WTI: $${energy.wti || '--'} | Brent: $${energy.brent || '--'}`);
      if (hy) sections.push(`   HY Spread: ${hy.value} | NatGas: $${energy.natgas || '--'}`);
      sections.push('');
    }

    // OSINT
    if (tg.urgent?.length > 0) {
      sections.push(`📡 OSINT: ${tg.urgent.length} urgent signals, ${tg.posts || 0} total posts`);
      // Top 2 urgent
      for (const p of tg.urgent.slice(0, 2)) {
        sections.push(`  • ${(p.text || '').substring(0, 80)}`);
      }
      sections.push('');
    }

    // Top ideas
    if (ideas.length > 0) {
      sections.push(`💡 *Top Ideas:*`);
      for (const idea of ideas) {
        sections.push(`  ${idea.type === 'long' ? '📈' : idea.type === 'hedge' ? '🛡️' : '👁️'} ${idea.title}`);
      }
    }

    return sections.join('\n');
  });

  telegramAlerter.onCommand('/portfolio', async () => {
    return '📊 Portfolio integration requires Alpaca MCP connection.\nUse the S.O.N dashboard or Claude agent for portfolio queries.';
  });

  // Start polling for bot commands
  telegramAlerter.startPolling(config.telegram.botPollingInterval);
}

// === Discord Bot ===
if (discordAlerter.isConfigured) {
  console.log('[S.O.N] Discord bot enabled');

  // Reuse the same command handlers as Telegram (DRY)
  discordAlerter.onCommand('status', async () => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const sourcesOk = currentData?.meta?.sourcesOk || 0;
    const sourcesTotal = currentData?.meta?.sourcesQueried || 0;
    const sourcesFailed = currentData?.meta?.sourcesFailed || 0;
    const llmStatus = llmProvider?.isConfigured ? `✅ ${llmProvider.name}` : '❌ Disabled';
    const nextSweep = lastSweepTime
      ? new Date(new Date(lastSweepTime).getTime() + config.refreshIntervalMinutes * 60000).toLocaleTimeString()
      : 'pending';

    return [
      `**🖥️ S.O.N STATUS**\n`,
      `Uptime: ${h}h ${m}m`,
      `Last sweep: ${lastSweepTime ? new Date(lastSweepTime).toLocaleTimeString() + ' UTC' : 'never'}`,
      `Next sweep: ${nextSweep} UTC`,
      `Sweep in progress: ${sweepInProgress ? '🔄 Yes' : '⏸️ No'}`,
      `Sources: ${sourcesOk}/${sourcesTotal} OK${sourcesFailed > 0 ? ` (${sourcesFailed} failed)` : ''}`,
      `LLM: ${llmStatus}`,
      `SSE clients: ${sseClients.size}`,
      `Dashboard: http://localhost:${config.port}`,
    ].join('\n');
  });

  discordAlerter.onCommand('sweep', async () => {
    if (sweepInProgress) return '🔄 Sweep already in progress. Please wait.';
    runSweepCycle().catch(err => console.error('[S.O.N] Manual sweep failed:', err.message));
    return '🚀 Manual sweep triggered. You\'ll receive alerts if anything significant is detected.';
  });

  discordAlerter.onCommand('brief', async () => {
    if (!currentData) return '⏳ No data yet — waiting for first sweep to complete.';

    const tg = currentData.tg || {};
    const energy = currentData.energy || {};
    const delta = memory.getLastDelta();
    const ideas = (currentData.ideas || []).slice(0, 3);

    const sections = [`**📋 S.O.N BRIEF**\n_${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC_\n`];

    if (delta?.summary) {
      const dirEmoji = { 'risk-off': '📉', 'risk-on': '📈', 'mixed': '↔️' }[delta.summary.direction] || '↔️';
      sections.push(`${dirEmoji} Direction: **${delta.summary.direction.toUpperCase()}** | ${delta.summary.totalChanges} changes, ${delta.summary.criticalChanges} critical\n`);
    }

    const vix = currentData.fred?.find(f => f.id === 'VIXCLS');
    const hy = currentData.fred?.find(f => f.id === 'BAMLH0A0HYM2');
    if (vix || energy.wti) {
      sections.push(`📊 VIX: ${vix?.value || '--'} | WTI: $${energy.wti || '--'} | Brent: $${energy.brent || '--'}`);
      if (hy) sections.push(`   HY Spread: ${hy.value} | NatGas: $${energy.natgas || '--'}`);
      sections.push('');
    }

    if (tg.urgent?.length > 0) {
      sections.push(`📡 OSINT: ${tg.urgent.length} urgent signals, ${tg.posts || 0} total posts`);
      for (const p of tg.urgent.slice(0, 2)) {
        sections.push(`  • ${(p.text || '').substring(0, 80)}`);
      }
      sections.push('');
    }

    if (ideas.length > 0) {
      sections.push(`**💡 Top Ideas:**`);
      for (const idea of ideas) {
        sections.push(`  ${idea.type === 'long' ? '📈' : idea.type === 'hedge' ? '🛡️' : '👁️'} ${idea.title}`);
      }
    }

    return sections.join('\n');
  });

  discordAlerter.onCommand('portfolio', async () => {
    return '📊 Portfolio integration requires Alpaca MCP connection.\nUse the S.O.N dashboard or Claude agent for portfolio queries.';
  });

  // Start the Discord bot (non-blocking — connection happens async)
  discordAlerter.start().catch(err => {
    console.error('[S.O.N] Discord bot startup failed (non-fatal):', err.message);
  });
}

// === Chat Tool Executors (bound to live state) ===
const toolExecutors = buildToolExecutors({
  getCurrentData: () => currentData,
  getMemory: () => memory,
});

// === Express Server ===
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(ROOT, 'dashboard/public')));

// Root now serves the S.O.N Worldview (the new Cesium 3D command center).
// Legacy Jarvis dashboard remains at /jarvis for reference.
app.get('/', (req, res) => {
  if (!currentData) {
    res.sendFile(join(ROOT, 'dashboard/public/loading.html'));
  } else {
    res.sendFile(join(ROOT, 'dashboard/public/worldview.html'));
  }
});
app.get('/jarvis', (req, res) => {
  res.sendFile(join(ROOT, 'dashboard/public/jarvis.html'));
});

// Worldview — Cesium 3D command center (Variant D aesthetic)
app.get('/worldview', (req, res) => {
  res.sendFile(join(ROOT, 'dashboard/public/worldview.html'));
});

// GPSJam daily interference tiles — proxied to dodge CORS and cache.
// Source: https://gpsjam.org/ publishes a daily H3 hex GeoJSON.
let _gpsjamCache = { ts: 0, body: null };
app.get('/api/proxy/gpsjam', async (req, res) => {
  try {
    // Cache 10 minutes
    if (_gpsjamCache.body && (Date.now() - _gpsjamCache.ts) < 10 * 60_000) {
      return res.type('application/json').send(_gpsjamCache.body);
    }
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(today.getUTCDate()).padStart(2, '0');
    // GPSJam URL pattern — daily aggregated H3 resolution 4 tiles
    const url = `https://gpsjam.org/data/${yyyy}-${mm}-${dd}-h3_4.json`;
    const r = await fetch(url);
    if (!r.ok) {
      // Fall back to yesterday if today is not yet published
      const y = new Date(today.getTime() - 24 * 3600_000);
      const yUrl = `https://gpsjam.org/data/${y.getUTCFullYear()}-${String(y.getUTCMonth() + 1).padStart(2, '0')}-${String(y.getUTCDate()).padStart(2, '0')}-h3_4.json`;
      const r2 = await fetch(yUrl);
      if (!r2.ok) return res.status(502).json({ error: 'gpsjam upstream unavailable' });
      const body = await r2.text();
      _gpsjamCache = { ts: Date.now(), body };
      return res.type('application/json').send(body);
    }
    const body = await r.text();
    _gpsjamCache = { ts: Date.now(), body };
    res.type('application/json').send(body);
  } catch (err) {
    console.error('[S.O.N] gpsjam proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: client-side public config — keys and toggles the worldview client
// needs to know about. Only exposes keys explicitly designated as public
// (Google Maps Tiles, Cesium Ion). Never expose ADSB, AISSTREAM, ACLED, etc.
// Per RECON_SPRINT_ARCHITECTURE 2026-04-30 Section 2.1.
app.get('/api/config', (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null,
    cesiumIonToken: process.env.CESIUM_ION_TOKEN || null,
    refreshIntervalMinutes: config.refreshIntervalMinutes,
    // Layer health flags (so client can render honest badges instead of empty
    // entities for key-gated layers)
    keys: {
      googleMaps: !!process.env.GOOGLE_MAPS_API_KEY,
      cesiumIon: !!process.env.CESIUM_ION_TOKEN,
      adsb: !!(process.env.ADSB_API_KEY || process.env.RAPIDAPI_KEY),
      firms: !!process.env.FIRMS_MAP_KEY,
      acled: !!(process.env.ACLED_EMAIL && process.env.ACLED_PASSWORD),
      aisstream: !!process.env.AISSTREAM_API_KEY,
      youtube: !!process.env.YOUTUBE_API_KEY,
      eventbrite: !!process.env.EVENTBRITE_TOKEN,
      songkick: !!process.env.SONGKICK_API_KEY,
      here: !!process.env.HERE_API_KEY,
    },
  });
});

// API: current data
app.get('/api/data', (req, res) => {
  if (!currentData) return res.status(503).json({ error: 'No data yet — first sweep in progress' });
  res.json(currentData);
});

// API: health check
app.get('/api/health', async (req, res) => {
  // llmReachable: actually ping the LLM endpoint (not just whether provider is configured).
  // null if no provider set, true if ping succeeds, false if it fails or times out.
  let llmReachable = null;
  if (llmProvider?.ping) {
    llmReachable = await llmProvider.ping().catch(() => false);
  } else if (llmProvider?.isConfigured) {
    llmReachable = true;
  }
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    lastSweep: lastSweepTime,
    nextSweep: lastSweepTime
      ? new Date(new Date(lastSweepTime).getTime() + config.refreshIntervalMinutes * 60000).toISOString()
      : null,
    sweepInProgress,
    sweepStartedAt,
    sourcesOk: currentData?.meta?.sourcesOk || 0,
    sourcesFailed: currentData?.meta?.sourcesFailed || 0,
    llmEnabled: !!config.llm.provider,
    llmProvider: config.llm.provider,
    llmReachable,
    telegramEnabled: !!(config.telegram.botToken && config.telegram.chatId),
    refreshIntervalMinutes: config.refreshIntervalMinutes,
  });
});

// API: manual sweep trigger (pull-live + pull-region).
// Optional ?bbox=W,S,E,N restricts to a viewport for region-scoped context.
// Currently: bbox is attached to the next sweep as metadata so downstream sources
// (GDELT, social, AIS) can filter. Future: true geo-scoped pull per source.
// Body/query-agnostic: responds immediately, work happens async via SSE.
app.post('/api/sweep', async (req, res) => {
  const bboxRaw = (req.query?.bbox || req.body?.bbox || '').toString();
  let bbox = null;
  if (bboxRaw) {
    const parts = bboxRaw.split(',').map(Number);
    if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
      bbox = { west: parts[0], south: parts[1], east: parts[2], north: parts[3] };
    }
  }
  if (sweepInProgress) {
    return res.status(202).json({
      status: 'already_in_progress',
      sweepStartedAt,
      bboxIgnored: !!bbox,
    });
  }
  // Broadcast the scope BEFORE triggering so the client UI can label results
  broadcast({ type: 'sweep_trigger', source: bbox ? 'region' : 'live', bbox });
  // Fire-and-forget sweep
  runSweepCycle().catch(err => console.error('[S.O.N] Manual sweep failed:', err.message));
  res.json({ status: 'triggered', bbox, timestamp: new Date().toISOString() });
});

// API: consigliere chat — tool-using LLM grounded in the live sweep data.
// Body: { messages?: [{role, content}], message?: string, model?: string,
//         temperature?: number, maxTokens?: number, maxSteps?: number,
//         includeTrace?: boolean }
// Response: { reply, steps, trace?, model }
app.post('/api/chat', async (req, res) => {
  try {
    if (!llmProvider) {
      return res.status(503).json({ error: 'LLM provider not configured. Set LLM_PROVIDER in .env (lmstudio recommended for local).' });
    }
    if (!llmProvider.chat) {
      return res.status(501).json({ error: `Provider "${llmProvider.name}" does not support tool-use chat. Use lmstudio or a provider that implements chat().` });
    }
    if (!currentData) {
      return res.status(503).json({ error: 'No sweep data yet — initial sweep still in progress. Try again in a moment.' });
    }

    const body = req.body || {};
    const userText = typeof body.message === 'string' ? body.message : null;
    const history = Array.isArray(body.messages) ? body.messages : null;

    let messages;
    if (history?.length) {
      // If caller supplies full history, trust it but inject system prompt if missing
      messages = history[0]?.role === 'system'
        ? history
        : [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...history];
    } else if (userText) {
      messages = [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ];
    } else {
      return res.status(400).json({ error: 'Provide either `message` (string) or `messages` (array).' });
    }

    const { text, trace, steps } = await runToolLoop(llmProvider, messages, toolExecutors, {
      tools: TOOL_SCHEMAS,
      maxSteps: body.maxSteps ?? 6,
      temperature: body.temperature ?? 0.4,
      maxTokens: body.maxTokens ?? 4096,
    });

    const payload = { reply: text, steps, model: llmProvider.model };
    if (body.includeTrace) payload.trace = trace;
    res.json(payload);
  } catch (err) {
    console.error('[S.O.N] /api/chat error:', err.stack || err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: AIS live stream status (for debugging the Maritime layer)
app.get('/api/ais/status', (req, res) => {
  res.json({
    hasKey: !!process.env.AISSTREAM_API_KEY,
    ...getAisStatus(),
  });
});

// API: LM Studio health probe (provider-specific; safe no-op for non-LMStudio)
app.get('/api/chat/health', async (req, res) => {
  if (!llmProvider) return res.json({ configured: false });
  const out = { configured: true, provider: llmProvider.name, model: llmProvider.model };
  if (typeof llmProvider.ping === 'function') {
    out.ping = await llmProvider.ping();
  }
  res.json(out);
});

// SSE: live updates
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch { sseClients.delete(client); }
  }
}

// === Sweep Cycle ===
async function runSweepCycle() {
  if (sweepInProgress) {
    console.log('[S.O.N] Sweep already in progress, skipping');
    return;
  }

  sweepInProgress = true;
  sweepStartedAt = new Date().toISOString();
  broadcast({ type: 'sweep_start', timestamp: sweepStartedAt });
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[S.O.N] Starting sweep at ${new Date().toLocaleTimeString()}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // 1. Run the full briefing sweep
    const rawData = await fullBriefing();

    // 2. Save to runs/latest.json
    writeFileSync(join(RUNS_DIR, 'latest.json'), JSON.stringify(rawData, null, 2));
    lastSweepTime = new Date().toISOString();

    // 3. Synthesize into dashboard format
    console.log('[S.O.N] Synthesizing dashboard data...');
    const synthesized = await synthesize(rawData);

    // 4. Delta computation + memory
    const delta = memory.addRun(synthesized);
    synthesized.delta = delta;

    // 5. LLM-powered trade ideas (LLM-only feature) — isolated so failures don't kill sweep
    if (llmProvider?.isConfigured) {
      try {
        console.log('[S.O.N] Generating LLM trade ideas...');
        const previousIdeas = memory.getLastRun()?.ideas || [];
        const llmIdeas = await generateLLMIdeas(llmProvider, synthesized, delta, previousIdeas);
        if (llmIdeas) {
          synthesized.ideas = llmIdeas;
          synthesized.ideasSource = 'llm';
          console.log(`[S.O.N] LLM generated ${llmIdeas.length} ideas`);
        } else {
          synthesized.ideas = [];
          synthesized.ideasSource = 'llm-failed';
        }
      } catch (llmErr) {
        console.error('[S.O.N] LLM ideas failed (non-fatal):', llmErr.message);
        synthesized.ideas = [];
        synthesized.ideasSource = 'llm-failed';
      }
    } else {
      synthesized.ideas = [];
      synthesized.ideasSource = 'disabled';
    }

    // 6. Alert evaluation — Telegram + Discord (LLM with rule-based fallback, multi-tier, semantic dedup)
    if (delta?.summary?.totalChanges > 0) {
      if (telegramAlerter.isConfigured) {
        telegramAlerter.evaluateAndAlert(llmProvider, delta, memory).catch(err => {
          console.error('[S.O.N] Telegram alert error:', err.message);
        });
      }
      if (discordAlerter.isConfigured) {
        discordAlerter.evaluateAndAlert(llmProvider, delta, memory).catch(err => {
          console.error('[S.O.N] Discord alert error:', err.message);
        });
      }
    }

    // Prune old alerted signals
    memory.pruneAlertedSignals();

    currentData = synthesized;

    // 6. Push to all connected browsers
    broadcast({ type: 'update', data: currentData });

    console.log(`[S.O.N] Sweep complete — ${currentData.meta.sourcesOk}/${currentData.meta.sourcesQueried} sources OK`);
    console.log(`[S.O.N] ${currentData.ideas.length} ideas (${synthesized.ideasSource}) | ${currentData.news?.items?.length || 0} news | ${currentData.newsFeed?.length || 0} feed items`);
    if (delta?.summary) console.log(`[S.O.N] Delta: ${delta.summary.totalChanges} changes, ${delta.summary.criticalChanges} critical, direction: ${delta.summary.direction}`);
    console.log(`[S.O.N] Next sweep at ${new Date(Date.now() + config.refreshIntervalMinutes * 60000).toLocaleTimeString()}`);

  } catch (err) {
    console.error('[S.O.N] Sweep failed:', err.message);
    broadcast({ type: 'sweep_error', error: err.message });
  } finally {
    sweepInProgress = false;
  }
}

// === Startup ===
async function start() {
  const port = config.port;

  console.log(`
  ╔══════════════════════════════════════════════╗
  ║        S.O.N · STRANDS OSINT NETWORK         ║
  ║     Local god's-eye · 30 OSINT sources       ║
  ╠══════════════════════════════════════════════╣
  ║  Dashboard:  http://localhost:${port}${' '.repeat(14 - String(port).length)}║
  ║  Worldview:  http://localhost:${port}/worldview${' '.repeat(4 - String(port).length)}║
  ║  Health:     http://localhost:${port}/api/health${' '.repeat(4 - String(port).length)}║
  ║  Refresh:    Every ${config.refreshIntervalMinutes} min${' '.repeat(20 - String(config.refreshIntervalMinutes).length)}║
  ║  LLM:        ${(config.llm.provider || 'disabled').padEnd(31)}║
  ║  Telegram:   ${config.telegram.botToken ? 'enabled' : 'disabled'}${' '.repeat(config.telegram.botToken ? 24 : 23)}║
  ║  Discord:    ${config.discord?.botToken ? 'enabled' : config.discord?.webhookUrl ? 'webhook only' : 'disabled'}${' '.repeat(config.discord?.botToken ? 24 : config.discord?.webhookUrl ? 20 : 23)}║
  ╚══════════════════════════════════════════════╝
  `);

  const server = app.listen(port);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[S.O.N] FATAL: Port ${port} is already in use!`);
      console.error(`[S.O.N] A previous S.O.N instance may still be running.`);
      console.error(`[S.O.N] Fix:  taskkill /F /IM node.exe   (Windows)`);
      console.error(`[S.O.N]       kill $(lsof -ti:${port})   (macOS/Linux)`);
      console.error(`[S.O.N] Or change PORT in .env\n`);
    } else {
      console.error(`[S.O.N] Server error:`, err.stack || err.message);
    }
    process.exit(1);
  });

  server.on('listening', () => {
    console.log(`[S.O.N] Server running on http://localhost:${port}`);

    // Start persistent AIS WebSocket listener (no-op if AISSTREAM_API_KEY unset)
    try {
      const aisStarted = startAisListener();
      if (aisStarted) console.log('[S.O.N] AIS live listener started');
    } catch (e) {
      console.warn('[S.O.N] AIS listener failed to start (non-fatal):', e.message);
    }

    // Auto-open browser
    // NOTE: On Windows, `start` in PowerShell is an alias for Start-Service, not cmd's start.
    // We must use `cmd /c start ""` to ensure it works in both cmd.exe and PowerShell.
    const openCmd = process.platform === 'win32' ? 'cmd /c start ""' :
                    process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${openCmd} "http://localhost:${port}"`, (err) => {
      if (err) console.log('[S.O.N] Could not auto-open browser:', err.message);
    });

    // Try to load existing data first for instant display
    try {
      const existing = JSON.parse(readFileSync(join(RUNS_DIR, 'latest.json'), 'utf8'));
      synthesize(existing).then(data => {
        currentData = data;
        console.log('[S.O.N] Loaded existing data from runs/latest.json');
        broadcast({ type: 'update', data: currentData });
      }).catch(() => {});
    } catch { /* no existing data */ }

    // Run first sweep
    console.log('[S.O.N] Running initial sweep...');
    runSweepCycle().catch(err => {
      console.error('[S.O.N] Initial sweep failed:', err.message || err);
    });

    // Schedule recurring sweeps
    setInterval(runSweepCycle, config.refreshIntervalMinutes * 60 * 1000);
  });
}

// Graceful error handling — log full stack traces for diagnosis
process.on('unhandledRejection', (err) => {
  console.error('[S.O.N] Unhandled rejection:', err?.stack || err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('[S.O.N] Uncaught exception:', err?.stack || err?.message || err);
});

start().catch(err => {
  console.error('[S.O.N] FATAL — Server failed to start:', err?.stack || err?.message || err);
  process.exit(1);
});
