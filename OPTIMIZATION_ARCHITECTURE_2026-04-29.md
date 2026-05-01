# S.O.N Optimization Architecture — 2026-04-29

## 1. Purpose

This document captures:

- what the project was trying to become
- what the current codebase actually delivers
- why the reported failures are happening
- the architecture required to make S.O.N feel operator-grade rather than prototype-grade

This is based on the current repo state on 2026-04-29, including:

- [README.md](./README.md)
- [LAYER_U_ARCHITECTURE_2026-04-22.md](./LAYER_U_ARCHITECTURE_2026-04-22.md)
- [LAYER_AUDIT_2026-04-24.md](./LAYER_AUDIT_2026-04-24.md)
- [CCTV_LIBRARY_VERIFIED_2026-04-23.md](./CCTV_LIBRARY_VERIFIED_2026-04-23.md)
- [NEWS_LIVE_REGISTRY_2026-04-23.md](./NEWS_LIVE_REGISTRY_2026-04-23.md)

## 2. Intended Outcome

The repo is clearly aiming at a local-first OSINT command surface:

- 29-source sweep orchestration
- single-globe god's-eye interface
- CCTV and live news playback from geo-anchored points
- real-time maritime awareness from AISStream
- clickable geo-tagged news and social intelligence
- a premium visual experience on desktop hardware

The design ambition is strong and coherent. The problem is not lack of vision. The problem is that the current architecture still mixes:

- batch sweep logic
- live stream logic
- media playback logic
- link-resolution logic
- globe rendering logic

inside a single thin server and a single large browser file.

That makes the system fragile, hard to reason about, and unable to express "live" behavior honestly.

## 3. Current Repo State

### 3.1 What has been attempted successfully

The codebase already has:

- a functioning multi-source orchestrator in [apis/briefing.mjs](./apis/briefing.mjs)
- a dashboard contract synthesis layer in [dashboard/inject.mjs](./dashboard/inject.mjs)
- a Cesium-based worldview client in [dashboard/public/worldview/app.js](./dashboard/public/worldview/app.js)
- SSE updates from [server.mjs](./server.mjs)
- a live AIS websocket listener in [apis/live/aisstream.mjs](./apis/live/aisstream.mjs)
- a separate verified CCTV/feed registry written in Markdown, showing the team already discovered many of the current runtime problems

### 3.2 What the current runtime is actually doing

The current latest run shows:

- Maritime is not rendering true live AIS yet; the latest sweep reports `"synthetic": true` while live status is still `"connecting"` in [runs/latest.json](./runs/latest.json)
- NewsLive is disabled because `YOUTUBE_API_KEY` is not present; the latest sweep reports `"status": "no_key"` and `"streams": []` in [runs/latest.json](./runs/latest.json)
- CCTV source data still comes from the small legacy in-code list, not the larger verified 2026-04-23 library

This means the current user experience is a mix of:

- real data
- stale curated embeds
- synthetic vessel fallback
- empty live-news overlays

That mismatch is the main reason the product feels inconsistent.

## 4. Root Cause Analysis By Reported Failure

## 4.1 CCTV footage not displayed

This is not one bug. It is three different failures.

### A. The runtime CCTV adapter has drifted away from the verified library

The verified document lists 33 audited streams in [CCTV_LIBRARY_VERIFIED_2026-04-23.md](./CCTV_LIBRARY_VERIFIED_2026-04-23.md), but the actual runtime adapter in [apis/sources/cctv.mjs](./apis/sources/cctv.mjs) still serves a tiny legacy list and includes a stale Shibuya URL:

- `apis/sources/cctv.mjs:23` defines the small hardcoded camera array
- `apis/sources/cctv.mjs:100` still uses `gJuZZCOGTLA`, which the verified CCTV doc explicitly says is stale

Architectural conclusion:

- the repo has a "source of truth" problem
- the audited media registry is not the runtime registry

### B. CCTV inspector opening from the feed panel is broken by metadata overwrite order

When CCTV entities are created on the globe, their metadata is correct:

- `app.js:490` uses `meta: { ...c, streamKind: c.kind, kind: 'cctv' }`

But when CCTV cards are opened from the feed panel, the merge order is reversed:

- `app.js:1466` uses `showInspector({ meta: { kind: 'cctv', ...cam } })`

Because `...cam` runs last, `cam.kind` overwrites `'cctv'` with `'youtube'`, `'iframe'`, etc. The inspector then misses the CCTV media branch:

- `app.js:910` only renders inline stream media when `kind === 'cctv'`

This is a direct UI bug and explains why "camera exists but footage does not show" can happen from one interaction path and not another.

### C. The playback model is incomplete

The CCTV adapter contract supports:

- YouTube
- iframe
- HLS
- MJPEG

That is documented directly in [apis/sources/cctv.mjs](./apis/sources/cctv.mjs), but the client currently ships no HLS playback library:

- `worldview.html:8-11` loads Cesium and satellite.js only

And the inspector only handles inline playback for:

- YouTube / iframe
- MJPEG / image

Everything else falls back to an external link:

- `app.js:912-919`

Architectural conclusion:

- S.O.N does not yet have a real media subsystem
- it has ad hoc embedding rules

## 4.2 YouTube footage not displayed

There are two separate YouTube stories in this repo.

### A. Static CCTV YouTube embeds

These are hardcoded in [apis/sources/cctv.mjs](./apis/sources/cctv.mjs). Some may work, some may have rotated, and at least one is already known stale.

### B. Dynamic live-news YouTube streams

These depend on `YOUTUBE_API_KEY`:

- `news_live.mjs:121-129` returns `status: 'no_key'` and `streams: []` when the key is absent
- `runs/latest.json:3873-3879` confirms this is exactly the current runtime state

That means live news TV on the globe is not failing mysteriously. It is not available because the resolver is disabled.

Architectural conclusion:

- the UI does not distinguish clearly enough between "source unavailable by design" and "source broken"
- operator-facing feature health is under-communicated

## 4.3 AIS data not real-time updated

This is the clearest architectural issue in the project.

### A. AIS collection is live, but AIS delivery is not

The repo does have a persistent websocket listener:

- [apis/live/aisstream.mjs](./apis/live/aisstream.mjs)

But the browser is not subscribed to AIS deltas. Instead:

- the AIS listener fills an in-memory vessel buffer
- [apis/sources/ships.mjs](./apis/sources/ships.mjs) reads that buffer during a briefing call
- [server.mjs](./server.mjs) broadcasts browser updates only during sweep completion

Relevant files:

- `ships.mjs` reads `getLiveVessels()` during briefing
- `server.mjs:466-538` updates `currentData` inside `runSweepCycle()`
- `server.mjs:533` broadcasts `{ type: 'update', data: currentData }`
- `app.js:1519-1538` only reacts to those sweep-bound events

So even if AISStream is receiving new vessel positions between sweeps, the UI does not get them in real time.

### B. The status model is misleading

The latest raw run shows:

- `runs/latest.json:240` status `"connecting"`
- `runs/latest.json:241` synthetic `true`
- `runs/latest.json:247` live buffer count `0`

But the message still says:

- `runs/latest.json:249` `"AIS stream: connecting, 86 vessels buffered"`

Those 86 are synthetic fallback samples, not live buffered vessels.

Architectural conclusion:

- the system currently conflates "display fallback" with "transport truth"
- that makes operational debugging harder and erodes trust

### C. The shipping model is sweep-shaped, not stream-shaped

The current maritime layer is designed as:

- one live listener
- one batch synthesizer
- one periodic dashboard snapshot

Real-time maritime UX needs:

- event-driven delta updates
- snapshot + patch transport
- freshness metadata per vessel
- explicit live vs synthetic labeling

## 4.4 News RSS feeds often unclickable

This also appears to be structural rather than purely CSS.

### A. URL extraction is too narrow

The RSS parser in [dashboard/inject.mjs](./dashboard/inject.mjs) only extracts links from:

- `<link>...</link>`

Specifically:

- `inject.mjs:126-128`

Many modern feeds use:

- Atom `<link href="..."/>`
- GUID permalink patterns
- source-specific redirect structures

When extraction fails, the item is still rendered, but without a valid URL:

- `inject.mjs:133` pushes `url: link || undefined`

That explains "often unclickable" much better than a browser-level click problem.

### B. Inline preview is trying to iframe pages that are expected to reject framing

The inspector intentionally attempts inline previews:

- `app.js:939-954`

But most major news sites block framing. This is not the bug; this is normal. The real product issue is that the system does not separate:

- link openability
- inline embeddability

Those are different properties and should be tracked separately.

Architectural conclusion:

- news items need canonical link metadata
- embeddability must be a validated capability, not guessed at click time

## 4.5 Globe quality looks poor despite RTX 5090 / WebGL

The current globe stack is intentionally conservative.

### A. The client is running in "safe dev mode"

The world is explicitly configured to avoid Cesium Ion dependencies:

- `app.js:16-34` uses `EllipsoidTerrainProvider`

That means:

- no real terrain
- no terrain occlusion fidelity beyond flat globe behavior
- reduced sense of depth and realism

### B. No explicit high-end GPU quality profile exists

The code does not currently define a render-quality tier for powerful hardware. There is no visible configuration for:

- device-pixel-ratio-aware resolution scaling
- MSAA tuning
- FXAA/HDR policy
- texture memory / entity density budgets
- label decluttering or clustering

The result is a globe that is functional but not premium.

### C. The layout is physically squeezing the globe

The worldview layout allocates:

- `26vh` to the top band
- `26vh` to the bottom band

in [dashboard/public/worldview.html](./dashboard/public/worldview.html):

- `worldview.html:72-90`

That leaves the actual globe visually pinched in the middle band. Even with good imagery, the operator perceives a smaller, flatter, less immersive globe.

### D. Source quality and render quality are not separated

The same file currently decides:

- Cesium viewer setup
- basemap choice
- overlay rendering
- UI chrome
- inspector media
- feed panel logic

inside one large client script.

Architectural conclusion:

- there is no render pipeline abstraction
- therefore no place to implement quality profiles cleanly

## 5. Architectural Diagnosis

The main architectural anti-pattern is this:

- S.O.N has one batch-oriented data plane trying to impersonate several live systems

Specifically:

- CCTV is treated as static metadata, but media playback needs validation and transport rules
- News is treated as text plus a URL string, but news UX needs link capability metadata
- AIS is treated as just another sweep source, but it is actually a streaming source
- Globe quality is treated as a one-time Cesium bootstrap decision, but it should be a hardware-aware render profile

## 6. Target Architecture

## 6.1 Split the system into four planes

### A. Source Plane

Responsibility:

- fetch raw external data
- keep source-specific auth, retries, and quotas isolated

Modules:

- `sources/batch/*` for sweep-fed sources
- `sources/live/*` for streaming sources
- `sources/media/*` for camera/news-live registry resolution

### B. Normalization Plane

Responsibility:

- convert raw source payloads into canonical domain contracts

Canonical contracts should include at minimum:

- `entities`
- `streams`
- `links`
- `freshness`
- `health`
- `provenance`

Example:

```js
{
  id: 'news-live-cna',
  type: 'stream',
  mediaType: 'youtube',
  playback: {
    url: 'https://www.youtube.com/embed/...',
    embeddable: true,
    inlineSupported: true
  },
  freshness: {
    observedAt: '2026-04-29T02:34:13Z',
    staleAfterMs: 3600000
  },
  health: {
    status: 'ok'
  }
}
```

### C. Transport Plane

Responsibility:

- deliver both snapshots and live deltas to the client

Needed channels:

- `world_state.snapshot`
- `world_state.patch`
- `ais.delta`
- `source.health`
- `media.health`

SSE can work for now, but the architecture should stop pretending that a 15-minute synthesized snapshot is "live."

### D. Render Plane

Responsibility:

- translate canonical entities into Cesium primitives
- manage quality profiles independently from source logic
- manage inspector playback independently from entity rendering

This should be split into:

- globe bootstrap
- layer renderers
- media inspector
- feed views
- quality manager

## 6.2 Treat media as a first-class subsystem

S.O.N now needs a `Media Registry` rather than a camera array.

Each camera/news-live item should carry:

- `kind`: youtube | iframe | hls | mjpeg | link
- `verifiedAt`
- `embeddable`
- `inlineSupported`
- `fallbackUrl`
- `health`
- `region`
- `criticality`

This would unify:

- CCTV cameras
- live TV channels
- static external watch links

and let the UI decide playback honestly.

## 6.3 Treat AIS as a streaming subsystem, not a sweep source

Recommended model:

1. AIS listener maintains authoritative in-memory vessel state.
2. Server publishes vessel deltas every 2-5 seconds.
3. Sweep synthesis consumes AIS only for summary panels and persistence.
4. Globe maritime layer reads from a live vessel store, not from sweep snapshots.

Required metadata per vessel:

- `updatedAt`
- `source`: live | synthetic
- `stale`: boolean
- `ageMs`

## 6.4 Add a real render-quality manager

Introduce a client-side quality profile:

- `ultra`
- `high`
- `balanced`
- `safe`

Profile inputs:

- GPU capability
- device pixel ratio
- available terrain token
- current entity count
- current mode: live globe vs cinematic brief

For a 5090-class desktop, `ultra` should enable:

- terrain when token available
- higher resolution scale
- explicit anti-aliasing policy
- more aggressive texture quality
- denser labels at closer ranges only
- clustering for noisy layers

## 7. Recommended Phase Plan

## Phase 0 — Immediate Wins

Goal: fix the worst user-visible failures without major refactor.

1. Replace the runtime CCTV registry with the audited library from [CCTV_LIBRARY_VERIFIED_2026-04-23.md](./CCTV_LIBRARY_VERIFIED_2026-04-23.md).
2. Fix feed-panel CCTV inspector metadata merge order in `app.js:1466`.
3. Add honest operator badges:
   - `NewsLive: no API key`
   - `AIS: synthetic fallback`
   - `CCTV: stale stream`
4. Extend RSS link parsing to support Atom `href` and GUID permalink fallback.
5. Correct maritime status text so synthetic samples are never described as buffered live vessels.

Expected result:

- CCTV becomes visibly less broken
- live news failure becomes explicit instead of mysterious
- RSS clickability improves materially
- AIS trust improves even before real-time delivery is fixed

## Phase 1 — Contract Cleanup

Goal: create stable domain contracts.

Introduce normalized contracts for:

- `mediaStreams`
- `newsLinks`
- `vessels`
- `sourceHealth`

Do not let the UI infer business meaning from raw adapter payloads.

Expected result:

- fewer shape bugs
- easier feature work
- easier testing

## Phase 2 — Real-Time Transport

Goal: make AIS truly live.

1. Keep sweep snapshots for summary data.
2. Add AIS delta broadcast every few seconds.
3. Maintain a client-side vessel store with TTL aging.
4. Render stale vessels differently from fresh vessels.

Expected result:

- maritime layer finally behaves like a stream
- real-time perception matches underlying transport reality

## Phase 3 — Media Subsystem

Goal: unify CCTV and live-news playback.

1. Create a runtime media registry file or service.
2. Add playback strategy by kind:
   - YouTube iframe
   - HLS.js player
   - MJPEG image refresh
   - iframe
   - external link fallback
3. Add daily verification status and disabled-state handling.

Expected result:

- media failures become manageable
- inline playback stops being random

## Phase 4 — Globe Quality Upgrade

Goal: make the worldview worthy of high-end hardware.

1. Add quality profiles.
2. Decouple globe area from fixed 26vh top/bottom bands.
3. Add terrain support when token exists.
4. Add render-budget rules for markers, labels, and clustering.
5. Add a "cinematic mode" and an "operator mode."

Expected result:

- much stronger perceived fidelity
- less visual clutter
- better use of a 5090-class machine

## Phase 5 — Observability

Goal: make failures debuggable from the UI.

Add a source/media health panel showing:

- last success time
- freshness age
- degraded mode
- auth status
- live vs synthetic state

Expected result:

- operator understands why something is missing
- less time wasted guessing whether the issue is UI, source, or credential

## 8. Recommended File/Module Refactor

Suggested target structure:

```text
apis/
  batch/
    news.mjs
    markets.mjs
    climate.mjs
  live/
    aisstream.mjs
    newslive.mjs
  media/
    registry.mjs
    verifier.mjs
  normalize/
    media.mjs
    vessels.mjs
    news.mjs
  transport/
    sse.mjs
    patches.mjs

dashboard/public/worldview/
  boot.js
  quality.js
  state.js
  render/
    ships.js
    news.js
    cctv.js
    flights.js
  ui/
    inspector.js
    feeds.js
    health.js
```

This is less about folder beauty and more about isolating failure domains.

## 9. Success Metrics

The architecture should be considered successful when:

1. CCTV cards either play inline or clearly state why they cannot.
2. Live-news TV markers appear when keys are configured and disappear with explicit health messaging when not.
3. AIS vessel positions visibly change without waiting for the next sweep.
4. RSS items are clickable whenever a canonical URL exists.
5. Globe quality has a visible step-up on high-end hardware.
6. Operators can tell the difference between:
   - broken
   - stale
   - key missing
   - source offline
   - synthetic fallback

## 10. Priority Recommendation

If only three things are funded next, they should be:

1. Fix the media registry and CCTV inspector path.
2. Decouple AIS from the sweep cycle and ship live vessel deltas.
3. Add a render-quality manager plus a less pinched globe layout.

Those three changes would improve trust, liveness, and perceived quality at the same time.

## 11. Bottom Line

S.O.N is not failing because the concept is weak. It is failing because a serious real-time geospatial product is still being expressed through prototype-era coupling.

The next step is not "more sources." The next step is:

- canonical contracts
- honest health states
- a real media subsystem
- stream-shaped transport for stream-shaped data
- a hardware-aware render pipeline

Once those are in place, the existing vision in [README.md](./README.md) becomes much more achievable.
