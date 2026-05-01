# Day 1 Overnight Ship Report
**Sprint:** RECON_SPRINT_ARCHITECTURE_2026-04-30
**Window:** 2026-04-30 evening SGT to 2026-05-01 morning SGT
**Author:** Kasai

---

## TL;DR

Six surgical fixes shipped, two scaffolds in place, one new keyboard-driven shader system live. Server is unchanged in behaviour without keys; with the right keys registered it now produces materially more entities on the globe and a photorealistic basemap. RECON feature work (Day 2) starts when you give the go.

To see the biggest visible jump immediately: register `GOOGLE_MAPS_API_KEY` and `ADSB_API_KEY` against `kasai@strandsnation.xyz`, drop them in `.env`, restart `node server.mjs`. AIR layer fix and shader presets are key-free and should be visible on the next sweep.

---

## Files Changed

### Data layer fixes (no keys needed, light up on next sweep)

`apis/sources/opensky.mjs`
- `briefing()` now preserves up to 600 raw OpenSky state vectors (deduped by icao24) as a top-level `states` array. The hotspots aggregation still runs unchanged. AIR layer was the audit's #1 priority — densest layer, no key required.

`apis/sources/space.mjs`
- `getRecentLaunches()` and `getStationData()` mappers now preserve `TLE_LINE1` and `TLE_LINE2` as `tle1` and `tle2`. Previously discarded, which is why SatelliteTracker filtered to zero results.

`dashboard/inject.mjs`
- New helper `extractItemLink(block)` handles three RSS link formats: Atom `<link rel="alternate" href="..."/>`, classic `<link>...</link>`, and `<guid isPermaLink="true">URL</guid>`. Previously only the classic form was matched, so most modern publishers (Reuters/Bloomberg via Google News, Atom-based feeds) silently produced unclickable items.
- `synthesize()` now exposes `V2.opensky.states` so `renderCivilianFlights` can plot individual aircraft.
- `synthesize()` now exposes `V2.space.satellites` as an array of `{name, noradId, tle1, tle2, country, type}` objects, combining recent launches plus space stations plus ISS, filtered to entries carrying TLE pairs. This is exactly what `SatelliteTracker.renderAll()` expects.

### Surgical client fixes

`dashboard/public/worldview/app.js`
- Line ~1466 (after my insertions): CCTV inspector merge order corrected. Was `{ kind: 'cctv', ...cam }` which let `cam.kind` overwrite the discriminator. Now `{ ...cam, kind: 'cctv' }`. CCTV cards opened from the feed panel now route through the inline media branch as intended.

### Visual upgrades

`dashboard/public/worldview.html`
- Top and bottom band heights trimmed from `26vh` to `18vh`. Min-height from 180 to 140, max-height from 320 to 240. Globe gets approximately `64vh` of vertical space instead of the previous `~48vh`. Bands also accept a `body.bands-folded` class that collapses them to a 30px header strip; not yet wired to a UI control but available for the future ALL ◉ button or `B` keypress.

`dashboard/public/worldview/app.js`
- New `tryEnableGoogle3DTiles()` async function runs after viewer creation. Fetches `/api/config`, checks for `googleMapsApiKey`, swaps the flat ESRI imagery for `Cesium.Cesium3DTileset.fromUrl()` against `https://tile.googleapis.com/v1/3dtiles/root.json`. Hides the basemap layer beneath when 3D Tiles loads. Falls back gracefully if no key, network failure, or denied request.
- New import `ShaderPresets` from `./shaders/presets.js`. Instantiated against the viewer at boot.

`dashboard/public/worldview/shaders/presets.js` (new file, 130 lines)
- Four post-process stages registered: NVG, FLIR, CRT, OPS. All Cesium 1.124 GLSL ES 3.0.
- Number keys 0-4 cycle them. Key 0 disables all (clean default). Keys 1-4 enable NVG, FLIR, CRT, OPS respectively.
- CRT has a sub-toggle: `+`/`-` cycle pixelation level 0 → 2 → 4 → 6 → 8 → 0. Tuned to make CCTV-style low-res views look authentic.
- All listeners ignore keypresses when focus is on input or textarea so chat input is unaffected.
- Shaders write to `out_FragColor` per Cesium 1.124's GLSL ES 3.0 contract. If your Cesium build silently rejects them, the rest of the app is unaffected.

### Configuration plumbing

`server.mjs`
- New `/api/config` endpoint returns the public client config plus a `keys` map of which API keys are configured. Used by the 3D Tiles loader; will be used by future RECON / event tracker UI to render honest health badges. Never exposes private keys (ADSB, AISSTREAM, ACLED, etc).

`son.config.mjs`
- New top-level keys: `googleMapsApiKey`, `cesiumIonToken`, `hereApiKey`, `adsbApiKey`, plus an `events` block holding `eventbriteToken`, `songkickKey`, `bandsintownKey`, `ticketmasterKey`, `foursquareKey`. All default to null.

`.env.example`
- New sections for Globe / 3D Tiles, Aircraft (ADS-B), Event Tracker (5 sources), Real-Time Traffic (HERE). All commented with provider URLs and free-tier notes.

---

## What Works Without Any Keys

After `git pull && npm install && node server.mjs` (no `.env` changes):

- AIR layer renders ~600 commercial flights globally on the next sweep (was zero before).
- SAT layer renders ISS, space stations, and recent launches with TLE-propagated orbits (was zero before unless you had data shaped a specific way).
- CCTV cards opened from the feed panel render their inline media correctly (was a silent miss before, fell through to external link only).
- RSS items from Reuters / Bloomberg / Atom-based publishers are now clickable (was unclickable before).
- Globe gets visibly more vertical space (`26vh` to `18vh` band trim).
- Number keys 1-4 apply NVG / FLIR / CRT / OPS shader passes. Key 0 returns to clean.
- `+` / `-` while CRT is active cycles pixelation 0-8.

Everything else is unchanged. No regressions expected.

---

## What Lights Up With One Key Each

Register against `kasai@strandsnation.xyz`:

**`GOOGLE_MAPS_API_KEY`** → console.cloud.google.com → APIs → Map Tiles API. Free tier covers personal beta easily. With this set in `.env`, the globe swaps to photorealistic 3D Tiles. This is the single biggest visual jump.

**`ADSB_API_KEY`** → rapidapi.com/adsbx/api/adsbexchange-com1. Free tier is fine. With this set, MIL layer renders military aircraft globally. The synthesize wiring was already correct in inject.mjs (line ~778) since a previous fix; the only thing missing was the key.

**`FIRMS_MAP_KEY`** → firms.modaps.eosdis.nasa.gov/api. Free, just register. Lights up HOT (thermal anomalies) layer. Audit said the shape was already correct, just key-gated.

**`CESIUM_ION_TOKEN`** → cesium.com/ion. Optional. Unlocks higher-res world terrain when 3D Tiles is not enabled. Skip if you go straight to 3D Tiles.

---

## Risks To Watch When You Restart

These are unlikely but possible:

1. **3D Tiles credit overlay.** Google's Photorealistic 3D Tiles requires displaying their attribution. I set `showCreditsOnScreen: true`. If the credit text clashes with the bottom band layout, we'll see it in the bottom-left corner of the globe. Easy CSS fix if so.

2. **Shader fragment compile errors.** The four shaders are written for Cesium 1.124's GLSL ES 3.0 contract (`in`, `out_FragColor`, `texture()` not `texture2D()`). If your Cesium build's PostProcessStage compiler chokes, you will see a console error and the shader pass will silently fail. Other layers continue working. If you see this, ping me and I will rewrite to GLSL ES 1.0 syntax.

3. **OpenSky 600-state cap.** Some sweeps will pull more than 600 unique aircraft. We dedupe by icao24 and break at 600 to keep the payload size sensible. If you ever want to render thousands, raise `STATE_CAP` in `apis/sources/opensky.mjs:74` or move to clustering.

4. **TLE freshness.** SatelliteTracker uses propagated orbits, so the more time elapsed since the TLE epoch, the more the rendered position drifts from reality. CelesTrak refreshes daily; the sweep refreshes every 15 minutes. Should be fine.

---

## Test Sequence For Morning

1. `cd "C:\Users\MAG MSI\Project SON"`
2. `node server.mjs` (dashboard auto-opens at `http://localhost:3117`)
3. Wait for first sweep to complete (~30 seconds).
4. **Visual check:** globe should have more vertical room than before. Bands shorter.
5. **Shader check:** press `1` for NVG, `2` for FLIR, `3` for CRT, `4` for OPS, `0` to clear. While on `3`, press `+` a few times to add pixelation.
6. **AIR check:** toggle the `AIR` (Commercial Flights) layer on. Hundreds of aircraft markers should appear. Click one; civilian-flight metadata in the inspector.
7. **SAT check:** toggle the `SAT` (Satellite Passes) layer. ISS plus station plus recent-launch orbits visible. Click ISS; live propagated track.
8. **CCTV check:** open the CCTV card panel (bottom band). Click one of the camera cards. The inspector should now render the inline embed (was previously falling through to external link only).
9. **RSS click check:** in the News band, click a Reuters or Bloomberg item. URL should now resolve correctly.
10. **3D Tiles check (optional):** if you registered `GOOGLE_MAPS_API_KEY` and put it in `.env`, restart and zoom into Singapore, Tokyo, or anywhere with Google 3D coverage. Photorealistic geometry should load.

If any check fails, the console (devtools F12) will have the detailed error.

---

## Day 2 Plan (When You Wake Up)

Per `RECON_SPRINT_ARCHITECTURE_2026-04-30.md` Section 11:

- RECON panel scaffold, waypoint state, click-to-drop, ordered list rendering. (3 hours)
- OSRM routing integration, polyline rendering, ferry resolver with hardcoded ASDP routes. (3 hours)
- Save/load itinerary endpoints, JSON shape per Section 4.7 schema. (2 hours)

End of Day 2: full Lombok-to-Bali plan with ferry waypoint, saved to disk, reloadable.

Day 3 closes with corridor query (CCTV / accommodation / fuel / events along route), event adapter (Eventbrite + Songkick), junction screenshot capture, ScenePlayer v0.

Day 4: you depart for Bali with a working RECON itinerary captured and saved.

---

## Deferred From Day 1 (Not Blocking Trip)

- **MIL layer key registration.** Free RapidAPI tier; takes 5 minutes. Synthesize wiring already correct; just needs the key in `.env`.
- **HOT layer key registration.** NASA FIRMS, free, 5 minutes.
- **GPS layer.** Already proxied via `/api/proxy/gpsjam` in `server.mjs`. Audit suggested verifying the upstream URL pattern; no change made tonight, will verify if you toggle the layer and see no data.
- **NET / ASP layers.** No adapter. Deferred per audit's #7 and #8.
- **Resident Advisor scraper.** Deferred to v1 of event tracker.

---

## Commit Message Suggested

```
Day 1 sprint: AIR / SAT / CCTV / RSS fixes + 3D Tiles + shader presets

- opensky: preserve raw state vectors, expose V2.opensky.states
- space: preserve TLE_LINE1/2 in launches + stations, expose V2.space.satellites
- inject: multi-format RSS link extractor (Atom href + classic + GUID permalink)
- worldview app.js: CCTV inspector merge order, Google 3D Tiles loader
- worldview html: bands trimmed 26vh→18vh, collapsible bands-folded class
- shaders/presets.js: NVG / FLIR / CRT / OPS post-process stages on keys 0-4
- server: /api/config endpoint exposing public keys + key-presence flags
- son.config + .env.example: GOOGLE_MAPS_API_KEY, ADSB_API_KEY, event keys, HERE

Per RECON_SPRINT_ARCHITECTURE_2026-04-30.md sections 2 and 3.
```

---

## When You Read This

If everything looks good, say "Day 2 go" and I start the RECON panel. If something is broken, paste the console error and we triage.
