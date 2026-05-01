<div align="center">

# S.O.N

**Strands OSINT Network**

*An operator-grade god's-eye terminal for open-source intelligence. Twenty-nine feeds, one globe, your machine.*

[![Node.js 22+](https://img.shields.io/badge/node-22%2B-brightgreen)](#quick-start)
[![License: PolyForm-NC](https://img.shields.io/badge/license-PolyForm--NC--1.0.0-orange.svg)](LICENSE)
[![OSINT sources](https://img.shields.io/badge/OSINT%20sources-29-cyan)](#data-sources)
[![LM Studio](https://img.shields.io/badge/LLM-LM%20Studio%20local-purple)](#lm-studio-integration)
[![3D Tiles](https://img.shields.io/badge/globe-Google%203D%20Tiles-blue)](#globe-rendering)
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
- **Open sources where possible.** Most adapters are keyless or freely-keyed. A few optional layers (Google 3D Tiles, ADS-B Exchange, traffic) use free tiers from commercial APIs; the system degrades gracefully without them.
- **One operator, full control.** No shared ops layer, no SaaS sign-in, no per-seat pricing.
- **Embed-safe.** CCTV, news, and social links open without third-party frame blocks wherever the source permits.

---

## Recent Updates

**2026-05-01 sprint** — visual upgrade plus layer fixes plus architecture scaffolding:

- **Globe upgrade.** Optional Google Photorealistic 3D Tiles with graceful fallback to ESRI imagery on a flat ellipsoid when no key is set. Buildings render as actual 3D geometry where Google has coverage.
- **Shader presets.** Number keys cycle four post-process modes: `1` NVG (night vision green), `2` FLIR (thermal LUT), `3` CRT (scanlines + chromatic aberration + optional pixelation), `4` OPS (Strands tactical, Hanko-red criticality), `0` clean. CRT pixelation level is `+`/`-` cycled while CRT is active.
- **AIR layer fix.** OpenSky raw state vectors preserved through the sweep. Up to 600 commercial flights now render globally, click-to-track, no key required.
- **SAT layer fix.** TLE pairs preserved from CelesTrak. ISS, space stations, and recent launches render with animated propagated orbits.
- **Plane icons.** Civilian and military aircraft now render as oriented SVG silhouettes rotated by their heading, not flat dots.
- **Auto-collapse plus hover-expand.** Sidebars and bands fold after 10s of no interaction, restore on hover. Manual chevron clicks lock state.
- **Honest sweep telemetry.** Per-source verbose logging during sweep with four health states: ok / key-gated / degraded / failed. Replaces the misleading "29/29 sources returned data" line.
- **CCTV inspector merge fix.** Cards opened from the feed panel route through the inline media branch correctly.
- **RSS Atom plus GUID parser.** Reuters, Bloomberg, and Atom-based publishers now produce clickable cards.
- **LM Studio bug fix.** Duplicate `ping()` method removed; OFFLINE state reports correctly.
- **FRED + EIA discontinued** — both providers no longer offer free API keys; adapters disabled in the briefing.

See [`STATUS_2026-04-30_NIGHT.md`](./STATUS_2026-04-30_NIGHT.md) for the full sprint report and [`RECON_SPRINT_ARCHITECTURE_2026-04-30.md`](./RECON_SPRINT_ARCHITECTURE_2026-04-30.md) for what is coming next.

---

## Quick Start

```bash
git clone https://github.com/BAIS1C/strands-osint-network.git son
cd son
npm install
cp .env.example .env          # add the keys you want; system runs fine without them
node server.mjs
```

Dashboard opens at `http://localhost:3117`. First sweep runs on boot, subsequent sweeps every fifteen minutes (configurable in `son.config.mjs`).

Optional API keys (all degrade gracefully if absent):

| Key | What it unlocks | Free tier |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Google Photorealistic 3D Tiles globe | yes (Map Tiles API on console.cloud.google.com) |
| `ADSB_API_KEY` | MIL layer (military aircraft) | yes (rapidapi.com/adsbx/api/adsbexchange-com1) |
| `AISSTREAM_API_KEY` | SEA layer real-time vessels | yes (aisstream.io) |
| `FIRMS_MAP_KEY` | HOT layer (NASA thermal anomalies) | yes (firms.modaps.eosdis.nasa.gov) |
| `ACLED_EMAIL`+`ACLED_PASSWORD` | WAR layer (conflict events) | yes (acleddata.com, academic registration) |
| `BLS_API_KEY` | Macro-economic series | yes (bls.gov) |
| `RELIEFWEB_APPNAME` | ReliefWeb humanitarian reports | yes (registration required) |
| `OPENSANCTIONS_API_KEY` | OpenSanctions | yes (data.opensanctions.org) |
| `REDDIT_CLIENT_ID`+`SECRET` | Reddit OSINT | yes (OAuth, free) |
| `YOUTUBE_API_KEY` | Live news TV streams (Al Jazeera, CNBC, etc) | yes (10k units/day) |
| `EVENTBRITE_TOKEN` | Event tracker (festivals, concerts) | yes |
| `SONGKICK_API_KEY` | Concert listings | yes |
| `HERE_API_KEY` | Live road traffic (RECON corridor) | yes (250k tx/month) |
| `TELEGRAM_BOT_TOKEN`+`CHAT_ID` | Telegram alerts plus bot commands | n/a |
| `DISCORD_BOT_TOKEN`+`CHANNEL_ID` | Discord alerts plus slash commands | n/a |

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

| Source | Env var | Free tier | Notes |
|---|---|---|---|
| BLS (labour) | `BLS_API_KEY` | yes | macro time series |
| ACLED (conflict events) | `ACLED_EMAIL`+`ACLED_PASSWORD` | yes (academic) | OAuth2 password grant |
| NASA FIRMS (thermal) | `FIRMS_MAP_KEY` | yes | global fire detection |
| AISStream (live vessels) | `AISSTREAM_API_KEY` | yes | persistent WebSocket |
| OpenSanctions | `OPENSANCTIONS_API_KEY` | yes | data.opensanctions.org |
| Reddit | `REDDIT_CLIENT_ID/SECRET` | OAuth, free | |
| ReliefWeb v2 | `RELIEFWEB_APPNAME` (approved) | free | registration required |
| YouTube Live News | `YOUTUBE_API_KEY` | yes | 10k units/day |
| ADS-B Exchange | `ADSB_API_KEY` | yes (RapidAPI) | military aircraft |
| Eventbrite | `EVENTBRITE_TOKEN` | yes | festivals, gigs |
| Songkick | `SONGKICK_API_KEY` | yes | concert listings |

### Discontinued

| Source | Reason | Replacement |
|---|---|---|
| FRED (St. Louis Fed) | Free API access discontinued by provider 2026-04 | Treasury adapter still covers debt/yield curve |
| EIA (energy data) | Free API access discontinued by provider 2026-04 | YFinance now provides live BRENT/WTI/NatGas via market quotes |

### Optional adapters

- **Bluesky** — public AT Protocol search (currently degraded; authenticated adapter scaffolded in `apis/sources/bluesky_auth.mjs`).
- **Telegram public channels** — optional, either bot mode or scrape.
- **KiwiSDR** — shortwave intelligence receivers.
- **Patents** — USPTO public endpoints.
- **X (Twitter)** — Playwright-based authenticated burner adapter scaffolded in `apis/sources/x_browser.mjs`. See [`X_BROWSER_ARCHITECTURE_2026-05-01.md`](./X_BROWSER_ARCHITECTURE_2026-05-01.md) for activation.

See [`apis/sources/`](apis/sources) for each adapter and [`LAYER_AUDIT_2026-04-24.md`](./LAYER_AUDIT_2026-04-24.md) for the per-layer status matrix.

---

## Globe Rendering

S.O.N renders on Cesium 1.124. Two basemap modes:

- **Photorealistic 3D Tiles** — when `GOOGLE_MAPS_API_KEY` is set in `.env`, the globe loads Google's Map Tiles API and you get real building geometry, terrain, and texture at city zoom. Free tier on Google Cloud Console covers personal beta. Falls back gracefully if the key is absent or the request fails.
- **Flat ellipsoid + ESRI imagery** — the default when no Google key is set. ESRI World Imagery, CARTO Voyager (English-labelled OSM), or CARTO Dark.

The globe morphs between 3D Globe, 2D Flat, and Columbus View modes. When 3D Tiles are loaded, switching to 2D or CV automatically hides the tileset and re-shows the basemap to avoid mesh-projection ghosting.

### Shader presets

Four post-process stages cycle on number keys when the map has focus:

| Key | Mode | Effect |
|---|---|---|
| `0` | Clean | default |
| `1` | NVG | green phosphor tint, gain noise, vignette |
| `2` | FLIR | thermal LUT (cool blue → red → white-hot), edge enhancement |
| `3` | CRT | scanlines, chromatic aberration, vignette, optional pixelation |
| `4` | OPS | Strands tactical: desaturated, contrast-lifted, Hanko-red criticality bias |

While CRT is active, `+` and `-` cycle pixelation level 0 to 8 for authentic CCTV look.

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
| `GET` | `/api/config` | Public client config — Google Maps key for 3D Tiles, Cesium Ion token, key-presence flags |
| `GET` | `/api/data` | Current synthesised dashboard payload |
| `GET` | `/events` | Server-sent event stream: `update`, `sweep_trigger`, `sweep_complete`, `sweep_error` |
| `POST` | `/api/sweep` | Manual sweep trigger, optional `?bbox=W,S,E,N` |
| `POST` | `/api/chat` | Consigliere tool-use loop, OpenAI-compatible |
| `GET` | `/api/ais/status` | Live AIS WebSocket connection status |
| `GET` | `/api/proxy/gpsjam` | GPSJam daily H3-tiled jamming zones (proxied) |

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

**PolyForm Noncommercial License 1.0.0.** See [LICENSE](./LICENSE).

You may download, run, modify, and redistribute S.O.N for **non-commercial purposes only**: personal use, hobby projects, research, teaching, evaluation, and personal demonstrations. Internal business use by a company or for-profit organization is **not** permitted under this license, regardless of whether you charge money or not.

For commercial use (including any internal business deployment), contact the licensor at `kasai@strandsnation.xyz` for a separate commercial license. Commercial licenses are negotiated case-by-case.

This is a deliberate departure from the previous AGPL v3 licensing. The intent is to keep S.O.N freely available for individual operators, researchers, and Strands Nation Founders Pass holders, while preventing third parties from building competing OSINT-as-a-service products on top of the codebase without contributing back.

---

## Part of the Strands Ecosystem

S.O.N is one wing of a broader ecosystem:

- **[Strands Nation](https://strandsnation.xyz)** — the parent game and community. 6,000 Founders Pass holders, Three.js desktop OS, Telegram Mini App.
- **[S³ Sound Studio](https://s3studio.xyz)** — local music generation via ACE-Step + BASIC STEP STUDIO.
- **[Everywear](https://everywear.id)** — the browser OS and decentralised identity layer.
- **[Metafintek](https://metafintek.xyz)** — the primary operating entity (Lombok, Indonesia).

All built by the same small team. All local-first where possible. All open.
