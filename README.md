<div align="center">

# S.O.N

**Strands OSINT Network**

*An operator-grade god's-eye terminal for open-source intelligence. Twenty-nine feeds, one globe, your machine.*

[![Node.js 22+](https://img.shields.io/badge/node-22%2B-brightgreen)](#quick-start)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPLv3-blue.svg)](LICENSE)
[![OSINT sources](https://img.shields.io/badge/OSINT%20sources-29-cyan)](#data-sources)
[![LM Studio](https://img.shields.io/badge/LLM-LM%20Studio%20local-purple)](#lm-studio-integration)
[![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)](#docker)

</div>

---

## The 4 Gods Eye

S.O.N is built around a spatial computing idea articulated by [Bilawal Sidhu](https://bilawalsidhu.com): the *Four Gods Eye*. Four camera perspectives define how we perceive the world: **first-person** (egocentric, through our own eyes), **second-person** (an observer looking back at us), **third-person** (following behind), and **god's-eye** (allocentric, the view from above the world itself).

Most of what humans build for situational awareness lives in the first three. Dashboards, chat feeds, push notifications, timelines. S.O.N is a serious attempt at the fourth. A real-time OSINT pipeline rendered onto a single Cesium globe you can pilot from your desktop, with every source, every event, every signal geo-anchored to a coordinate on the planet where it actually occurred.

The god's-eye is not a metaphor. It is the interface.

---

## What It Is

S.O.N pulls twenty-nine open-source intelligence feeds in parallel every fifteen minutes and renders them on a local 3D globe: satellite fire detection, flight tracking, maritime AIS, radiation monitoring, conflict events, sanctions lists, news, social sentiment, macroeconomic indicators, live markets, space object catalogues, and public CCTV streams. Everything geo-tagged. Everything local-first.

Hook it up to a local LLM via **LM Studio** and it becomes a two-way intelligence partner. A Consigliere that sees your map, toggles layers for you, queries any source, pulls market snapshots, computes satellite passes, and pushes multi-tier alerts to Telegram or Discord when something meaningful changes.

- **Local-first.** The full intelligence loop runs on your machine. No cloud dependency for the core product. No telemetry.
- **Open sources only.** The default stack is entirely keyless or freely-keyed. No paid feeds required to operate.
- **One operator, full control.** No shared ops layer, no SaaS sign-in, no per-seat pricing.
- **Embed-safe.** CCTV, news, and social links open without third-party frame blocks wherever the source permits.

---

## Quick Start

```bash
git clone https://github.com/YOUR_ORG/strands-osint-network.git son
cd son
npm install
cp .env.example .env          # optional keys: FRED, EIA, BLS, ACLED, FIRMS, AISSTREAM
node server.mjs
```

Dashboard opens at `http://localhost:3117`. First sweep runs on boot, subsequent sweeps every fifteen minutes (configurable in `son.config.mjs`).

---

## LM Studio Integration

S.O.N talks to any OpenAI-compatible local LLM endpoint. LM Studio is the primary target: free, cross-platform, a one-click local server, and works with most tool-capable chat templates.

### Setup

1. Install [LM Studio](https://lmstudio.ai).
2. Download a tool-capable instruct model. Good choices as of 2026:
   - **Qwen 3.5 Instruct** (8B, 14B, 32B): excellent tool-use, good reasoning, the current default.
   - **Llama 3.3 Instruct** (8B, 70B): strong general instruction-follow.
   - **Hermes 3** (3B, 8B, 70B): reliable structured output.
   - **Mistral Small Instruct** (22B): fast on 24 GB VRAM.
3. In LM Studio, open the **Local Server** tab and click **Start Server**. Default endpoint: `http://localhost:1234/v1`.
4. Load the model. S.O.N will pick up whatever is loaded regardless of the model id.

### Connection

S.O.N pings LM Studio continuously. The Consigliere pill in the top-right of the chat panel shows the real state:

- `ONLINE` (green dot): LM Studio is reachable and a model is loaded.
- `OFFLINE` (red dot): LM Studio is not responding. Start the server.
- `DISABLED` (neutral): no LLM provider configured.

Health check endpoint: `GET /api/health` returns `{ llmReachable: true | false | null }`.

### Environment

```bash
# .env
LMSTUDIO_BASE_URL=http://localhost:1234/v1    # default
LMSTUDIO_MODEL=local-model                    # whatever is loaded
```

### What the Consigliere Can Do

With tools enabled (default), the Consigliere can:

- Toggle any intelligence layer on the globe.
- Fly the camera to a named region, chokepoint, or lat/lon.
- Query any of the 29 OSINT sources directly.
- Pull market snapshots with full historical series.
- Compute upcoming satellite passes for a ground station.
- Summarise the current posture, delta, and critical signals.

Try:
```
"what's happening in Hormuz"
"show me military aircraft over the Gulf"
"is Brent about to move"
"plot upcoming ISS passes over Singapore"
```

Response grounding is enforced. If a source is offline or key-gated, the Consigliere reports that honestly instead of hallucinating data.

---

## Architecture

```
 ┌─────────────────────────────────────────────────────────────┐
 │                     NODE.JS SERVER                          │
 │  /api/health  /api/chat  /api/sweep  /api/data  /api/sse    │
 └────────────┬────────────────────────────────┬───────────────┘
              │                                │
              ▼                                ▼
 ┌──────────────────────────┐      ┌──────────────────────────┐
 │    SWEEP ORCHESTRATOR    │      │     LM STUDIO / LLM      │
 │  fullBriefing() → 29 src │◄─────│   tool-use loop          │
 │  Promise.allSettled()    │      │   openai-compat          │
 └────────────┬─────────────┘      └──────────────────────────┘
              │
              ▼
 ┌──────────────────────────┐
 │      SYNTHESIZE          │
 │  raw → stable contract   │
 │  news / social / alerts  │
 │  satellites / ships /    │
 │  flights / thermal /     │
 │  chokepoints / CCTV      │
 └────────────┬─────────────┘
              │  SSE broadcast
              ▼
 ┌──────────────────────────┐
 │      CESIUM GLOBE        │
 │  3-band accordion layout │
 │  intelligence layers     │
 │  Consigliere chat rail   │
 └──────────────────────────┘
```

Single-binary dev server. One npm dependency at runtime (`express`). Deterministic boot. Full static assets under `dashboard/public/`.

---

## Data Sources

### Keyless (always on)

| Source | What | Update |
|---|---|---|
| GDELT | Global news + geo events | 15-min |
| OpenSky | Live commercial and military aircraft | 15-min |
| CelesTrak | Satellite TLE catalog | hourly |
| NOAA CAP | Severe weather alerts | 5-min |
| USGS | Earthquakes M2.5+ (planned) | 5-min |
| Safecast | Radiation monitoring | hourly |
| Treasury | US debt, yield curve | daily |
| GSCPI | Global Supply Chain Pressure Index | monthly |
| YFinance | Live markets: BRENT, WTI, NatGas, VIX, SPX, HY | 5-min |
| USASpending | Federal contracts | daily |
| Comtrade | UN trade flows | daily |
| WHO | Disease outbreak news | daily |
| EPA | RadNet air radiation readings | hourly |
| OFAC | US sanctions list | daily |
| CCTV | Curated global webcams + YouTube live | continuous |

### Key-gated (free tier, you register)

| Source | Env var | Free tier |
|---|---|---|
| FRED (St. Louis Fed) | `FRED_API_KEY` | yes |
| EIA (energy) | `EIA_API_KEY` | yes |
| BLS (labour) | `BLS_API_KEY` | yes |
| ACLED (conflict events) | `ACLED_KEY` | yes (register for academic) |
| NASA FIRMS (thermal) | `FIRMS_MAP_KEY` | yes |
| AISStream (live vessels) | `AISSTREAM_API_KEY` | yes |
| OpenSanctions | `OPENSANCTIONS_API_KEY` | yes (data.opensanctions.org) |
| Reddit | `REDDIT_CLIENT_ID/SECRET` | OAuth, free |
| ReliefWeb v2 | `RELIEFWEB_APPNAME` (approved) | free, registration required |

### Optional adapters

- **Bluesky** — public AT Proto search.
- **Telegram public channels** — optional, either bot mode or scrape.
- **KiwiSDR** — shortwave intelligence receivers.
- **Patents** — USPTO public endpoints.

See [`apis/sources/`](apis/sources) for each adapter and [`SOURCE_QA_MATRIX`](docs/SOURCE_QA.md) for live status.

---

## Intelligence Layers

Toggleable on the globe, colour-coded by posture:

**Kinetic (seal red #D4593C)** active or threat-relevant
- `MIL` Military flights
- `HOT` Thermal anomalies (wildfires, industrial fires, conflict burns)
- `WAR` Conflict events
- `GPS` GPS jamming zones
- `NET` Internet blackouts

**Passive (action teal #64F0C8)** sensing or observation
- `SAT` Satellite passes
- `AIR` Commercial flights
- `SEA` Maritime AIS
- `RSS` News events
- `SOC` Social signals (Bluesky, X)
- `ASP` Airspace closures (NOTAM)
- `CHK` Chokepoint markers (9 canonical straits and canals)
- `CAM` Public CCTV and webcams

---

## Pull Live, Pull Region

Two buttons, one chokepoint-sensitive globe.

- **PULL LIVE** forces an immediate global sweep outside the fifteen-minute interval.
- **PULL REGION** reads the current camera viewport as a bbox and passes it to the sweep as metadata. Sources that support geo-filtered queries (GDELT, social, AIS) use it to narrow their pull.

Both flash a status pill when in flight and broadcast `sweep_trigger` on SSE so the UI can label results as global or region-scoped.

---

## HTTP API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Status, uptime, source count, LLM reachability |
| `GET` | `/api/data` | Current synthesised dashboard payload |
| `GET` | `/api/sse` | Server-sent event stream: `update`, `sweep_trigger`, `sweep_complete`, `sweep_error` |
| `POST` | `/api/sweep` | Manual sweep trigger, optional `?bbox=W,S,E,N` |
| `POST` | `/api/chat` | Consigliere tool-use loop, OpenAI-compatible |

---

## Configuration

`son.config.mjs` holds all runtime configuration. Environment overrides via `.env`.

```js
{
  port: 3117,
  refreshIntervalMinutes: 15,
  llm: {
    provider: 'lmstudio',   // 'lmstudio' | 'openrouter' | null
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN,
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
  },
  delta: {
    thresholds: { /* per-layer change sensitivity */ },
  },
}
```

---

## Docker

```bash
docker build -t son .
docker run -p 3117:3117 --env-file .env son
```

Health check wired to `/api/health`. Mount a volume at `/app/runs` to persist sweep history between container restarts.

---

## Future: Social Layers and the Interconnected Globe

The god's-eye becomes a *shared* eye.

S.O.N's next horizon is a social layer on top of the intelligence terminal: a real-time population overlay of opted-in humans anchored to their actual position on the globe. Built on top of [Strands Nation](https://strandsnation.xyz) identities, gated via Founders Pass, with user-controlled privacy tiers (anonymous glyph only, country flag, city centroid, full everywear.id deep-link). No ads, no tracking beyond the user's explicit opt-in.

The vision is a globally interconnected community of OSINT operators, researchers, journalists, and curious citizens who share the view. A collective intelligence layer on top of the objective data layer. One planet, many eyes, watching together.

Phased rollout:
1. **S.O.N local** (present) — single operator, own machine, full stack.
2. **Layer U** (next) — public demo at `layeru.xyz`, news + StrandsNation overlay, Cloudflare / Vercel / R2.
3. **Collective intelligence mode** (future) — shared annotations, collaborative event timelines, peer-to-peer tip network for OSINT operators.

The architecture is already split along these lines. See [`LAYER_U_ARCHITECTURE.md`](./LAYER_U_ARCHITECTURE_2026-04-22.md) for the deploy plan.

---

## Credits and Inspiration

- **4 Gods Eye framework** — [Bilawal Sidhu](https://bilawalsidhu.com), spatial computing and AR/XR thought leader. The conceptual anchor for S.O.N's entire interface. The idea that the fourth camera (the god's-eye, allocentric view) is a first-class operator perspective, not a novelty, shaped every design decision below.
- **Crucix** — the earlier local-Palantir prototype that proved the twenty-nine-source parallel sweep pattern was feasible on a single machine. S.O.N inherits that pattern, rebuilt around the Cesium globe, a stable public client contract, and the LM Studio Consigliere. Crucix was the sketch; S.O.N is the painting.
- **Cesium** — the open-source 3D globe engine powering the terminal.
- **LM Studio** — the local inference runtime that makes the Consigliere possible.
- **All 29 OSINT source providers** — GDELT, OpenSky, NASA FIRMS, CelesTrak, NOAA, USGS, FRED, EIA, BLS, ACLED, ReliefWeb, WHO, Safecast, EPA, Bluesky, Reddit, Treasury, USASpending, Comtrade, GSCPI, YFinance, OpenSanctions, OFAC, and the rest. Thank you for keeping the data open.

---

## Licence

AGPL v3. See [LICENSE](./LICENSE).

---

## Part of the Strands Ecosystem

S.O.N is one wing of a broader ecosystem:

- **[Strands Nation](https://strandsnation.xyz)** — the parent game and community. 6,000 Founders Pass holders, Three.js desktop OS, Telegram Mini App.
- **[S³ Sound Studio](https://s3studio.xyz)** — local music generation via ACE-Step + BASIC STEP STUDIO.
- **[Everywear](https://everywear.id)** — the browser OS and decentralised identity layer.
- **[Metafintek](https://metafintek.xyz)** — the primary operating entity (Lombok, Indonesia).

All built by the same small team. All local-first where possible. All open.
