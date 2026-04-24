// AISStream live WebSocket listener.
//
// Keeps a persistent connection open to wss://stream.aisstream.io/v0/stream
// and maintains an in-memory Map<mmsi, vessel> buffer. The ships.mjs briefing
// reads the buffer on every sweep so synthesize() can ship vessels to the
// Worldview Maritime AIS layer.
//
// Node 22 has global WebSocket — no `ws` package required.
//
// Free API key: https://aisstream.io (sign up, paste into AISSTREAM_API_KEY
// in S.O.N .env). Without a key, this module is a no-op and getLiveVessels()
// falls back to a synthetic sample ring around chokepoints so the UI still
// has something to render.

import '../utils/env.mjs';

const CHOKEPOINT_BOXES = {
  // [[latMin, lonMin], [latMax, lonMax]] — AISStream format
  hormuz:     [[24.5, 54.5], [28.5, 58.5]],
  suez:       [[28.0, 30.5], [33.0, 34.5]],
  malacca:    [[-1.5, 98.0], [6.0, 105.0]],
  babMandeb:  [[10.0, 41.0], [15.0, 45.5]],
  taiwan:     [[21.5, 116.5], [26.5, 122.0]],
  bosphorus:  [[40.0, 27.5], [43.0, 31.0]],
  panama:     [[7.0, -82.0], [11.0, -77.5]],
  goodHope:   [[-36.5, 16.0], [-32.5, 21.5]],
  gibraltar:  [[34.5, -7.0], [37.5, -3.5]],
  baltic:     [[53.0, 9.0], [60.0, 30.0]],
  // Plus a sparse global monitor for outliers / dark ships
  arabianSea: [[10.0, 50.0], [25.0, 75.0]],
  southChina: [[5.0, 105.0], [25.0, 122.0]],
};

const MAX_BUFFER_SIZE = 5000;    // hard cap
const VESSEL_TTL_MS   = 30 * 60_000; // drop vessels not seen in 30 min

// mmsi -> { mmsi, lat, lon, sog, cog, shipName, shipType, updatedAt }
const vesselBuffer = new Map();

let ws = null;
let reconnectTimer = null;
let status = 'idle'; // idle | connecting | open | closed | error
let lastError = null;
let connectAttempts = 0;

export function getStatus() {
  return {
    status,
    lastError,
    connectAttempts,
    vesselCount: vesselBuffer.size,
  };
}

// Returns vessels currently tracked (TTL-filtered, capped). Call on every sweep.
export function getLiveVessels() {
  const now = Date.now();
  const out = [];
  for (const [mmsi, v] of vesselBuffer) {
    if (now - v.updatedAt > VESSEL_TTL_MS) {
      vesselBuffer.delete(mmsi);
      continue;
    }
    out.push({ ...v });
  }
  return out;
}

// Synthetic fallback — used by ships.mjs if no live vessels and no key.
// Samples along verified deep-water shipping-lane polylines so no synthetic
// vessel ever renders on land. Each lane is a real routing corridor; we pick
// points along the segments with a small perpendicular jitter and assign a
// heading that follows the lane direction.
const SAMPLE_LANES = {
  // Strait of Hormuz — eastbound lane, Iranian coast → Gulf of Oman
  hormuz: {
    n: 10,
    waypoints: [
      [26.62, 55.80], [26.55, 56.10], [26.45, 56.35], [26.30, 56.55],
      [26.05, 56.80], [25.75, 57.10], [25.40, 57.45],
    ],
  },
  // Suez Canal centerline + southern approach
  suez: {
    n: 8,
    waypoints: [
      [31.25, 32.32], [30.95, 32.35], [30.60, 32.34], [30.25, 32.40],
      [29.95, 32.55], [29.65, 32.70], [29.30, 32.90], [28.80, 33.20],
    ],
  },
  // Strait of Malacca — NW to SE traffic
  malacca: {
    n: 14,
    waypoints: [
      [5.80, 98.40], [5.10, 99.00], [4.30, 99.60], [3.50, 100.20],
      [2.80, 100.80], [2.10, 101.50], [1.50, 102.30], [1.25, 103.30],
      [1.20, 103.80], [1.30, 104.30],
    ],
  },
  // Bab el-Mandeb — Red Sea → Gulf of Aden
  babMandeb: {
    n: 9,
    waypoints: [
      [13.20, 43.10], [12.80, 43.25], [12.50, 43.40], [12.20, 43.50],
      [11.90, 43.65], [11.60, 43.85], [11.30, 44.20],
    ],
  },
  // Taiwan Strait — central water, well clear of both coasts
  taiwan: {
    n: 12,
    waypoints: [
      [25.10, 120.30], [24.60, 120.05], [24.10, 119.80], [23.60, 119.50],
      [23.00, 119.20], [22.40, 118.90],
    ],
  },
  // Bosphorus — mid-channel
  bosphorus: {
    n: 5,
    waypoints: [
      [41.24, 29.12], [41.17, 29.08], [41.10, 29.05], [41.03, 29.00],
      [40.97, 28.95],
    ],
  },
  // Panama Canal approach — Pacific side (Gulf of Panama)
  panama: {
    n: 6,
    waypoints: [
      [9.30, -79.90], [9.15, -79.72], [8.95, -79.55], [8.70, -79.40],
      [8.40, -79.20], [8.10, -79.00],
    ],
  },
  // Cape of Good Hope — offshore rounding
  goodHope: {
    n: 4,
    waypoints: [
      [-34.40, 18.20], [-34.65, 18.55], [-34.95, 18.95], [-35.20, 19.40],
    ],
  },
  // South China Sea trunk lane
  southChinaSea: {
    n: 10,
    waypoints: [
      [4.00, 106.00], [7.00, 108.50], [10.50, 111.00], [14.00, 113.00],
      [17.50, 115.50], [20.50, 117.50], [22.50, 119.00],
    ],
  },
  // North Atlantic trade — mid-ocean, no coast hits
  northAtlantic: {
    n: 8,
    waypoints: [
      [48.00, -30.00], [46.00, -35.00], [44.00, -40.00], [42.00, -45.00],
      [40.00, -50.00], [41.00, -55.00], [42.50, -60.00], [44.00, -65.00],
    ],
  },
};

function bearing(a, b) {
  const φ1 = a[0] * Math.PI / 180, φ2 = b[0] * Math.PI / 180;
  const Δλ = (b[1] - a[1]) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Sample a point along a polyline at param t in [0,1] with a tiny perpendicular
// jitter in degrees. Returns { lat, lon, cog }.
function sampleAlongLane(waypoints, t, jitterDeg = 0.04) {
  const segs = waypoints.length - 1;
  const scaled = Math.max(0, Math.min(segs - 1e-9, t * segs));
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = waypoints[i], b = waypoints[i + 1];
  const lat = a[0] + (b[0] - a[0]) * f;
  const lon = a[1] + (b[1] - a[1]) * f;
  const cog = bearing(a, b);
  // Perpendicular jitter: rotate (1,0) by cog+90 in local deg space
  const th = (cog + 90) * Math.PI / 180;
  const j = (Math.random() - 0.5) * 2 * jitterDeg;
  return {
    lat: lat + Math.sin(th) * j,
    lon: lon + Math.cos(th) * j,
    cog,
  };
}

export function getSyntheticSampleVessels() {
  const vessels = [];
  const shipTypes = ['Tanker', 'Cargo', 'Container', 'LNG', 'Bulk Carrier'];
  let id = 0;
  for (const [laneKey, { n, waypoints }] of Object.entries(SAMPLE_LANES)) {
    for (let i = 0; i < n; i++) {
      // Distribute along the lane with a little randomness so ships aren't
      // perfectly spaced.
      const t = (i + 0.5 + (Math.random() - 0.5) * 0.4) / n;
      const { lat, lon, cog } = sampleAlongLane(waypoints, t);
      vessels.push({
        mmsi: `SAMPLE-${laneKey}-${i}`,
        lat,
        lon,
        sog: +(10 + Math.random() * 10).toFixed(1),
        cog: Math.round(cog + (Math.random() - 0.5) * 6),
        shipName: `Sample ${laneKey} ${i}`,
        shipType: shipTypes[id++ % shipTypes.length],
        updatedAt: Date.now(),
        synthetic: true,
      });
    }
  }
  return vessels;
}

function subscribePayload(apiKey) {
  // AISStream expects [[[latMin,lonMin],[latMax,lonMax]], ...]
  const boxes = Object.values(CHOKEPOINT_BOXES).map(box => box);
  return JSON.stringify({
    APIKey: apiKey,
    BoundingBoxes: boxes,
    FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
  });
}

function handleMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  // Subscription errors come back as {error: "..."}
  if (msg.error) {
    lastError = msg.error;
    status = 'error';
    console.error('[AIS] error from stream:', msg.error);
    return;
  }

  const type = msg.MessageType;
  const md = msg.MetaData || {};
  const mmsi = md.MMSI || md.MMSI_String;
  if (!mmsi) return;

  const mmsiKey = String(mmsi);
  const existing = vesselBuffer.get(mmsiKey) || { mmsi: mmsiKey };

  if (type === 'PositionReport') {
    const pos = msg.Message?.PositionReport || {};
    existing.lat = pos.Latitude ?? md.latitude;
    existing.lon = pos.Longitude ?? md.longitude;
    existing.sog = pos.Sog ?? null;
    existing.cog = pos.Cog ?? null;
    existing.heading = pos.TrueHeading ?? null;
    existing.navStatus = pos.NavigationalStatus ?? null;
    existing.updatedAt = Date.now();
  } else if (type === 'ShipStaticData') {
    const sd = msg.Message?.ShipStaticData || {};
    existing.shipName = (sd.Name || md.ShipName || '').trim();
    existing.shipType = sd.Type ?? null;
    existing.callSign = (sd.CallSign || '').trim() || null;
    existing.imo = sd.ImoNumber ?? null;
    existing.destination = (sd.Destination || '').trim() || null;
    existing.updatedAt = existing.updatedAt || Date.now();
  } else {
    return;
  }

  // Enforce cap
  if (vesselBuffer.size >= MAX_BUFFER_SIZE && !vesselBuffer.has(mmsiKey)) {
    // Evict oldest
    let oldestKey = null, oldestTs = Infinity;
    for (const [k, v] of vesselBuffer) {
      if (v.updatedAt < oldestTs) { oldestTs = v.updatedAt; oldestKey = k; }
    }
    if (oldestKey) vesselBuffer.delete(oldestKey);
  }

  vesselBuffer.set(mmsiKey, existing);
}

function scheduleReconnect(apiKey) {
  if (reconnectTimer) return;
  const delay = Math.min(60_000, 2000 * Math.pow(2, Math.min(connectAttempts, 5)));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(apiKey);
  }, delay);
}

function connect(apiKey) {
  if (ws && ws.readyState === 1 /* OPEN */) return;
  if (typeof WebSocket === 'undefined') {
    status = 'error';
    lastError = 'global WebSocket not available — Node 22+ required';
    console.error('[AIS]', lastError);
    return;
  }

  status = 'connecting';
  connectAttempts++;
  try {
    ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
  } catch (e) {
    status = 'error';
    lastError = e.message;
    scheduleReconnect(apiKey);
    return;
  }

  ws.addEventListener('open', () => {
    status = 'open';
    connectAttempts = 0;
    console.log(`[AIS] WebSocket connected, subscribing to ${Object.keys(CHOKEPOINT_BOXES).length} bounding boxes`);
    try { ws.send(subscribePayload(apiKey)); }
    catch (e) { console.error('[AIS] subscribe send failed:', e.message); }
  });

  ws.addEventListener('message', (ev) => {
    try { handleMessage(typeof ev.data === 'string' ? ev.data : ev.data?.toString?.() || ''); }
    catch (e) { /* ignore malformed frames */ }
  });

  ws.addEventListener('close', (ev) => {
    status = 'closed';
    console.warn(`[AIS] WebSocket closed code=${ev.code}; reconnecting`);
    scheduleReconnect(apiKey);
  });

  ws.addEventListener('error', (ev) => {
    status = 'error';
    lastError = ev?.message || 'WebSocket error';
    console.error('[AIS] WebSocket error:', lastError);
    // close handler will handle the retry
  });
}

export function start() {
  const apiKey = process.env.AISSTREAM_API_KEY;
  if (!apiKey) {
    status = 'disabled';
    console.log('[AIS] AISSTREAM_API_KEY not set — live AIS disabled. Synthetic sample vessels only. Get a free key at https://aisstream.io');
    return false;
  }
  connect(apiKey);
  return true;
}

export function stop() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { try { ws.close(); } catch {} ws = null; }
  status = 'idle';
}
