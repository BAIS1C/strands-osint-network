# RECON SPRINT ARCHITECTURE
**Timestamp:** 2026-04-30 SGT, Lombok
**Author:** Kasai (in-session architectural capture for Sean Uddin / Somo Kasane)
**Status:** Locked. Day 1 begins with Google 3D Tiles swap on confirmation.
**Goal:** Ship S.O.N visual parity with Bilawal Sidhu's WorldView, fix broken layers, deliver RECON v0 (journey planner) before Sean's Bali trip departure.
**Scope:** Three working days, personal beta. Layer U public services bolt on later.

---

## 1. Driving Use Case

Lombok to Bali via Lembar-Padangbai ferry, multi-stop overland, multi-night. Specific deliverables this trip needs: route plot from Mataram or Senggigi down to Lembar, ferry leg across Lombok Strait, road segment from Padangbai through Candidasa, Ubud, Canggu, with a probable Nusa Penida side trip. Junction screenshots at each stop captured to disk with metadata. Accommodation candidates flagged within N km of each junction. CCTV cameras pulled where available. Real-time traffic on the road segments where data exists. Ferry timing surfaced in the panel. Saved itinerary loadable on return for review or sharing.

Future: each junction is a clickable booking primitive once Strands chain lands.

---

## 2. Visual Upgrade Tier

### 2.1 Google Photorealistic 3D Tiles

Replaces `EllipsoidTerrainProvider` in `dashboard/public/worldview/app.js:16-34`.

```js
const tileset = await Cesium.createGooglePhotorealistic3DTilesAsync({
  apiKey: window.SON_CONFIG.googleMapsApiKey,
});
viewer.scene.primitives.add(tileset);
```

Free-tier API key from Google Cloud Console, Map Tiles API enabled. Add `GOOGLE_MAPS_API_KEY` to `.env.example` and surface to client via `son.config.mjs` exposed config endpoint. Falls back to ellipsoid if key absent (honest badge: `3D Tiles: no key`).

### 2.2 Shader Post-Processing

CesiumJS `PostProcessStageCollection` API. Four presets, cycled by number key.

```
Key 0: clean (default)
Key 1: NVG (green tint, gain noise, bloom on highlights)
Key 2: FLIR (thermal LUT, edge-enhanced, contrast lifted)
Key 3: CRT (scanlines, chromatic aberration, vignette, pixelation toggle)
Key 4: OPS (Strands-canon tactical: Hanko red criticality, white-on-black labels)
```

Each preset is a custom GLSL fragment shader registered as a `PostProcessStage`. Roughly 80 lines of shader plus 30 lines of wiring per preset. New file: `dashboard/public/worldview/shaders/presets.js`. Toggle binding in `app.js` keyboard handler. CRT gets a sub-toggle for pixelation level (0 to 8) for authentic CCTV look.

### 2.3 Layout Decompression

`dashboard/public/worldview.html:72-90`. Drop top and bottom band heights from `26vh` to `18vh`, or replace with collapsible chevrons that animate to `0` when stowed. Globe gets `64vh` to `100vh` of vertical space.

---

## 3. Layer Fix Tier

Per `LAYER_AUDIT_2026-04-24.md`. Each fix is small and surgical.

### 3.1 AIR (Commercial Flights)

Two-step fix.

In `apis/sources/opensky.mjs::briefing()`, before aggregation, preserve raw state vectors:

```js
const rawStates = (data.states || []).slice(0, 500).map(s => ({
  icao24: s[0], callsign: s[1]?.trim(), country: s[2],
  lon: s[5], lat: s[6], alt: s[7], onGround: s[8],
  velocity: s[9], heading: s[10], verticalRate: s[11]
}));
return { ...existingShape, states: rawStates };
```

In `dashboard/inject.mjs::synthesize()`:

```js
V2.opensky = { states: data.sources.OpenSky?.states || [] };
```

Renders 6,000+ live planes globally, no key required, click-to-track per Bilawal demo.

### 3.2 MIL (Military Flights)

One-line patch in `synthesize()`:

```js
V2.adsb = { militaryAircraft: data.sources['ADS-B']?.militaryAircraft || [] };
```

Register `ADSB_API_KEY` (RapidAPI ADS-B Exchange free tier or paid). Without key, layer renders empty. With key, military aircraft visible globally.

### 3.3 SAT (Satellite Passes)

Patch `apis/sources/space.mjs`. In `getRecentLaunches()` and `getStationData()` mappers, add `tle1: sat.TLE_LINE1, tle2: sat.TLE_LINE2`. In `synthesize()`:

```js
V2.space.satellites = [...recentLaunches, ...spaceStations]
  .filter(s => s.tle1 && s.tle2);
```

`satelliteTracker.renderAll()` already filters on `tle1 && tle2`. Renders animated orbits with click-to-track.

### 3.4 CCTV Inspector Merge Order

`dashboard/public/worldview/app.js:1466`. Change `{ kind: 'cctv', ...cam }` to `{ ...cam, kind: 'cctv' }`. Spread first, discriminator last. Inline media branch fires correctly from the feed panel.

### 3.5 RSS Atom Plus GUID Fallback

`dashboard/inject.mjs:126-128`. Replace narrow `<link>` extraction with multi-format extractor handling Atom href, classic RSS link, and GUID isPermaLink fallback.

---

## 4. RECON Feature (Journey Planner)

The new feature. v0 in three days.

### 4.1 UX Shape

Right-rail panel, toggle key `R`, slides in over the existing feed panel. Panel state machine: `IDLE` → `PLANNING` → `CAPTURING` → `SAVED`.

In `IDLE`, button: `New Recon`. In `PLANNING`, click globe to drop waypoints, panel shows ordered list. Each waypoint card has: label input, junction note, delete, capture button. Bottom of panel: `Plot Route`, `Save Itinerary`, `Load Itinerary`. In `CAPTURING`, camera flies to selected waypoint, headless screenshot fires after 2-second settle, PNG saved with metadata. In `SAVED`, panel shows list of saved itineraries with thumbnail grid.

### 4.2 Routing Service

New file: `apis/routing/osrm.mjs`. Wraps OSRM public demo server (`router.project-osrm.org`) for v0. Free, no key, sufficient for personal beta.

```js
export async function route({ waypoints, profile = 'car' }) {
  const coords = waypoints.map(w => `${w.lon},${w.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}` +
              `?overview=full&geometries=geojson&steps=true`;
  const r = await fetch(url);
  const j = await r.json();
  return {
    geometry: j.routes[0].geometry,
    distance: j.routes[0].distance,
    duration: j.routes[0].duration,
    legs: j.routes[0].legs,
  };
}
```

Note: OSRM public demo does not handle Indonesian ferries automatically. See 4.3.

### 4.3 Ferry Resolver

New file: `apis/routing/ferries.mjs`. v0 ships hardcoded operator data for Indonesian routes:

```js
export const FERRIES = {
  lembar_padangbai: {
    name: 'Lembar to Padangbai (ASDP Public Ferry)',
    from: { lat: -8.7283, lon: 116.0700, name: 'Lembar Port' },
    to: { lat: -8.5300, lon: 115.5083, name: 'Padangbai Port' },
    durationMinutes: 270,
    departures: ['00:00','02:00','04:00','06:00','08:00','10:00',
                 '12:00','14:00','16:00','18:00','20:00','22:00'],
    operator: 'ASDP Indonesia Ferry',
    bookable: false
  },
  bangsal_padangbai_fastboat: {
    name: 'Bangsal to Padangbai via Gili (Fast Boat)',
    from: { lat: -8.3503, lon: 116.0700, name: 'Bangsal Harbour' },
    to: { lat: -8.5300, lon: 115.5083, name: 'Padangbai Port' },
    durationMinutes: 150,
    departures: ['09:30','13:30'],
    operator: 'Various (Eka Jaya, Wahana, Gili Gili)',
    bookable: false
  },
};

export function detectWaterCrossing(routeGeometry) {
  // Check if any leg crosses known maritime corridor bbox
  // Returns suggested ferry options or null
}
```

When `route()` returns a non-routable gap, panel surfaces ferry resolver options as manual waypoint type. v1 swaps hardcoded data for scraped operator schedules.

### 4.4 Corridor Query

New file: `apis/routing/corridor.mjs`. Given a route polyline and radius in km, returns entities within the buffer.

```js
export async function corridor({ polyline, radiusKm, layers }) {
  const buffer = bufferLineKm(polyline, radiusKm);
  const out = {};
  if (layers.includes('cctv')) {
    out.cctv = (await getAllCCTV()).filter(c => 
      pointInPolygon([c.lon, c.lat], buffer));
  }
  if (layers.includes('accommodation')) {
    out.accommodation = await fetchOSMTourism(buffer);
  }
  if (layers.includes('fuel')) {
    out.fuel = await fetchOSMAmenity('fuel', buffer);
  }
  if (layers.includes('events')) {
    out.events = await filterEventsByCorridor(buffer);
  }
  return out;
}
```

OSM data via Overpass API (`overpass-api.de`). Free, no key. Add `@turf/buffer` and `@turf/boolean-point-in-polygon` to dependencies.

### 4.5 Sequential Loading Manager

Bilawal's hint from the WorldView transcript: load main routes first, then arteries, otherwise the browser crashes.

New file: `dashboard/public/worldview/recon/sequential.js`. Strategy:

```
Tier 1 (immediate):  Route polyline + ferry geometry + waypoint markers
Tier 2 (debounced):  Tier 1 corridor entities (CCTV, accommodation along route)
Tier 3 (lazy):       3D Tiles bounding the route corridor at full LOD
Tier 4 (on-pan):     Adjacent corridor tiles when camera moves off route
```

For Cesium 3D Tiles: tileset `maximumScreenSpaceError` plus explicit bounding-region preloading via `tileset.preloadFlightDestinations`. When a route is plotted, fly the camera along the polyline at 5km altitude, frame by frame, while tileset loads tiles inside the corridor buffer. Once pre-warm finishes, drop user back to overview. Browser holds maybe 200MB tile cache instead of trying to load all of Bali at once.

### 4.6 Junction Capture

New file: `dashboard/public/worldview/recon/capture.js`.

```js
export async function captureJunction({ waypoint, settleMs = 2000 }) {
  await viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(waypoint.lon, waypoint.lat, 800),
    orientation: { pitch: -Cesium.Math.PI_OVER_FOUR, heading: waypoint.heading || 0 }
  });
  await sleep(settleMs);
  const canvas = viewer.scene.canvas;
  const dataUrl = canvas.toDataURL('image/png');
  const meta = {
    waypoint,
    capturedAt: new Date().toISOString(),
    cameraPosition: getCameraState(),
    activeShader: getActiveShader(),
    visibleLayers: getVisibleLayers()
  };
  await fetch('/api/recon/capture', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, meta }),
    headers: { 'Content-Type': 'application/json' }
  });
}
```

Server route writes to `runs/recon/<itinerary-id>/junction-NNN.png` and `junction-NNN.json`.

### 4.7 Itinerary Persistence (Schema Locked)

`runs/recon/<itinerary-id>/itinerary.json`:

```json
{
  "id": "lombok-bali-2026-05-03",
  "class": "recon",
  "title": "Lombok to Bali via Padangbai",
  "createdAt": "2026-04-30T14:00:00+08:00",
  "journeyStartDate": "2026-05-03",
  "journeyEndDate": "2026-05-08",
  "expiry": { "softDays": 30, "hardDays": 90 },

  "waypoints": [
    {
      "id": "wp-1", "lat": -8.5847, "lon": 116.1167,
      "label": "Senggigi start", "note": "Pickup 0700",
      "captureFile": "junction-001.png"
    },
    {
      "id": "wp-2", "lat": -8.7283, "lon": 116.0700,
      "label": "Lembar Port", "note": "Ferry check-in",
      "captureFile": "junction-002.png",
      "ferry": "lembar_padangbai"
    }
  ],
  "route": { "geometry": {}, "distance": 285000, "duration": 21600 },
  "corridor": { "cctv": [], "accommodation": [], "fuel": [], "events": [] },

  "playback": {
    "mode": "scene-by-scene",
    "transition": "cut",
    "perScene": {
      "duration": 4000,
      "shader": "clean",
      "layers": ["air", "sea", "cctv"],
      "labelPosition": "bottom-left"
    }
  },

  "diary": {
    "promotedAt": null,
    "assets": { "photos": [], "videos": [], "audio": null },
    "director": { "engine": "s3-creator-pro", "version": null, "compositionPlan": null },
    "exports": []
  }
}
```

Schema is intentionally forward-compatible. The `diary` block stays null in RECON v0 and gets populated when promoted to Class B (Diary Module, Sprint 2).

---

## 5. Real-Time Traffic

Best free tier for Indonesia corridor is HERE Traffic API (250k transactions/month free). Lower priority because Indonesian local-road traffic data is sparse. New file: `apis/sources/traffic.mjs`. Query HERE Flow API for route bounding box, render coloured polylines on the corridor layer (green/amber/red). Toggle key `T`. If HERE proves insufficient for Bali roads outside Denpasar, defer entirely.

---

## 6. Event Tracker Layer (EVT)

New layer between RSS and SOC.

### 6.1 Sources

```
Eventbrite           EVENTBRITE_TOKEN, free
Songkick             SONGKICK_API_KEY, free
Bandsintown          BANDSINTOWN_KEY, free
Ticketmaster         TICKETMASTER_KEY, free
Foursquare           FOURSQUARE_KEY, free (for venue context)
Resident Advisor     scrape, deferred to v1
```

### 6.2 Adapter

New file: `apis/sources/events.mjs`. Standard adapter shape returning normalised events:

```js
{
  id, title, venue: { name, lat, lon, address },
  startTime, endTime,
  genre: 'electronic'|'rock'|'festival'|'club'|'cultural'|'sport',
  lineup: [{ name, role }],
  ticketUrl, priceFrom, ticketStatus: 'available'|'soldOut'|'unknown',
  source, providerEventId
}
```

### 6.3 Synthesize and Render

In `dashboard/inject.mjs::synthesize()`: `V2.events = { events, byGenre }`.

New file: `dashboard/public/worldview/render/events.js`. Renders each event as a globe marker:

```
Genre        Marker       Colour
electronic   pulsing dot  #B85DFF
festival     ring         #FFB300
club         small dot    #6B6B6B
cultural     square       #64F0C8
sport        chevron      #D4593C (Hanko red)
rock/other   diamond      #FFFFFF
```

Markers fade in as event start time approaches, peak intensity during the event, fade out after end time. Click reveals event card with lineup, ticket link, venue context.

### 6.4 RECON Integration

Corridor query (4.4) accepts `events` as a layer. When an itinerary is plotted with date range, corridor query filters events by spatial buffer AND date overlap. Events become candidate waypoints with one click.

---

## 7. Diary Module (Sprint 2, Working Name TBD)

Permanent video diary of a real journey. Sprint 2 deliverable, post-trip. Schema locked in 4.7 to keep RECON v0 forward-compatible.

### 7.1 Two-Class Lifecycle

```
Class A: RECON itinerary    Pre-trip planning, auto-fades 30/90 days post-expiry
Class B: Diary entry        Permanent record, never auto-rotates
```

`runs/recon/` holds Class A. `runs/diary/` holds Class B. Promotion event: user clicks `Build Diary` on a returned itinerary, JSON is copied to diary directory and gains a permanent record.

### 7.2 Composition Pipeline

Inputs: pre-trip RECON itinerary, user's metatagged photos and videos uploaded post-trip, real-world filler (3D Tiles globe flythroughs along route), local CCTV snippets captured during transit, knowledge layer text snippets, optional generated music via ACE-Step.

Stop detection: photos clustered within 500m radius and 2-hour window become a Stop scene. Gaps over 30 minutes or 2km become Transit scenes with placeholder vehicle sprites animated along OSRM polyline (driving), great-circle (ferry/flight), or pedestrian path.

### 7.3 Director Borrowed from S³ Studio Creator Pro

Generic director interface accepts timeline, assets, audio, style preferences, total duration, returns BriefPlan with scene-by-scene timing, camera moves, and asset assignments. ScenePlayer built for RECON v0 (Addendum A) plays both shapes. RECON BriefPlan is a strict subset of Diary BriefPlan.

### 7.4 Knowledge Layer

Per-Stop text overlays sourced from Wikipedia GeoSearch, OSM Wikidata tags, and OSINT layers when stops coincide with events. LM Studio distills sources to 30-word Ken Burns captions.

### 7.5 Layer U Path

Reserved for `LAYER_U_ARCHITECTURE_2026-04-22.md` Section 4.6 (to be filed):

```
Personal travel narratives owned by users, optionally publishable to Layer U public.
Each diary is an everywear.id-signed permanent record.
Privacy tiers same as Section 3.2 StrandsNation.
Shared diaries become a discoverable feed.
Founders Pass holders publishing diaries gain visibility credit on the social graph.
Diaries can be remixed: another user replays your route with their own photos overlaid.
First commercial wedge: branded travel diaries, hotel partnerships embed sponsorship 
  via the existing v6 Ad Layer dNFT primitive (Section 4.3).
```

### 7.6 Brand

Working placeholder pending Sean's final naming call. Architecture doc and code references use `diary` as the module name and `Diary` as the user-facing label until brand locks.

---

## 8. Data Sources Matrix

| Layer | Source | Key | Status after sprint |
|---|---|---|---|
| 3D Globe | Google 3D Tiles | `GOOGLE_MAPS_API_KEY` | Working, photorealistic |
| Routing | OSRM public demo | None | Working |
| Ferries | Hardcoded ASDP / fastboat schedules | None | Working v0, scrape v1 |
| Accommodation | OSM Overpass API | None | Working |
| Fuel/POI | OSM Overpass API | None | Working |
| Events | Eventbrite + Songkick + Bandsintown + Ticketmaster | Free-tier keys | Working |
| Traffic | HERE Flow API | `HERE_API_KEY` | Optional, defer if rough |
| AIR | OpenSky | None | Working after fix |
| MIL | ADS-B Exchange | `ADSB_API_KEY` | Working with key |
| SAT | CelesTrak TLE | None | Working after fix |
| CCTV | Verified registry + corridor filter | None | Working |
| RSS | 22 feeds + Atom parser | None | Working after fix |

---

## 9. New File Additions

```
apis/routing/osrm.mjs
apis/routing/ferries.mjs
apis/routing/corridor.mjs
apis/sources/traffic.mjs                       # optional
apis/sources/events.mjs
dashboard/public/worldview/recon/panel.js
dashboard/public/worldview/recon/waypoints.js
dashboard/public/worldview/recon/capture.js
dashboard/public/worldview/recon/sequential.js
dashboard/public/worldview/recon/scene-player.js
dashboard/public/worldview/render/events.js
dashboard/public/worldview/shaders/presets.js
dashboard/public/worldview/shaders/nvg.frag.glsl
dashboard/public/worldview/shaders/flir.frag.glsl
dashboard/public/worldview/shaders/crt.frag.glsl
dashboard/public/worldview/shaders/ops.frag.glsl
runs/recon/                                     # Class A itinerary store
runs/diary/                                     # Class B diary store (Sprint 2)
```

---

## 10. New API Endpoints

```
POST /api/recon/route        body: { waypoints[] }                  → route + ferry suggestions
POST /api/recon/corridor     body: { polyline, radiusKm, layers }   → CCTV/accom/fuel/events
POST /api/recon/capture      body: { dataUrl, meta }                → writes PNG + JSON
POST /api/recon/save         body: { itinerary }                    → writes itinerary.json
POST /api/recon/export       body: { itineraryId, format, resolution } → async render job
GET  /api/recon/export/:jobId                                       → status + url
GET  /api/recon/list                                                → array of saved itineraries
GET  /api/recon/:id                                                 → full itinerary
GET  /api/events             query: ?bbox=&from=&to=&genre=         → events
GET  /api/proxy/3dtiles                                             → optional Google Tiles proxy
```

---

## 11. Three-Day Execution Sequence

### Day 1 (today, 2026-04-30 SGT)
- Google 3D Tiles swap, layout fix, inspector merge order, RSS Atom parser. Half a day.
- Shader presets NVG + FLIR + CRT + OPS, parallel agents. Half a day.
- AIR layer fix (opensky + synthesize). Two hours.

End of day 1: globe looks classified, six layers no longer broken, four shader modes cycle on number keys.

### Day 2 (2026-05-01 SGT)
- RECON panel scaffold, waypoint state, click-to-drop, ordered list rendering. Three hours.
- OSRM routing integration, polyline rendering, ferry resolver with hardcoded ASDP routes. Three hours.
- Save and load itinerary endpoints, JSON shape per Section 4.7 schema. Two hours.

End of day 2: can plot Lombok to Bali with ferry, save itinerary.

### Day 3 (2026-05-02 SGT)
- Junction capture, corridor query (Overpass for accommodation + fuel, filter CCTV registry). Four hours.
- Event adapter (Eventbrite + Songkick keys), render layer, RECON corridor integration. Three hours.
- ScenePlayer v0 for itinerary playback. One hour.
- Test full Lombok-Bali plan with events overlaid, capture junctions, save, replay. One hour.

End of day 3: RECON v0 complete. Sean leaves for Bali day 4 with saved, screenshot-captured, accommodation-and-event-overlaid itinerary.

---

## 12. Deferred (Post-Trip Sprint 2 and Beyond)

- MIL layer fix and ADS-B key registration
- SAT layer fix
- HERE Traffic integration
- SAM 2 + Claude OODA loop on CCTV streams
- Director mode Phase 7 to 12 work (REC control, BriefPlan formalisation, MediaRecorder)
- CCTV-projected-onto-3D-geometry technique
- Ferry schedule scraper (replace hardcoded data)
- Strands chain integration: point-click-book waypoints
- Layer U public: shareable itineraries, social annotations, flashmob coordination
- Diary Module (Sprint 2): photo ingest, stop detection, vehicle placeholders, S³ Creator Pro director, knowledge layer, audio integration, export
- Tauri shell adoption via Kasai bot OS (parked pending Kasai bot delivery)
- NVENC encode pipeline reuse from Project ACE / Gener8 (parked)
- Resident Advisor scraper

---

## 13. Distribution Posture

S.O.N stays web-served via `node server.mjs` for the duration of personal beta. Distribution pivot to local Tauri shell deferred until the Kasai bot OS ships. When Kasai bot lands, S.O.N migrates from Node-server-plus-browser to Kasai-bot-embedded-sidecar with the Cesium worldview running inside the bot's webview. Until then, web-based as currently shipped.

NVENC encode pipeline from Project ACE / Gener8 reserved for the post-Kasai migration. CPU ffmpeg via Node sidecar serves as placeholder for export jobs.

---

## 14. Operator Email

All new API key registrations under `kasai@strandsnation.xyz` (forwards to `seanie.sean@gmail.com`).

`cryptolombok@gmail.com` is reserved for Claude login only and is not used for project work.

Migration of existing keys (AISSTREAM, FIRMS, ACLED, FRED, EIA, BLS, RELIEFWEB, OPENSANCTIONS, REDDIT, TELEGRAM, DISCORD) to the new operator email deferred to a single batch session post-trip.

---

## 15. Open Items for Future Confirmation

- Diary Module brand name (working placeholder used in code and docs until Sean's final call)
- Project ACE access for Tauri / NVENC port (deferred until Kasai bot ships)
- Resident Advisor scraping consent and rate limits
- HERE Traffic free-tier coverage assessment for Indonesian roads (test in trial)
- 1080p webm vs 4K MP4 default for export (1080p webm locked for personal trip content, 4K MP4 available as override for Strands marketing builds)

---

## 16. Architecture Lock

This document supersedes the optimisation document dated 2026-04-29 as the active sprint architecture. The 2026-04-29 optimisation document remains valid as a strategic critique and is referenced for its diagnosis of broken layers, but its proposed four-plane refactor is deferred indefinitely. Substrate work earns its keep after the first publishable brief, not before.

This document does not delete or modify any prior canon. Append-only per `LAYER_U_ARCHITECTURE_2026-04-22.md` Section 9 stewardship rules.

---

## 17. Addenda

*(Future timestamped additions below. Do not delete prior entries.)*
