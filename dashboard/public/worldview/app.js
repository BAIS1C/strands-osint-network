// S.O.N Worldview — main application bootstrap
// Wires Cesium viewer, layer manager, chat panel, timeline, and sweep data.

import { LayerManager } from './layers.js';
import { ChatPanel } from './chat.js';
import { SatelliteTracker } from './satellites.js';
import { ShaderPresets } from './shaders/presets.js';
import { CIVILIAN_PLANE_ICON, MILITARY_PLANE_ICON, headingToRotation } from './icons/planes.js';

// ─── Cesium setup ────────────────────────────────────────────────────────
// Optional Ion token — if Sean sets CESIUM_ION_TOKEN in .env, the server
// renders it into window.CESIUM_ION_TOKEN. Otherwise Cesium uses its default
// which is fine for dev; it just rate-limits high-res terrain/imagery.
if (window.CESIUM_ION_TOKEN) {
  Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN;
}

// IMPORTANT: do NOT request world terrain — that requires a Cesium Ion token.
// Use the default flat ellipsoid so the globe renders without any Ion dependency.
// We also disable the default imagery so we can add ESRI/OSM/CARTO immediately
// without fighting Cesium's async default layer.
const viewer = new Cesium.Viewer('cesiumContainer', {
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  navigationInstructionsInitiallyVisible: false,
  shouldAnimate: true,
  baseLayer: false,                                   // we install our own below
  terrainProvider: new Cesium.EllipsoidTerrainProvider(), // free, no Ion
});

// Scene chrome — keep the lighting flat so imagery is always visible regardless of sun angle
viewer.scene.skyBox.show = true;
viewer.scene.skyAtmosphere.show = true;
viewer.scene.globe.enableLighting = false;           // was true — was dimming the entire globe
viewer.scene.globe.showGroundAtmosphere = true;
viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0A0B0D');
// Occlude entities that are on the far side of the planet so you can't see
// through the globe. Without this, Cesium renders all billboards / labels /
// points regardless of depth, which is why Bosphorus + Panama were visible
// at the same time despite being on opposite sides of Earth.
viewer.scene.globe.depthTestAgainstTerrain = true;

// Basemap providers — all free, no Ion required.
// English-only labels (CARTO) to avoid OSM's native-script render (Arabic, Chinese, etc.)
// and a truly clean dark canvas for intelligence overlays.
const BASEMAPS = {
  satellite: () => new Cesium.UrlTemplateImageryProvider({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit: 'ESRI World Imagery',
    maximumLevel: 19,
  }),
  // CARTO Voyager — English labels, much cleaner density than raw OSM
  osm: () => new Cesium.UrlTemplateImageryProvider({
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    credit: '© CARTO · OpenStreetMap',
    maximumLevel: 19,
  }),
  // Dark minimal — no basemap labels so only intelligence markers speak
  dark: () => new Cesium.UrlTemplateImageryProvider({
    url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    credit: '© CARTO · OpenStreetMap',
    maximumLevel: 19,
  }),
};

let activeBasemapLayer = null;
function setBasemap(name) {
  const provider = (BASEMAPS[name] || BASEMAPS.satellite)();
  const layers = viewer.imageryLayers;
  if (activeBasemapLayer) layers.remove(activeBasemapLayer, true);
  activeBasemapLayer = layers.addImageryProvider(provider, 0);
  document.querySelectorAll('#basemap-group .radio-opt').forEach(el => {
    el.classList.toggle('on', el.dataset.basemap === name);
  });
}
setBasemap('satellite');

// ─── Optional: Google Photorealistic 3D Tiles ─────────────────────────────
// If GOOGLE_MAPS_API_KEY is set in .env (and exposed via /api/config), swap
// the flat ESRI imagery for Google's photorealistic 3D Tiles. Free-tier API
// key from console.cloud.google.com (Map Tiles API). Falls back gracefully
// to the existing ellipsoid + ESRI basemap if the key is absent or denied.
// Per RECON_SPRINT_ARCHITECTURE 2026-04-30 Section 2.1.
let google3DTileset = null;
async function tryEnableGoogle3DTiles() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return false;
    const cfg = await res.json();
    if (!cfg.googleMapsApiKey) {
      console.log('[S.O.N] 3D Tiles: no key (set GOOGLE_MAPS_API_KEY in .env to enable photorealistic globe)');
      return false;
    }
    const url = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(cfg.googleMapsApiKey)}`;
    google3DTileset = await Cesium.Cesium3DTileset.fromUrl(url, {
      showCreditsOnScreen: true,
    });
    viewer.scene.primitives.add(google3DTileset);
    // Apply tileset / basemap visibility based on current scene mode. If the
    // user switched to 2D or CV while the tileset was still loading, this
    // keeps the basemap visible and hides the tileset until they morph back.
    const currentMode = viewer.scene.mode === Cesium.SceneMode.SCENE3D ? '3d'
                       : viewer.scene.mode === Cesium.SceneMode.COLUMBUS_VIEW ? 'cv'
                       : '2d';
    applyTilesetVisibilityForMode(currentMode);
    console.log('[S.O.N] 3D Tiles: photorealistic globe enabled');
    // Surface in window.son for debugging / chat tools later
    window.son.tileset = google3DTileset;
    return true;
  } catch (e) {
    console.warn('[S.O.N] 3D Tiles failed to load (using flat ellipsoid fallback):', e.message);
    return false;
  }
}
tryEnableGoogle3DTiles();

// ─── Shader presets (NVG / FLIR / CRT / OPS) ──────────────────────────────
// Cycles on number keys 0-4. CRT pixelation (+/-) only fires when CRT active.
// Per RECON_SPRINT_ARCHITECTURE 2026-04-30 Section 2.2.
const shaderPresets = new ShaderPresets(viewer);
window.son = window.son || { viewer, Cesium };
window.son.shaderPresets = shaderPresets;

// ─── App state ───────────────────────────────────────────────────────────

const state = {
  data: null,           // current synthesized sweep
  clock: {
    live: true,
    multiplier: 1,
  },
  viewer,
  focus: null,          // current focused region
};

// Make state globally reachable for chat tool handlers + debugging.
// Preserve shaderPresets / tileset already attached above.
window.son = Object.assign(window.son || {}, { viewer, state, Cesium });

// ─── Layer manager ───────────────────────────────────────────────────────

const layerManager = new LayerManager(viewer, document.getElementById('layer-list'));
window.son.layers = layerManager;

const satelliteTracker = new SatelliteTracker(viewer);
window.son.sats = satelliteTracker;

// Register layers — each definition has an id, label, Japanese glyph,
// fetcher (called on refresh), render function, and criticality flag.
layerManager.register({
  id: 'satellites', label: 'Satellite Passes', sub: 'LEO OBSERVATION', glyph: 'SAT', on: true,
  render: (data) => satelliteTracker.renderAll(data),
  source: 'space',
});
layerManager.register({
  id: 'flights-mil', label: 'Military Flights', sub: 'ADS-B · OSINT', glyph: 'MIL', critical: true, on: true,
  renderFromSweep: renderMilitaryFlights,
});
layerManager.register({
  id: 'flights-civ', label: 'Commercial Flights', sub: 'OPENSKY', glyph: 'AIR',
  renderFromSweep: renderCivilianFlights,
});
layerManager.register({
  id: 'ships', label: 'Maritime AIS', sub: 'CHOKEPOINTS', glyph: 'SEA', on: true,
  renderFromSweep: renderShips,
});
layerManager.register({
  id: 'thermal', label: 'Thermal Anomalies', sub: 'FIRMS · 24H', glyph: 'HOT', critical: true, on: true,
  renderFromSweep: renderThermal,
});
layerManager.register({
  id: 'conflict', label: 'Conflict Events', sub: 'ACLED · 7D', glyph: 'WAR', critical: true, on: true,
  renderFromSweep: renderConflict,
});
layerManager.register({
  id: 'news', label: 'News Events', sub: 'GDELT · GEOTAGGED', glyph: 'RSS', on: true,
  renderFromSweep: renderNews,
});
layerManager.register({
  id: 'social', label: 'Social Signals', sub: 'BLUESKY · X · GEOTAGGED', glyph: 'SOC', on: true,
  renderFromSweep: renderSocial,
});
layerManager.register({
  id: 'gpsjam', label: 'GPS Jamming', sub: 'GPSJAM · 24H', glyph: 'GPS', critical: true,
  render: () => renderGpsJamTiles(),
});
layerManager.register({
  id: 'blackouts', label: 'Internet Blackouts', sub: 'CLOUDFLARE RADAR', glyph: 'NET', critical: true,
  renderFromSweep: renderBlackouts,
});
layerManager.register({
  id: 'airspace', label: 'Airspace Closures', sub: 'NOTAM', glyph: 'ASP',
  renderFromSweep: renderAirspace,
});
layerManager.register({
  id: 'chokepoints', label: 'Chokepoint Markers', sub: 'STRATEGIC', glyph: 'CHK',
  renderFromSweep: renderChokepoints, on: true,
});
layerManager.register({
  id: 'cctv', label: 'CCTV · Webcams', sub: 'LIVE PUBLIC CAMS', glyph: 'CAM', on: true,
  renderFromSweep: renderCCTV,
});

// ─── Data fetch + refresh ────────────────────────────────────────────────

async function fetchSweep() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[worldview] /api/data failed:', e);
    return null;
  }
}

async function refresh() {
  const data = await fetchSweep();
  if (!data) return;
  state.data = data;
  updatePosture(data);
  layerManager.refreshAll(data);
  renderBands(data);
  refreshViewIfOpen();
}

// ─── Layer render functions ──────────────────────────────────────────────

function renderMilitaryFlights(layer, data) {
  const flights = data.adsb?.militaryAircraft || data.adsb?.flights || [];
  for (const f of flights) {
    const lat = f.lat ?? f.latitude;
    const lon = f.lon ?? f.lng ?? f.longitude;
    const alt = (f.altitude || f.alt || 10000);
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const heading = f.heading ?? f.true_track ?? f.track ?? 0;
    layer.addEntity({
      id: `mil-${f.hex || f.icao || f.flight || Math.random()}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, alt * 0.3048),
      billboard: {
        image: MILITARY_PLANE_ICON,
        scale: 0.95,                    // larger than civilian
        color: Cesium.Color.fromCssColorString('#F06060'),  // tints the white SVG
        rotation: headingToRotation(heading),
        alignedAxis: Cesium.Cartesian3.ZERO,    // screen-space rotation (icon top points heading)
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,  // always visible
      },
      label: {
        text: f.flight || f.callsign || f.type || '',
        font: '10px "IBM Plex Mono"',
        fillColor: Cesium.Color.fromCssColorString('#FDE8E2'),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
        pixelOffset: new Cesium.Cartesian2(14, -10),
        showBackground: false,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2_000_000),
      },
      meta: { kind: 'military-flight', ...f },
    });
  }
}

function renderCivilianFlights(layer, data) {
  const flights = data.opensky?.states || data.opensky?.flights || [];
  for (const f of flights.slice(0, 800)) {
    const lat = f.lat ?? f.latitude ?? f[6];
    const lon = f.lon ?? f.longitude ?? f[5];
    const altMeters = (f.altitude ?? f.baro_altitude ?? f.alt ?? f[7] ?? 10000);
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const heading = f.heading ?? f.true_track ?? f.track ?? f[10] ?? 0;
    const onGround = f.onGround ?? f[8] ?? false;
    layer.addEntity({
      id: `civ-${f.icao24 || f[0] || Math.random()}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, typeof altMeters === 'number' ? altMeters : 10000),
      billboard: {
        image: CIVILIAN_PLANE_ICON,
        scale: 0.6,
        color: onGround
          ? Cesium.Color.fromCssColorString('#5C7A85')   // dimmer for grounded planes
          : Cesium.Color.fromCssColorString('#8ACFE6'),
        rotation: headingToRotation(heading),
        alignedAxis: Cesium.Cartesian3.ZERO,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      meta: { kind: 'civilian-flight', ...f },
    });
  }
}

// Major global shipping lanes — rendered as polylines so the Maritime AIS layer
// shows something meaningful even without the AISSTREAM_API_KEY. Real AIS
// vessel positions (if keyed) will overlay on top.
const SHIPPING_LANES = [
  // Trans-Pacific (Shanghai → LA)
  { name: 'Trans-Pacific', pts: [[121.5, 31.2], [140, 35], [180, 40], [-140, 40], [-118, 33.8]] },
  // Trans-Atlantic (Rotterdam → NYC)
  { name: 'Trans-Atlantic', pts: [[4.5, 51.9], [-10, 49], [-40, 43], [-74, 40.7]] },
  // Asia-Europe via Suez (Singapore → Hormuz → Suez → Gibraltar → Rotterdam)
  { name: 'Asia-Europe', pts: [[103.8, 1.3], [80, 8], [56, 22], [43, 13], [32.5, 30.5], [14, 36], [-5, 36], [4.5, 51.9]] },
  // Asia-Europe alt via Good Hope
  { name: 'Good Hope Alt', pts: [[103.8, 1.3], [85, -5], [60, -10], [30, -30], [18, -34], [0, -15], [-5, 36], [4.5, 51.9]] },
  // Panama route (East Asia → US East)
  { name: 'Panama', pts: [[121.5, 31.2], [-140, 20], [-90, 10], [-80, 9.1], [-75, 15], [-74, 40.7]] },
  // Malacca approach
  { name: 'Malacca', pts: [[115, -2], [108, 2], [101.5, 2.5], [98, 6], [94, 13]] },
];

function renderShips(layer, data) {
  const ships = data.ships || {};

  // 1. Shipping lanes (always visible so toggling the layer does something)
  for (const lane of SHIPPING_LANES) {
    const positions = Cesium.Cartesian3.fromDegreesArray(lane.pts.flat());
    layer.addEntity({
      id: `lane-${lane.name}`,
      polyline: {
        positions,
        width: 1.5,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#B388FF').withAlpha(0.55),
          dashLength: 14,
        }),
        clampToGround: false,
      },
      meta: { kind: 'shipping-lane', name: lane.name },
    });
  }

  // 2. Live AIS vessels — rendered as top-down ship billboards rotated to COG
  const vessels = ships.vessels || ships.active || [];
  const SHIP_ICON = '/worldview/icons/ship.svg';
  for (const v of vessels.slice(0, 500)) {
    const lat = v.lat ?? v.latitude;
    const lon = v.lon ?? v.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const cog = typeof v.cog === 'number' ? v.cog : (typeof v.heading === 'number' ? v.heading : 0);
    // Cesium rotation: 0 = aligned with +Y (north), positive = clockwise when
    // alignedAxis is UNIT_Z. Our SVG bow points +Y by design, so rotation = -COG (deg→rad).
    const rotation = Cesium.Math.toRadians(-cog);
    // Type-driven tint: tankers amber, containers teal, LNG cyan, bulk slate
    const tint = (() => {
      const t = (v.shipType || '').toString().toLowerCase();
      if (t.includes('tanker'))     return Cesium.Color.fromCssColorString('#F5A623');
      if (t.includes('lng'))        return Cesium.Color.fromCssColorString('#64F0C8');
      if (t.includes('container'))  return Cesium.Color.fromCssColorString('#8FE8CF');
      if (t.includes('bulk'))       return Cesium.Color.fromCssColorString('#B6C7C2');
      if (t.includes('cargo'))      return Cesium.Color.fromCssColorString('#9FE9D4');
      return Cesium.Color.fromCssColorString('#CDFCEB');
    })();
    // Synthetic ships (SAMPLE_LANES fallback when AISSTREAM_API_KEY not set) are
    // visually muted so the operator can distinguish them at a glance from real
    // AIS returns. Faded tint + smaller size + italic-ish opacity curve.
    const isSynthetic = v.synthetic === true || (v.mmsi || '').toString().startsWith('SAMPLE-');
    const finalTint = isSynthetic ? tint.withAlpha(0.45) : tint;
    layer.addEntity({
      id: `vessel-${v.mmsi || v.id || Math.random()}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
      billboard: {
        image: SHIP_ICON,
        width: isSynthetic ? 14 : 18,
        height: isSynthetic ? 14 : 18,
        rotation,
        alignedAxis: Cesium.Cartesian3.UNIT_Z,
        color: finalTint,
        scaleByDistance: new Cesium.NearFarScalar(5e5, 1.25, 2e7, 0.45),
        translucencyByDistance: new Cesium.NearFarScalar(5e5, isSynthetic ? 0.6 : 1.0, 3e7, 0.25),
        heightReference: Cesium.HeightReference.NONE,
        // No disableDepthTestDistance — we want the globe to occlude ships on the far side.
      },
      meta: { kind: 'vessel', synthetic: isSynthetic, ...v },
    });
  }

  // 3. Chokepoint traffic-intensity hints from the sweep
  const cps = ships.chokepoints || {};
  for (const [key, cp] of Object.entries(cps)) {
    if (typeof cp?.lat !== 'number' || typeof cp?.lon !== 'number') continue;
    layer.addEntity({
      id: `ship-hint-${key}`,
      position: Cesium.Cartesian3.fromDegrees(cp.lon, cp.lat, 0),
      ellipse: {
        semiMinorAxis: 80000,
        semiMajorAxis: 80000,
        material: Cesium.Color.fromCssColorString('#B388FF').withAlpha(0.18),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#B388FF').withAlpha(0.7),
        height: 0,
      },
      meta: { kind: 'chokepoint-hint', ...cp },
    });
  }
}

function renderThermal(layer, data) {
  const fires = data.firms?.detections || data.firms?.events || [];
  for (const f of fires.slice(0, 2000)) {
    const lat = f.lat ?? f.latitude;
    const lon = f.lon ?? f.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    layer.addEntity({
      id: `thermal-${f.id || `${lat}-${lon}-${Math.random()}`}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
      point: {
        pixelSize: 3,
        color: Cesium.Color.fromCssColorString('#FF5F63').withAlpha(0.75),
        outlineWidth: 0,
      },
      meta: { kind: 'thermal', ...f },
    });
  }
}

function renderConflict(layer, data) {
  const events = data.acled?.events || [];
  for (const e of events.slice(0, 500)) {
    const lat = e.lat ?? e.latitude;
    const lon = e.lon ?? e.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    layer.addEntity({
      id: `acled-${e.data_id || e.id || Math.random()}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
      point: {
        pixelSize: 7,
        color: Cesium.Color.fromCssColorString('#FF8A4C').withAlpha(0.9),
        outlineColor: Cesium.Color.BLACK, outlineWidth: 1,
      },
      meta: { kind: 'conflict', ...e },
    });
  }
}

function renderNews(layer, data) {
  const items = data.newsFeed || [];
  for (const n of items.slice(0, 400)) {
    if (typeof n.lat !== 'number' || typeof n.lon !== 'number') continue;
    const urgent = !!n.urgent;
    // Latin 3-letter label instead of a bare dot so each marker carries
    // semantic weight at a glance. Urgent items get URG in amber;
    // standard items use RSS in pale cyan.
    const glyph = urgent ? 'URG' : 'RSS';
    const color = urgent ? '#FFB84C' : '#81D4FA';
    layer.addEntity({
      id: `news-${n.id || n.url || `${n.lat}-${n.lon}-${n.headline?.substring(0, 24)}`}`,
      position: Cesium.Cartesian3.fromDegrees(n.lon, n.lat, 0),
      point: {
        pixelSize: urgent ? 6 : 3,
        color: Cesium.Color.fromCssColorString(color).withAlpha(0.95),
        outlineColor: Cesium.Color.fromCssColorString('#000000').withAlpha(0.8),
        outlineWidth: 1,
      },
      label: {
        text: glyph,
        font: `${urgent ? 600 : 500} ${urgent ? 11 : 9.5}px "IBM Plex Mono", monospace`,
        fillColor: Cesium.Color.fromCssColorString(color),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#000000').withAlpha(0.55),
        backgroundPadding: new Cesium.Cartesian2(4, 2),
        pixelOffset: new Cesium.Cartesian2(8, -2),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 30_000_000),
      },
      meta: { kind: 'news', ...n },
    });
  }
}

function renderSocial(layer, data) {
  const posts = data.social?.posts || [];
  for (const p of posts.slice(0, 400)) {
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
    // Two-letter network label: X (twitter/nitter) in goldenrod, BSK (bluesky) in faint cyan.
    // Operator can eyeball network-of-origin without clicking.
    const src = (p.source || '').toLowerCase();
    const isX = src === 'x' || src === 'twitter' || src === 'nitter';
    const color = isX ? '#E6D07A' : '#9FD8C7';
    const glyph = isX ? 'X' : 'BSK';
    layer.addEntity({
      id: `social-${p.id}`,
      position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0),
      point: {
        pixelSize: 2,
        color: Cesium.Color.fromCssColorString(color).withAlpha(0.9),
        outlineWidth: 0,
      },
      label: {
        text: glyph,
        font: '600 9px "IBM Plex Mono", monospace',
        fillColor: Cesium.Color.fromCssColorString(color),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2.5,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(6, -2),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 20_000_000),
      },
      meta: { kind: 'social', ...p },
    });
  }
}

function renderCCTV(layer, data) {
  const cams = data.cctv?.cameras || [];
  for (const c of cams) {
    if (typeof c.lat !== 'number' || typeof c.lon !== 'number') continue;
    const critical = !!c.critical;
    const isNewsLive = c.category === 'news-live';
    // News-live (24/7 broadcasters): pure action teal, TV glyph, slightly larger.
    // Critical cams: amber, bigger.
    // Standard webcams: sky blue, small.
    const color = isNewsLive ? '#64F0C8'
                : critical    ? '#FFB84C'
                              : '#A8D8FF';
    const glyph = isNewsLive ? 'TV' : 'CAM';
    layer.addEntity({
      id: `cctv-${c.id}`,
      position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 0),
      point: {
        pixelSize: isNewsLive ? 6 : critical ? 6 : 4,
        color: Cesium.Color.fromCssColorString(color).withAlpha(0.92),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
      },
      label: {
        text: glyph,
        font: '600 9px "IBM Plex Mono"',
        fillColor: Cesium.Color.fromCssColorString(color),
        style: Cesium.LabelStyle.FILL,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#0B1E19').withAlpha(0.78),
        backgroundPadding: new Cesium.Cartesian2(5, 3),
        pixelOffset: new Cesium.Cartesian2(10, -4),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 40_000_000),
      },
      // Spread FIRST so our kind:'cctv' wins over any cam.kind=iframe collision.
      // Preserve the original stream type on streamKind.
      meta: { ...c, streamKind: c.kind, kind: 'cctv' },
    });
  }
}

async function renderGpsJamTiles() {
  // GPSJam publishes a daily H3 hex GeoJSON at gpsjam.org.
  // Proxied through S.O.N to avoid CORS if browser direct-fetch fails.
  const url = '/api/proxy/gpsjam';
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const gj = await res.json();
    const layer = layerManager.get('gpsjam');
    layer.clearEntities();
    const features = gj.features || [];
    for (const feat of features) {
      const badness = Number(feat.properties?.bad_density || feat.properties?.interference || 0);
      if (badness < 0.3) continue;
      const coords = feat.geometry?.coordinates?.[0];
      if (!coords) continue;
      const flat = coords.flatMap(c => [c[0], c[1]]);
      layer.addEntity({
        id: `gpsjam-${feat.id || Math.random()}`,
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(flat),
          material: Cesium.Color.fromCssColorString('#FF5F63').withAlpha(Math.min(0.5, 0.15 + badness * 0.4)),
          outline: false,
          height: 0,
        },
        meta: { kind: 'gpsjam', badness, ...feat.properties },
      });
    }
  } catch (e) {
    console.warn('[gpsjam] fetch failed:', e);
  }
}

function renderBlackouts(layer, data) {
  const events = data.blackouts?.events || [];
  for (const b of events) {
    if (!b.country_bbox) continue;
    const [w, s, e, n] = b.country_bbox;
    const rect = Cesium.Rectangle.fromDegrees(w, s, e, n);
    layer.addEntity({
      id: `blackout-${b.country || b.iso}`,
      rectangle: {
        coordinates: rect,
        material: Cesium.Color.fromCssColorString('#000000').withAlpha(0.55),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#FF5F63'),
      },
      meta: { kind: 'blackout', ...b },
    });
  }
}

function renderAirspace(layer, data) {
  const closures = data.notam?.closures || data.airspace?.closures || [];
  for (const c of closures) {
    if (!c.polygon) continue;
    const flat = c.polygon.flatMap(p => [p[0], p[1]]);
    layer.addEntity({
      id: `notam-${c.id}`,
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(flat),
        material: Cesium.Color.fromCssColorString('#FFB84C').withAlpha(0.18),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#FFB84C'),
      },
      meta: { kind: 'notam', ...c },
    });
  }
}

function renderChokepoints(layer) {
  // Seal red for critical chokepoints (Hanko semantics: criticality only)
  // Action teal for secondary. All get a persistent target ring + always-on label.
  const CHOKEPOINTS = {
    Hormuz:    { lat: 26.5, lon: 56.5,  note: '20% world oil',      critical: true  },
    Malacca:   { lat: 2.5,  lon: 101.5, note: '25% world trade',    critical: true  },
    Taiwan:    { lat: 24.0, lon: 119.0, note: '88% container ships',critical: true  },
    BabMandeb: { lat: 12.6, lon: 43.3,  note: 'Red Sea gateway',    critical: true  },
    Suez:      { lat: 30.5, lon: 32.3,  note: '12% world trade',    critical: false },
    Bosphorus: { lat: 41.1, lon: 29.1,  note: 'Black Sea access',   critical: false },
    Panama:    { lat: 9.1,  lon: -79.7, note: '5% world trade',     critical: false },
  };

  const SEAL   = '#D4593C'; // hanko red — criticality
  const ACTION = '#64F0C8'; // action teal — secondary

  for (const [name, cp] of Object.entries(CHOKEPOINTS)) {
    const color = cp.critical ? SEAL : ACTION;
    const cColor = Cesium.Color.fromCssColorString(color);

    // Outer halo ring (200km radius) — always visible at distance
    layer.addEntity({
      id: `cp-${name}-ring`,
      position: Cesium.Cartesian3.fromDegrees(cp.lon, cp.lat, 0),
      ellipse: {
        semiMajorAxis: 200_000,
        semiMinorAxis: 200_000,
        fill: true,
        material: cColor.withAlpha(0.08),
        outline: true,
        outlineColor: cColor.withAlpha(0.6),
        outlineWidth: 2,
        height: 0,
      },
      meta: { kind: 'chokepoint-ring', name },
    });

    // Inner target marker — large, bright, unmistakable
    layer.addEntity({
      id: `cp-${name}`,
      position: Cesium.Cartesian3.fromDegrees(cp.lon, cp.lat, 0),
      point: {
        pixelSize: 18,
        color: cColor.withAlpha(0.9),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
      },
      label: {
        text: `${name.toUpperCase()}  ·  ${cp.note}`,
        font: '500 10.5px "IBM Plex Mono", "Menlo", monospace',
        fillColor: cColor,
        backgroundColor: Cesium.Color.fromCssColorString('#0B1E19').withAlpha(0.88),
        backgroundPadding: new Cesium.Cartesian2(8, 5),
        showBackground: true,
        style: Cesium.LabelStyle.FILL,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        pixelOffset: new Cesium.Cartesian2(16, 0),
        scaleByDistance: new Cesium.NearFarScalar(5e5, 1.0, 2e7, 0.72),
        // Depth test on: markers hide when behind the globe.
      },
      meta: { kind: 'chokepoint', name, ...cp },
    });
  }
}

// ─── Posture strip (top-level metrics) ───────────────────────────────────

function updatePosture(d) {
  const dir = d.delta?.summary?.direction || '—';
  const changes = d.delta?.summary?.totalChanges ?? '—';
  const vix = d.fred?.find(f => f.id === 'VIXCLS')?.value;
  const brent = d.energy?.brent;
  const wti = d.energy?.wti;

  document.getElementById('p-dir').textContent = dir.toUpperCase();
  document.getElementById('p-delta').textContent = String(changes);
  document.getElementById('p-vix').textContent = vix ?? '—';
  document.getElementById('p-brent').textContent = brent != null ? `$${brent}` : '—';
  document.getElementById('p-wti').textContent = wti != null ? `$${wti}` : '—';

  document.getElementById('sig-sources').textContent = `${d.meta?.sourcesOk || 0} SOURCES`;
  document.getElementById('meta-sources').textContent = `${d.meta?.sourcesOk || 0}/${d.meta?.sourcesQueried || 0} SRC`;

  const statusEl = document.getElementById('status');
  if (d.delta?.summary?.criticalChanges > 0) {
    statusEl.textContent = `CRITICAL · ${d.delta.summary.criticalChanges}`;
    statusEl.classList.add('critical');
  } else {
    statusEl.textContent = 'LIVE';
    statusEl.classList.remove('critical');
  }
}

// ─── Band renderers — populate the accordion columns above + below globe ─
// Called from refresh() and from SSE sweep_complete. All defensive — missing
// data sections just render "no data" chips, never throw.

function faviconFor(url) {
  try { const d = new URL(url).hostname.replace(/^www\./, ''); return `https://www.google.com/s2/favicons?domain=${d}&sz=64`; }
  catch { return ''; }
}
function bandFeedItem(item) {
  const href = item.url || item.link || '';
  const title = item.title || item.headline || item.text || item.name || '(untitled)';
  const source = (item.source || item.author || '').toString().toUpperCase();
  const when = item.published || item.date || item.timestamp || '';
  const whenShort = when ? new Date(when).toISOString().substring(5, 16).replace('T', ' ') : '';
  const thumb = item.image || item.thumbnail || (href ? faviconFor(href) : '');
  const meta = [source, whenShort, item.region].filter(Boolean).join(' · ');
  // Whole-tile clickable: the <a> wraps the card so any click opens the article
  // in a new tab. Escape everything entering HTML attributes and text nodes.
  const inner = `
    <div class="fi-thumb">${thumb ? `<img src="${escapeHtml(thumb)}" alt="" onerror="this.style.display='none'">` : escapeHtml(source.slice(0, 3) || '·')}</div>
    <div class="fi-col">
      <div class="fi-title">${escapeHtml(title)}</div>
      <div class="fi-meta">${escapeHtml(meta)}</div>
    </div>`;
  if (href) {
    return `<a class="feed-item" href="${escapeHtml(href)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:flex">${inner}</a>`;
  }
  return `<div class="feed-item">${inner}</div>`;
}
function setBand(id, html, count) {
  const body = document.getElementById(id);
  if (body) body.innerHTML = html || '<div class="u-muted" style="font-size:10px;padding:6px">no data</div>';
  if (typeof count === 'number') {
    const n = document.getElementById(id.replace('band-', 'bc-') + '-n')
           || document.getElementById(id.replace('band-', 'bc-').replace('sats', 'sat').replace('alerts', 'alt').replace('markets', 'mkt'));
    if (n) n.textContent = String(count);
  }
}

function renderBands(d) {
  if (!d) return;

  // BRIEF — top-level posture summary
  const brief = d.brief || d.summary || null;
  const dir = d.delta?.summary?.direction || '—';
  const crit = d.delta?.summary?.criticalChanges || 0;
  const briefHtml = brief?.headline
    ? `<div style="color:var(--ink);font-size:11px;line-height:1.45">${escapeHtml(brief.headline)}</div>
       ${brief.body ? `<div style="color:var(--muted);font-size:10.5px;margin-top:6px;line-height:1.4">${escapeHtml(brief.body)}</div>` : ''}`
    : `<div class="kv"><span class="k">Direction</span><span class="v">${dir.toUpperCase()}</span></div>
       <div class="kv"><span class="k">Critical</span><span class="v ${crit > 0 ? 'down' : ''}">${crit}</span></div>
       <div class="kv"><span class="k">Sources</span><span class="v">${d.meta?.sourcesOk || 0}/${d.meta?.sourcesQueried || 0}</span></div>`;
  const briefCount = crit > 0 ? `!${crit}` : '—';
  const briefBody = document.getElementById('band-brief');
  if (briefBody) briefBody.innerHTML = briefHtml;
  const briefN = document.getElementById('bc-brief-n');
  if (briefN) briefN.textContent = String(briefCount);

  // NEWS — GDELT + RSS
  const newsItems = [
    ...(d.gdelt?.events || []),
    ...(d.news?.items || []),
  ].slice(0, 25);
  setBand('band-news', newsItems.map(bandFeedItem).join(''));
  const nN = document.getElementById('bc-news-n'); if (nN) nN.textContent = String(newsItems.length);

  // X / Twitter — adapter retired (Nitter mirrors all dead as of 2026-04).
  // Bot-scraper path in backlog. Show honest offline state, not empty "no data".
  const xItems = (d.social?.items || []).filter(i => {
    const s = (i.source || i.platform || '').toLowerCase();
    return s === 'x' || s === 'twitter' || s === 'nitter';
  }).slice(0, 25);
  const xHtml = xItems.length
    ? xItems.map(bandFeedItem).join('')
    : '<div class="u-muted" style="font-size:10px;padding:6px;line-height:1.4">Source retired: Nitter mirrors offline since 2026-04.<br>Bot-scraper path pending — see LAYER_AUDIT doc.</div>';
  setBand('band-x', xHtml);
  const xN = document.getElementById('bc-x-n'); if (xN) xN.textContent = String(xItems.length || '—');

  // Bluesky — adapter returns 403 since 2026-04 API change. Retired until header fix.
  const bskyItems = (d.social?.items || []).filter(i => {
    const s = (i.source || i.platform || '').toLowerCase();
    return s === 'bluesky' || s === 'bsky';
  }).slice(0, 25);
  const bskyHtml = bskyItems.length
    ? bskyItems.map(bandFeedItem).join('')
    : '<div class="u-muted" style="font-size:10px;padding:6px;line-height:1.4">Source retired: public.api.bsky.app returns 403 since 2026-04.<br>Header / endpoint fix pending.</div>';
  setBand('band-bsky', bskyHtml);
  const bN = document.getElementById('bc-bsky-n'); if (bN) bN.textContent = String(bskyItems.length || '—');

  // MARKETS — energy (brent/wti/natgas) + metals (gold/silver) + crypto (btc/eth/sol/avax/rndr/ar)
  // + FRED macro indicators. Reads the real synthesize shape: d.markets.commodities,
  // d.markets.crypto (both arrays of {symbol, name, price, changePct}).
  const mkt = d.markets || {};
  const commodities = Array.isArray(mkt.commodities) ? mkt.commodities : [];
  const cryptoArr   = Array.isArray(mkt.crypto)       ? mkt.crypto       : [];
  const priceRow = (label, price, changePct) => {
    if (price == null || !Number.isFinite(price)) return '';
    const cls = changePct > 0 ? 'up' : changePct < 0 ? 'down' : '';
    const pct = changePct != null && Number.isFinite(changePct) ? ` <span class="${cls}" style="font-size:9px;opacity:.75">${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%</span>` : '';
    return `<div class="kv"><span class="k">${escapeHtml(label)}</span><span class="v ${cls}">$${Number(price).toLocaleString(undefined, { maximumFractionDigits: price > 1000 ? 0 : price > 10 ? 2 : 4 })}${pct}</span></div>`;
  };
  // Energy: from d.energy (keeps the EIA/yfinance merge) + metals (GC/SI) from d.markets.commodities
  const energyRows = [
    priceRow('Brent', d.energy?.brent, commodities.find(c => c.symbol === 'BZ=F')?.changePct),
    priceRow('WTI',   d.energy?.wti,   commodities.find(c => c.symbol === 'CL=F')?.changePct),
    d.energy?.natgas != null ? priceRow('NatGas', d.energy.natgas, commodities.find(c => c.symbol === 'NG=F')?.changePct) : '',
  ].filter(Boolean).join('');
  const metalRows = commodities
    .filter(c => c.symbol === 'GC=F' || c.symbol === 'SI=F')
    .map(c => priceRow(c.name || c.symbol, c.price, c.changePct))
    .join('');
  const cryptoRows = cryptoArr
    .map(c => priceRow(c.name || c.symbol.replace('-USD', ''), c.price, c.changePct))
    .join('');
  const fredRows = (d.fred || []).slice(0, 6).map(f =>
    `<div class="kv"><span class="k">${escapeHtml(f.id)}</span><span class="v">${f.value ?? '—'}</span></div>`
  ).join('');
  setBand('band-markets', energyRows + metalRows + cryptoRows + fredRows);
  const mN = document.getElementById('bc-mkt-n');
  const mCount = (d.energy ? 3 : 0) + commodities.filter(c => c.symbol === 'GC=F' || c.symbol === 'SI=F').length + cryptoArr.length + (d.fred?.length || 0);
  if (mN) mN.textContent = String(mCount);

  // SATS — upcoming passes
  const passes = d.satellites?.upcomingPasses || d.sats?.upcomingPasses || [];
  const satHtml = passes.slice(0, 8).map(p =>
    `<div class="kv"><span class="k">${escapeHtml(p.name || p.satellite || '?')}</span><span class="v">${p.aos ? new Date(p.aos).toISOString().substring(11, 16) : '—'} UTC</span></div>`
  ).join('');
  setBand('band-sats', satHtml);
  const sN = document.getElementById('bc-sat-n'); if (sN) sN.textContent = String(passes.length);

  // ALERTS — stable alerts.list (NOAA severe + ACLED peaks + Space signals) +
  // legacy fallbacks (delta criticals + NOTAM highlights) if ever populated.
  const alerts = [];
  if (d.alerts?.list) alerts.push(...d.alerts.list);
  if (d.delta?.criticalList) alerts.push(...d.delta.criticalList);
  if (d.notam?.highlights) alerts.push(...d.notam.highlights);
  const altHtml = alerts.slice(0, 15).map(a =>
    `<div class="feed-item">
      <div class="fi-thumb" style="color:#D4593C">!</div>
      <div class="fi-col">
        <div class="fi-title" style="color:#FDE8E2">${escapeHtml(a.title || a.message || a.summary || '(alert)')}</div>
        <div class="fi-meta">${escapeHtml(a.source || a.region || '')}</div>
      </div>
    </div>`
  ).join('');
  setBand('band-alerts', altHtml);
  const aN = document.getElementById('bc-alt-n'); if (aN) aN.textContent = String(alerts.length);

  // CCTV — mini cam cards with favicon preview
  const cams = d.cctv?.cameras || [];
  const camHtml = `<div class="cam-grid-mini">${
    cams.slice(0, 12).map(c => {
      const thumb = c.thumbnailUrl || c.thumbnail || (c.url ? faviconFor(c.url) : '');
      return `<div class="cam-card-mini" data-cam-id="${escapeHtml(c.id || '')}" data-cam-url="${escapeHtml(c.url || '')}" data-cam-kind="${escapeHtml(c.kind || '')}">
        <div class="cam-thumb-mini">${thumb ? `<img src="${thumb}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.textContent='LIVE'">` : 'LIVE'}</div>
        <div class="cam-name-mini">${escapeHtml(c.name || c.id || 'CAM')}</div>
      </div>`;
    }).join('')
  }</div>`;
  setBand('band-cam', camHtml);
  const cN = document.getElementById('bc-cam-n'); if (cN) cN.textContent = String(cams.length);

  // Wire mini cam clicks to open the inspector with the full cam meta
  document.querySelectorAll('#band-cam .cam-card-mini').forEach(card => {
    card.addEventListener('click', () => {
      const cam = cams.find(x => x.id === card.dataset.camId);
      if (cam) showInspector({ meta: { ...cam, streamKind: cam.kind, kind: 'cctv' } });
    });
  });
}

// Accordion collapse on band-col-head click
document.addEventListener('click', (e) => {
  const head = e.target.closest('.band-col-head');
  if (!head) return;
  const col = head.parentElement;
  if (!col) return;
  col.classList.toggle('collapsed');
  const caret = head.querySelector('.bc-caret');
  if (caret) caret.textContent = col.classList.contains('collapsed') ? '▸' : '▾';
});

// ─── Clock tick ──────────────────────────────────────────────────────────

function tick() {
  const now = new Date();
  document.getElementById('meta-clock').textContent =
    now.toLocaleString('en-GB', { timeZone: 'Asia/Singapore', hour12: false }).replace(',', '') + ' SGT';
  const tl = document.getElementById('tl-label');
  if (tl && state.clock.live) tl.textContent = now.toISOString().substring(11, 19) + ' UTC · LIVE';
  // View readout
  const cam = viewer.camera.positionCartographic;
  if (cam) {
    document.getElementById('view-lat').textContent = Cesium.Math.toDegrees(cam.latitude).toFixed(2);
    document.getElementById('view-lon').textContent = Cesium.Math.toDegrees(cam.longitude).toFixed(2);
    document.getElementById('view-alt').textContent = `${(cam.height / 1000).toFixed(0)} km`;
  }
}
setInterval(tick, 1000);
tick();

// ─── Inspector for clicked entities ──────────────────────────────────────

const inspector = document.getElementById('inspector');
const inspClose = document.getElementById('insp-close');
const inspBody = document.getElementById('insp-body');
const inspTitle = document.getElementById('insp-title');
const inspGlyph = document.getElementById('insp-glyph'); // may be null — glyph span removed in new layout

function showInspector(entity) {
  const m = entity?.meta || entity?.properties?.getValue?.() || {};
  const kind = m.kind || 'entity';
  const kindMap = {
    'military-flight': { title: m.flight || m.callsign || 'Military Aircraft' },
    'civilian-flight': { title: m.callsign || 'Civilian Aircraft' },
    'chokepoint':      { title: m.name || 'Chokepoint' },
    'chokepoint-hint': { title: m.label || 'Maritime' },
    'thermal':         { title: 'Thermal Anomaly' },
    'conflict':        { title: m.event_type || 'Conflict Event' },
    'news':            { title: m.title || m.headline || 'News Event' },
    'social':          { title: m.author || 'Social Post' },
    'vessel':          { title: (m.name || m.shipName || `Vessel ${m.mmsi || ''}`.trim()) + (m.synthetic ? ' · SYNTHETIC' : '') },
    'satellite':       { title: m.name || 'Satellite' },
    'gpsjam':          { title: 'GPS Interference' },
    'blackout':        { title: `Blackout · ${m.country || '?'}` },
    'notam':           { title: `NOTAM · ${m.id || '?'}` },
    'cctv':            { title: m.name || 'CCTV' },
  };
  const meta = kindMap[kind] || { title: 'Entity' };
  if (inspGlyph) inspGlyph.textContent = '';
  inspTitle.textContent = meta.title;

  // Build rows from interesting keys — URL rendered as an anchor for all kinds
  const interesting = ['country', 'operator', 'type', 'notes', 'note', 'date', 'speed', 'altitude',
    'heading', 'flight', 'callsign', 'hex', 'icao', 'badness', 'sats_jammed', 'classification',
    'source', 'actor1', 'actor2', 'fatalities', 'event_type', 'sub_event_type', 'location',
    'published', 'description', 'brightness', 'confidence', 'frp', 'noradId',
    'author', 'text', 'likes', 'region', 'headline', 'mmsi', 'shipName', 'shipType', 'sog', 'cog',
    'category'];
  const rows = [];
  for (const k of interesting) {
    const v = m[k];
    if (v == null || v === '') continue;
    rows.push(`<div class="dl-row"><div class="dl-k">${k}</div><div class="dl-v">${escapeHtml(String(v).substring(0, 80))}</div></div>`);
  }

  // ─── Kind-specific media / embed blocks ────────────────────────────────
  let media = '';    // top block (favicon, thumb)
  let embed = '';    // bottom block (iframe, links)

  // CCTV — embed stream inline; use streamKind (original cam.kind)
  if (kind === 'cctv' && m.url) {
    const sk = m.streamKind || m.kind;
    if (sk === 'youtube') {
      // YouTube requires a valid referrer to validate embed permissions; using
      // referrerpolicy="no-referrer" causes Error 153 (player config error) on
      // every embed regardless of video ID. Strict-origin-when-cross-origin
      // sends the origin (localhost:3117) which YouTube accepts, while still
      // not leaking full URL paths to the broadcaster.
      embed = `<div class="insp-iframe-wrap"><iframe src="${escapeHtml(m.url)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    } else if (sk === 'iframe') {
      // Generic iframe (earthTV, ACP Panama, etc.) — no referrer needed,
      // those providers explicitly serve embed pages.
      embed = `<div class="insp-iframe-wrap"><iframe src="${escapeHtml(m.url)}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>`
        + `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener" class="insp-open-ext">Open stream ↗</a>`;
    } else if (sk === 'mjpeg' || sk === 'image') {
      embed = `<div class="insp-thumb"><img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.name || 'CCTV')}" /></div>`
        + `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener" class="insp-open-ext">Open stream ↗</a>`;
    } else {
      embed = `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener" class="insp-open-ext">Open stream ↗</a>`;
    }
  }

  // NEWS / RSS / SOCIAL — favicon strip + clickable link + optional inline preview
  if ((kind === 'news' || kind === 'social' || m.type === 'rss') && m.url) {
    let domain = '';
    try { domain = new URL(m.url).hostname.replace(/^www\./, ''); } catch {}
    const favicon = domain
      ? `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" />`
      : '';
    const sourceLabel = (m.source || domain || 'LINK').toUpperCase();
    media = `<div class="insp-media">
      <div class="insp-favicon">${favicon}</div>
      <div>
        <div class="insp-source">${escapeHtml(sourceLabel)}</div>
        <div class="insp-domain">${escapeHtml(domain)}</div>
      </div>
    </div>`;
    const iframeId = `insp-frame-${Math.random().toString(36).slice(2, 8)}`;
    embed = `<a href="${escapeHtml(m.url)}" target="_blank" rel="noopener" class="insp-open-ext">Open article ↗</a>
      <button class="insp-open-ext" data-preview-target="${iframeId}" data-preview-url="${escapeHtml(m.url)}"
        style="margin-left:6px;background:transparent;cursor:pointer;font-family:var(--ff-mono)">Preview inline</button>
      <div id="${iframeId}" class="insp-iframe-wrap" style="display:none;margin-top:10px"></div>`;
  }

  inspBody.innerHTML = `<h4>${escapeHtml(meta.title)}</h4>${media}<div class="dl">${rows.join('') || '<div class="u-muted">no metadata</div>'}</div>${embed}`;
  // Wire "Preview inline" click to inject iframe (lazy, so non-embeddable sites don't crash the page load)
  inspBody.querySelectorAll('[data-preview-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.previewTarget);
      const url = btn.dataset.previewUrl;
      if (!target) return;
      if (target.style.display === 'none') {
        target.innerHTML = `<iframe src="${escapeHtml(url)}" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"></iframe>
          <div class="insp-iframe-fail">Site may block embedding · use "Open article ↗"</div>`;
        target.style.display = 'block';
        btn.textContent = 'Hide preview';
      } else {
        target.style.display = 'none';
        target.innerHTML = '';
        btn.textContent = 'Preview inline';
      }
    });
  });
  inspector.classList.add('show');

  // Position near cursor (simple)
  inspector.style.left = '60px';
  inspector.style.top = '60px';
}
inspClose.addEventListener('click', () => inspector.classList.remove('show'));

viewer.screenSpaceEventHandler.setInputAction((movement) => {
  const picked = viewer.scene.pick(movement.position);
  if (Cesium.defined(picked) && picked.id) {
    showInspector({ meta: picked.id._cruxMeta });
  } else {
    inspector.classList.remove('show');
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// ─── UI wiring ───────────────────────────────────────────────────────────

// Basemap radio
document.querySelectorAll('#basemap-group .radio-opt').forEach(el => {
  el.addEventListener('click', () => setBasemap(el.dataset.basemap));
});

// Region presets
const REGIONS = {
  hormuz:  { lat: 26.5, lon: 56.5,  h: 1_500_000 },
  iran:    { lat: 32.0, lon: 53.0,  h: 3_500_000 },
  taiwan:  { lat: 24.0, lon: 121.0, h: 2_500_000 },
  ukraine: { lat: 49.0, lon: 32.0,  h: 3_500_000 },
  suez:    { lat: 30.5, lon: 32.3,  h: 1_500_000 },
  global:  { lat: 20.0, lon: 30.0,  h: 20_000_000 },
};
document.querySelectorAll('.regions .btn').forEach(el => {
  el.addEventListener('click', () => {
    const r = REGIONS[el.dataset.region];
    if (!r) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(r.lon, r.lat, r.h),
      duration: 1.8,
    });
    state.focus = el.dataset.region;
  });
});

// Home / 2D-3D
document.getElementById('btn-home').addEventListener('click', () => {
  viewer.camera.flyHome(1.2);
  state.focus = null;
});

// Fullscreen toggle — whole document goes fullscreen so bands + chat rail stay visible
const fsBtn = document.getElementById('btn-fullscreen');
if (fsBtn) {
  fsBtn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn('[S.O.N] Fullscreen toggle failed:', e.message);
    }
  });
  document.addEventListener('fullscreenchange', () => {
    fsBtn.textContent = document.fullscreenElement ? '⛶✓' : '⛶';
    fsBtn.title = document.fullscreenElement ? 'Exit fullscreen' : 'Toggle fullscreen';
  });
}
// 3D / 2D / Columbus View projection pill.
// Google Photorealistic 3D Tiles only render correctly in SCENE3D — they are
// mesh geometry, not tiled raster, so 2D and Columbus View morph the meshes
// into ghost-tiled garbage across the viewport. When the user picks 2D or CV
// we hide the tileset and re-show the imagery basemap so the projection
// renders cleanly. Switching back to 3D reverses it.
// Per session 2026-05-01 SGT — fix for 2D/CV ghosting reported visually.
function applyTilesetVisibilityForMode(mode) {
  const is3D = mode === '3d';
  if (google3DTileset) {
    google3DTileset.show = is3D;
  }
  if (activeBasemapLayer) {
    // Show basemap in 2D / CV; hide it in 3D when tileset is the surface.
    activeBasemapLayer.show = google3DTileset ? !is3D : true;
  }
  // Depth testing — only relevant in 3D with mesh tileset
  viewer.scene.globe.depthTestAgainstTerrain = is3D && !!google3DTileset ? false : true;
}

function setViewMode(mode) {
  const viewModeLabel = document.getElementById('view-mode');
  // Flip tileset visibility BEFORE the morph so the tileset doesn't try to
  // re-project itself. Cesium's morph animation plays smoothly either way.
  applyTilesetVisibilityForMode(mode);
  if (mode === '2d') {
    viewer.scene.morphTo2D(1.0);
    if (viewModeLabel) viewModeLabel.textContent = '2D Flat';
  } else if (mode === 'cv') {
    viewer.scene.morphToColumbusView(1.0);
    if (viewModeLabel) viewModeLabel.textContent = 'Columbus View';
  } else {
    viewer.scene.morphTo3D(1.0);
    if (viewModeLabel) viewModeLabel.textContent = '3D Globe';
  }
  document.querySelectorAll('#mode-pill .mp-opt').forEach(el => {
    el.classList.toggle('on', el.dataset.mode === mode);
  });
}
document.querySelectorAll('#mode-pill .mp-opt').forEach(el => {
  el.addEventListener('click', () => setViewMode(el.dataset.mode));
});

// Timeline speed (hook to viewer.clock.multiplier — Bilawal-style time compression)
document.querySelectorAll('#tl-speed span').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('#tl-speed span').forEach(s => s.classList.remove('on'));
    el.classList.add('on');
    viewer.clock.multiplier = Number(el.dataset.speed);
    state.clock.multiplier = Number(el.dataset.speed);
  });
});

// Sidebar collapse
const layersCollapse = document.getElementById('layers-collapse');
const chatCollapse = document.getElementById('chat-collapse');
if (layersCollapse) {
  layersCollapse.addEventListener('click', () => {
    document.body.classList.toggle('layers-collapsed');
    layersCollapse.textContent = document.body.classList.contains('layers-collapsed') ? '›' : '‹';
    // Force Cesium to resize
    setTimeout(() => viewer.resize?.(), 240);
  });
}
if (chatCollapse) {
  chatCollapse.addEventListener('click', () => {
    document.body.classList.toggle('chat-collapsed');
    chatCollapse.textContent = document.body.classList.contains('chat-collapsed') ? '‹' : '›';
    setTimeout(() => viewer.resize?.(), 240);
  });
}

// ─── Auto-collapse + hover-expand ─────────────────────────────────────────
// Sidebars and bands fold when idle, expand on hover. Lets the globe own
// the viewport during quiet periods, preserves the chrome on demand.
// Per session 2026-05-01 SGT — Strands design ask, auto-shrink behaviour.
const AUTO_COLLAPSE_MS = 10000;          // fold after 10s of no interaction
const HOVER_GRACE_MS   = 220;            // brief grace before re-arming on mouseleave
let autoCollapseTimer  = null;
let hoverHoldTimer     = null;
const userOverrides = {                  // remember manual collapse state so auto-restore respects it
  layers: false, chat: false, bands: false,
};

function setBodyClass(cls, on) {
  document.body.classList.toggle(cls, on);
  if (cls === 'layers-collapsed' && layersCollapse) {
    layersCollapse.textContent = on ? '›' : '‹';
  }
  if (cls === 'chat-collapsed' && chatCollapse) {
    chatCollapse.textContent = on ? '‹' : '›';
  }
}

// userOverrides semantics:
//   undefined → auto-managed (default state)
//   true      → user manually collapsed; do not auto-expand
//   false     → user manually expanded; do not auto-collapse
function autoCollapseAll() {
  if (userOverrides.layers !== false) setBodyClass('layers-collapsed', true);
  if (userOverrides.chat   !== false) setBodyClass('chat-collapsed', true);
  if (userOverrides.bands  !== false) setBodyClass('bands-folded', true);
  setTimeout(() => viewer.resize?.(), 240);
}

function autoExpandAll() {
  if (userOverrides.layers !== true) setBodyClass('layers-collapsed', false);
  if (userOverrides.chat   !== true) setBodyClass('chat-collapsed', false);
  if (userOverrides.bands  !== true) setBodyClass('bands-folded', false);
  setTimeout(() => viewer.resize?.(), 240);
}

function armCollapseTimer() {
  if (autoCollapseTimer) clearTimeout(autoCollapseTimer);
  autoCollapseTimer = setTimeout(autoCollapseAll, AUTO_COLLAPSE_MS);
}

function disarmCollapseTimer() {
  if (autoCollapseTimer) {
    clearTimeout(autoCollapseTimer);
    autoCollapseTimer = null;
  }
}

// User interaction resets the idle timer
['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach(ev => {
  document.addEventListener(ev, armCollapseTimer, { passive: true });
});

// Hover behavior — expand the relevant panel when mouse enters its zone.
// Mouse leaves → arm the auto-collapse timer again after a short grace.
function wireHoverExpand(el, cls, key) {
  if (!el) return;
  el.addEventListener('mouseenter', () => {
    if (hoverHoldTimer) { clearTimeout(hoverHoldTimer); hoverHoldTimer = null; }
    // Don't auto-expand a panel the user explicitly collapsed.
    if (userOverrides[key] !== true) {
      setBodyClass(cls, false);
      setTimeout(() => viewer.resize?.(), 240);
    }
    disarmCollapseTimer();  // don't re-fold while hovered
  });
  el.addEventListener('mouseleave', () => {
    hoverHoldTimer = setTimeout(armCollapseTimer, HOVER_GRACE_MS);
  });
}

const layersEl  = document.getElementById('layers');
const chatEl    = document.getElementById('chat');
const bandTopEl = document.getElementById('band-top');
const bandBotEl = document.getElementById('band-bot');

wireHoverExpand(layersEl,  'layers-collapsed', 'layers');
wireHoverExpand(chatEl,    'chat-collapsed',   'chat');
wireHoverExpand(bandTopEl, 'bands-folded',     'bands');
wireHoverExpand(bandBotEl, 'bands-folded',     'bands');

// Manual collapse buttons set the user override so auto-expand respects intent.
// Click the chevron explicitly → it stays collapsed regardless of mouse hover.
if (layersCollapse) {
  layersCollapse.addEventListener('click', () => {
    userOverrides.layers = document.body.classList.contains('layers-collapsed');
  });
}
if (chatCollapse) {
  chatCollapse.addEventListener('click', () => {
    userOverrides.chat = document.body.classList.contains('chat-collapsed');
  });
}

// Boot: arm the timer so the chrome auto-folds 10s after first paint.
armCollapseTimer();

// Toggle-all intel layers — if any are on, turn all off; otherwise turn all on
// (_syncRow inside LayerManager.toggle() keeps the row .on class in lockstep.)
const toggleAllBtn = document.getElementById('layers-toggle-all');
if (toggleAllBtn) {
  toggleAllBtn.addEventListener('click', () => {
    const layers = layerManager.list();
    const anyOn = layers.some(l => l.on);
    const target = !anyOn;
    layers.forEach(l => layerManager.toggle(l.id, target));
    toggleAllBtn.textContent = target ? 'ALL ◉' : 'ALL ◯';
  });
}

// PULL LIVE — force immediate global OSINT sweep (bypasses polling window)
const pullLiveBtn = document.getElementById('btn-pull-live');
if (pullLiveBtn) {
  pullLiveBtn.addEventListener('click', async () => {
    pullLiveBtn.classList.add('pulling');
    try {
      await fetch('/api/sweep', { method: 'POST' }).catch(() => null);
    } finally {
      setTimeout(() => pullLiveBtn.classList.remove('pulling'), 1200);
    }
  });
}

// PULL REGION — viewport-scoped OSINT sweep
// Reads current Cesium camera rectangle, POSTs bbox, backend re-queries geotagged
// sources filtered to viewport. Falls back to a /api/sweep?bbox= if backend lacks
// the endpoint (graceful, chat still works).
const pullRegionBtn = document.getElementById('btn-pull-region');
if (pullRegionBtn) {
  pullRegionBtn.addEventListener('click', async () => {
    pullRegionBtn.classList.add('pulling');
    try {
      const rect = viewer.camera.computeViewRectangle();
      if (!rect) {
        pullRegionBtn.classList.remove('pulling');
        return;
      }
      const bbox = {
        west:  Cesium.Math.toDegrees(rect.west),
        south: Cesium.Math.toDegrees(rect.south),
        east:  Cesium.Math.toDegrees(rect.east),
        north: Cesium.Math.toDegrees(rect.north),
      };
      const qs = `bbox=${bbox.west.toFixed(3)},${bbox.south.toFixed(3)},${bbox.east.toFixed(3)},${bbox.north.toFixed(3)}`;
      const r = await fetch(`/api/sweep?${qs}`, { method: 'POST' }).catch(() => null);
      if (r && r.ok) {
        // SSE will push the result; flash the button green briefly
        pullRegionBtn.style.background = 'rgba(100,240,200,0.28)';
        setTimeout(() => { pullRegionBtn.style.background = ''; }, 600);
      } else {
        // Fallback: trigger the standard refresh, don't block user
        await fetch('/api/brief').catch(() => null);
      }
    } finally {
      setTimeout(() => pullRegionBtn.classList.remove('pulling'), 700);
    }
  });
}

// REC control (Phase 7 stub, real capture in Phase 11)
import { RecordController } from './record.js';
const recordController = new RecordController({
  buttonEl: document.getElementById('tl-rec'),
});

// ─── Dock tab views (BRIEF / MKT / SAT / ALT) ────────────────────────────
// Each dock icon opens the view panel overlayed on the map. Re-clicking the
// same icon closes the panel (keeps the map usable at all times).
const viewPanel = document.getElementById('view-panel');
const viewBody  = document.getElementById('view-body');
const viewTitle = document.getElementById('view-title');
const viewGlyph = document.getElementById('view-glyph');
const viewClose = document.getElementById('view-close');

function h(html) { return html; } // tag for readability

function fmtNum(n, digits = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Number(n).toFixed(2)}%`;
}
function upDownCls(n) { return n > 0 ? 'up' : n < 0 ? 'down' : ''; }

function renderBriefView(d) {
  if (!d) return '<div class="empty">no sweep data yet</div>';
  const dir = d.delta?.summary?.direction || 'mixed';
  const changes = d.delta?.summary?.totalChanges ?? 0;
  const critical = d.delta?.summary?.criticalChanges ?? 0;
  const sourcesOk = d.meta?.sourcesOk || 0;
  const sourcesTotal = d.meta?.sourcesQueried || 0;

  const vix = d.fred?.find(f => f.id === 'VIXCLS')?.value;
  const hy  = d.fred?.find(f => f.id === 'BAMLH0A0HYM2')?.value;
  const s10y2y = d.fred?.find(f => f.id === 'T10Y2Y')?.value;

  const news = (d.newsFeed || []).slice(0, 8);

  const urgentTg = (d.tg?.urgent || []).slice(0, 3);

  return h(`
    <h5>Posture · ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Singapore', hour12: false })} SGT</h5>
    <div class="kv"><div class="k">Direction</div><div class="v"><span class="tag ${dir}">${dir.toUpperCase()}</span></div></div>
    <div class="kv"><div class="k">Total Δ</div><div class="v">${changes}</div></div>
    <div class="kv"><div class="k">Critical Δ</div><div class="v ${critical > 0 ? 'down' : ''}">${critical}</div></div>
    <div class="kv"><div class="k">Sources</div><div class="v">${sourcesOk}/${sourcesTotal}</div></div>
    <div class="kv"><div class="k">VIX</div><div class="v">${vix ?? '—'}</div></div>
    <div class="kv"><div class="k">HY Spread</div><div class="v">${hy ?? '—'}</div></div>
    <div class="kv"><div class="k">10Y-2Y</div><div class="v">${s10y2y ?? '—'}</div></div>

    <h5>Top Headlines</h5>
    ${news.length ? news.map(n => `
      <div class="item">
        <div class="h">${escapeHtml(n.headline || n.title || '')}</div>
        <div class="m">
          ${n.urgent ? '<span class="tag critical">URGENT</span>' : ''}
          <span class="tag">${escapeHtml(n.source || 'FEED')}</span>
          ${n.region ? `<span class="tag">${escapeHtml(String(n.region))}</span>` : ''}
        </div>
      </div>
    `).join('') : '<div class="empty">no news feed items</div>'}

    <h5>Urgent OSINT</h5>
    ${urgentTg.length ? urgentTg.map(p => `
      <div class="item">
        <div class="h">${escapeHtml((p.text || '').substring(0, 160))}</div>
        <div class="m"><span class="tag critical">URGENT</span><span class="tag">${escapeHtml((p.channel || '').toUpperCase())}</span></div>
      </div>
    `).join('') : '<div class="empty">no urgent telegram signals</div>'}
  `);
}

function renderMktView(d) {
  if (!d) return '<div class="empty">no sweep data yet</div>';
  const m = d.markets || {};
  const rows = [];

  const vix = m.vix;
  rows.push(`<div class="kv"><div class="k">VIX</div><div class="v ${upDownCls(-(vix?.change || 0))}">${vix?.value ?? '—'} ${vix?.changePct != null ? `<span class="${upDownCls(vix.changePct)}">${fmtPct(vix.changePct)}</span>` : ''}</div></div>`);

  for (const q of (m.indexes || [])) {
    rows.push(`<div class="kv"><div class="k">${escapeHtml(q.name || q.symbol)}</div><div class="v ${upDownCls(q.changePct)}">${fmtNum(q.price, 2)} ${fmtPct(q.changePct)}</div></div>`);
  }

  const commo = [];
  for (const q of (m.commodities || [])) {
    commo.push(`<div class="kv"><div class="k">${escapeHtml(q.name || q.symbol)}</div><div class="v ${upDownCls(q.changePct)}">$${fmtNum(q.price, 2)} ${fmtPct(q.changePct)}</div></div>`);
  }

  const crypto = [];
  for (const q of (m.crypto || [])) {
    crypto.push(`<div class="kv"><div class="k">${escapeHtml(q.name || q.symbol)}</div><div class="v ${upDownCls(q.changePct)}">$${fmtNum(q.price, 2)} ${fmtPct(q.changePct)}</div></div>`);
  }

  const rates = [];
  for (const q of (m.rates || [])) {
    rates.push(`<div class="kv"><div class="k">${escapeHtml(q.name || q.symbol)}</div><div class="v">${fmtNum(q.price, 3)}${q.changePct != null ? ` <span class="${upDownCls(q.changePct)}">${fmtPct(q.changePct)}</span>` : ''}</div></div>`);
  }

  return h(`
    <h5>Indexes</h5>
    ${rows.join('') || '<div class="empty">no market data</div>'}
    ${commo.length ? `<h5>Commodities</h5>${commo.join('')}` : ''}
    ${crypto.length ? `<h5>Crypto</h5>${crypto.join('')}` : ''}
    ${rates.length ? `<h5>Rates</h5>${rates.join('')}` : ''}
  `);
}

function renderSatView(d) {
  const status = satelliteTracker?.getStatus?.() || {};
  const cat = status.catalogSize ?? (d?.space?.totalNewObjects ?? 0);
  const tracked = status.trackedCount ?? 0;
  const passes = status.upcomingPasses || [];
  const iss = d?.space?.issPosition;
  const ml = d?.space?.militarySats ?? 0;

  return h(`
    <h5>Catalog</h5>
    <div class="kv"><div class="k">TLE Objects</div><div class="v">${fmtNum(cat)}</div></div>
    <div class="kv"><div class="k">Tracked in View</div><div class="v">${fmtNum(tracked)}</div></div>
    <div class="kv"><div class="k">Military Sats (24h)</div><div class="v">${fmtNum(ml)}</div></div>
    <div class="kv"><div class="k">ISS Position</div><div class="v">${iss ? `${iss.lat}, ${iss.lon}` : '—'}</div></div>

    <h5>Upcoming Passes (Next 2h)</h5>
    ${passes.length ? passes.slice(0, 8).map(p => `
      <div class="item">
        <div class="h">${escapeHtml(p.name || 'Satellite')}</div>
        <div class="m">
          <span class="tag">${escapeHtml(p.operator || '—')}</span>
          <span class="tag">AOS ${p.aos ? new Date(p.aos).toLocaleTimeString() : '—'}</span>
          <span class="tag">MAX EL ${p.maxEl != null ? p.maxEl.toFixed(0) + '°' : '—'}</span>
        </div>
      </div>
    `).join('') : '<div class="empty">no passes computed yet</div>'}
  `);
}

function renderAltView(d) {
  if (!d) return '<div class="empty">no sweep data yet</div>';
  const delta = d.delta || {};
  const changes = delta.changes || delta.items || [];
  const critical = changes.filter(c => c.critical || c.tier === 'critical' || c.tier === 'tier1');

  return h(`
    <h5>Critical Δ (last sweep)</h5>
    ${critical.length ? critical.slice(0, 20).map(c => `
      <div class="item">
        <div class="h">${escapeHtml(c.title || c.label || c.summary || c.key || 'Change')}</div>
        <div class="m">
          <span class="tag critical">CRITICAL</span>
          ${c.source ? `<span class="tag">${escapeHtml(c.source)}</span>` : ''}
          ${c.delta != null ? `<span class="tag">Δ ${c.delta}</span>` : ''}
        </div>
      </div>
    `).join('') : '<div class="empty">no critical changes in this cycle</div>'}

    <h5>All Δ (${changes.length})</h5>
    ${changes.length ? changes.slice(0, 30).map(c => `
      <div class="item">
        <div class="h">${escapeHtml(c.title || c.label || c.summary || c.key || 'Change')}</div>
        <div class="m">
          ${c.source ? `<span class="tag">${escapeHtml(c.source)}</span>` : ''}
          ${c.delta != null ? `<span class="tag">Δ ${c.delta}</span>` : ''}
        </div>
      </div>
    `).join('') : '<div class="empty">no deltas this sweep</div>'}
  `);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderNewsFeedView(d) {
  if (!d) return '<div class="empty">no sweep data yet</div>';
  const items = (d.newsFeed || []).filter(n => n.headline || n.title);
  if (!items.length) return '<div class="empty">no news items</div>';

  // Sort urgent first, then newest
  items.sort((a, b) => {
    if (!!b.urgent - !!a.urgent) return (!!b.urgent) - (!!a.urgent);
    return new Date(b.timestamp || b.published || 0) - new Date(a.timestamp || a.published || 0);
  });

  return items.slice(0, 60).map(n => {
    const title = escapeHtml(n.headline || n.title || '');
    const href = n.url ? escapeHtml(n.url) : null;
    const meta = [];
    if (n.urgent) meta.push('<span class="tag critical">URGENT</span>');
    if (n.source) meta.push(`<span class="tag">${escapeHtml(n.source)}</span>`);
    if (n.region) meta.push(`<span class="tag">${escapeHtml(String(n.region))}</span>`);
    const when = n.timestamp || n.published;
    if (when) meta.push(`<span class="tag">${new Date(when).toLocaleTimeString('en-GB', { hour12: false })}</span>`);
    return `
      <div class="feed-item">
        <div class="fi-head">
          ${href
            ? `<a class="fi-title" href="${href}" target="_blank" rel="noopener">${title}</a>`
            : `<div class="fi-title">${title}</div>`}
        </div>
        <div class="fi-meta">${meta.join(' ')}</div>
        ${n.description ? `<div class="fi-body">${escapeHtml(String(n.description).substring(0, 220))}</div>` : ''}
      </div>
    `;
  }).join('');
}

function renderSocialFeedView(d, source /* 'x' | 'bluesky' */) {
  if (!d) return '<div class="empty">no sweep data yet</div>';
  const all = d.social?.posts || [];
  const items = all.filter(p => (source === 'x' ? p.source === 'x' : p.source !== 'x'));
  if (!items.length) return `<div class="empty">no ${source === 'x' ? 'X / Nitter' : 'Bluesky'} posts this sweep</div>`;

  items.sort((a, b) => (b.likes || 0) - (a.likes || 0));

  return items.slice(0, 50).map(p => {
    const text = escapeHtml((p.text || '').substring(0, 280));
    const author = escapeHtml(p.author || '—');
    const meta = [];
    if (p.region) meta.push(`<span class="tag">${escapeHtml(String(p.region))}</span>`);
    if (p.likes) meta.push(`<span class="tag">♥ ${p.likes}</span>`);
    if (p.date) meta.push(`<span class="tag">${new Date(p.date).toLocaleTimeString('en-GB', { hour12: false })}</span>`);
    const href = p.url ? escapeHtml(p.url) : null;
    return `
      <div class="feed-item">
        <div class="fi-head">
          <div class="fi-title">
            <span class="fi-author">@${author}</span> · ${text}
            ${href ? `<a href="${href}" target="_blank" rel="noopener" style="margin-left:4px">↗</a>` : ''}
          </div>
        </div>
        <div class="fi-meta">${meta.join(' ')}</div>
      </div>
    `;
  }).join('');
}

function renderCamView(d) {
  const cams = d?.cctv?.cameras || [];
  if (!cams.length) return '<div class="empty">no CCTV feeds loaded (restart server to pick up adapter)</div>';

  // Group by region for operator scan-ability
  const byRegion = {};
  for (const c of cams) {
    const r = c.region || 'Other';
    (byRegion[r] = byRegion[r] || []).push(c);
  }

  const blocks = Object.entries(byRegion).map(([region, list]) => `
    <h5>${escapeHtml(region)} (${list.length})</h5>
    <div class="cam-grid">
      ${list.map(c => `
        <div class="cam-card" data-cam="${escapeHtml(c.id)}" data-lat="${c.lat}" data-lon="${c.lon}">
          <div class="cam-thumb">CAM</div>
          <div class="cam-meta">
            <div class="cam-name">${escapeHtml(c.name)}</div>
            <div class="cam-region">${escapeHtml(c.category || '')}${c.critical ? ' · CRITICAL' : ''}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  return blocks;
}

const VIEWS = {
  brief:   { title: 'Briefing',       render: renderBriefView,                       feed: false },
  news:    { title: 'News Feed',      render: renderNewsFeedView,                    feed: true  },
  x:       { title: 'X / Nitter',     render: (d) => renderSocialFeedView(d, 'x'),   feed: true  },
  bsky:    { title: 'Bluesky',        render: (d) => renderSocialFeedView(d, 'bsky'),feed: true  },
  cam:     { title: 'CCTV Feeds',     render: renderCamView,                         feed: true  },
  markets: { title: 'Markets',        render: renderMktView,                         feed: false },
  sats:    { title: 'Satellites',     render: renderSatView,                         feed: false },
  alerts:  { title: 'Alerts',         render: renderAltView,                         feed: false },
};

let activeView = null;
function openView(id) {
  const def = VIEWS[id];
  if (!def) return;
  activeView = id;
  if (typeof viewGlyph !== 'undefined' && viewGlyph) viewGlyph.textContent = '';
  viewTitle.textContent = def.title;
  viewBody.innerHTML = def.render(state.data);
  viewPanel.classList.add('show');
  viewPanel.classList.toggle('feed-mode', !!def.feed);
  wireFeedInteractions(id);
}
function closeView() {
  activeView = null;
  viewPanel.classList.remove('show', 'feed-mode');
}
function refreshViewIfOpen() {
  if (activeView && VIEWS[activeView]) {
    viewBody.innerHTML = VIEWS[activeView].render(state.data);
    wireFeedInteractions(activeView);
  }
}

// Feed-panel interactions: click a CCTV card → fly to + open inspector with embed
function wireFeedInteractions(viewId) {
  if (viewId !== 'cam') return;
  viewBody.querySelectorAll('.cam-card').forEach(card => {
    card.addEventListener('click', () => {
      const camId = card.dataset.cam;
      const lat = Number(card.dataset.lat);
      const lon = Number(card.dataset.lon);
      const cam = (state.data?.cctv?.cameras || []).find(c => c.id === camId);
      if (!cam) return;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 400_000),
        duration: 1.4,
      });
      // Spread cam first, set kind discriminator last — `cam.kind` would otherwise
      // overwrite 'cctv' with the stream's media kind (youtube, iframe, etc.) and
      // the inspector would miss the CCTV media branch. Fix per RECON sprint 3.4.
      showInspector({ meta: { ...cam, kind: 'cctv' } });
    });
  });
}

document.querySelectorAll('.dock-icon').forEach(el => {
  el.addEventListener('click', () => {
    const view = el.dataset.view;
    if (view === 'world' || !view) { closeView(); return; }
    if (activeView === view) { closeView(); return; } // toggle off
    openView(view);
  });
});
viewClose.addEventListener('click', closeView);

// ─── Chat panel ──────────────────────────────────────────────────────────

const chat = new ChatPanel({
  logEl: document.getElementById('chat-log'),
  inputEl: document.getElementById('chat-text'),
  sendEl: document.getElementById('chat-send'),
  clearEl: document.getElementById('chat-clear'),
  clientTools: {
    toggle_layer: ({ layer, on }) => {
      const ok = layerManager.toggle(layer, on);
      return { success: ok, layer, on };
    },
    focus_map: ({ lat, lon, altKm = 3000 }) => {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, altKm * 1000),
        duration: 1.6,
      });
      return { success: true, lat, lon, altKm };
    },
    set_basemap: ({ name }) => {
      setBasemap(name);
      return { success: true, basemap: name };
    },
    list_layers: () => ({ layers: layerManager.list() }),
    set_timeline_speed: ({ multiplier }) => {
      viewer.clock.multiplier = Number(multiplier);
      return { success: true, multiplier };
    },
  },
});

// ─── Initial load ────────────────────────────────────────────────────────

refresh();
setInterval(refresh, 60_000); // pull fresh sweep every minute

// SSE for push updates
try {
  const es = new EventSource('/events');
  es.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'update' && msg.data) {
        state.data = msg.data;
        updatePosture(msg.data);
        layerManager.refreshAll(msg.data);
        renderBands(msg.data);
        refreshViewIfOpen();
      } else if (msg.type === 'sweep_trigger') {
        // PULL LIVE / PULL REGION feedback — flag the expected payload
        const status = document.getElementById('status');
        if (status) { status.textContent = msg.source === 'region' ? 'REGION PULL' : 'LIVE PULL'; }
      } else if (msg.type === 'sweep_complete' && msg.data) {
        state.data = msg.data;
        updatePosture(msg.data);
        layerManager.refreshAll(msg.data);
        renderBands(msg.data);
      }
    } catch {}
  });
  es.addEventListener('error', () => {});
} catch (e) {
  console.warn('SSE unavailable:', e);
}
