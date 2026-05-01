// OpenSky Network — Real-time flight tracking
// Free for research. 4,000 API credits/day (no auth), 8,000 with account.
// Tracks all aircraft with ADS-B transponders including many military.

import { safeFetch } from '../utils/fetch.mjs';

const BASE = 'https://opensky-network.org/api';

// Get all current flights (global state vector)
export async function getAllFlights() {
  return safeFetch(`${BASE}/states/all`, { timeout: 30000 });
}

// Get flights in a bounding box (lat/lon)
export async function getFlightsInArea(lamin, lomin, lamax, lomax) {
  const params = new URLSearchParams({
    lamin: String(lamin),
    lomin: String(lomin),
    lamax: String(lamax),
    lomax: String(lomax),
  });
  return safeFetch(`${BASE}/states/all?${params}`, { timeout: 20000 });
}

// Get flights by specific aircraft (ICAO24 hex codes)
export async function getFlightsByIcao(icao24List) {
  const icao = Array.isArray(icao24List) ? icao24List : [icao24List];
  const params = icao.map(i => `icao24=${i}`).join('&');
  return safeFetch(`${BASE}/states/all?${params}`, { timeout: 20000 });
}

// Get departures from an airport in a time range
export async function getDepartures(airportIcao, begin, end) {
  const params = new URLSearchParams({
    airport: airportIcao,
    begin: String(Math.floor(begin / 1000)),
    end: String(Math.floor(end / 1000)),
  });
  return safeFetch(`${BASE}/flights/departure?${params}`);
}

// Get arrivals at an airport
export async function getArrivals(airportIcao, begin, end) {
  const params = new URLSearchParams({
    airport: airportIcao,
    begin: String(Math.floor(begin / 1000)),
    end: String(Math.floor(end / 1000)),
  });
  return safeFetch(`${BASE}/flights/arrival?${params}`);
}

// Key hotspot regions for monitoring
const HOTSPOTS = {
  middleEast: { lamin: 12, lomin: 30, lamax: 42, lomax: 65, label: 'Middle East' },
  taiwan: { lamin: 20, lomin: 115, lamax: 28, lomax: 125, label: 'Taiwan Strait' },
  ukraine: { lamin: 44, lomin: 22, lamax: 53, lomax: 41, label: 'Ukraine Region' },
  baltics: { lamin: 53, lomin: 19, lamax: 60, lomax: 29, label: 'Baltic Region' },
  southChinaSea: { lamin: 5, lomin: 105, lamax: 23, lomax: 122, label: 'South China Sea' },
  koreanPeninsula: { lamin: 33, lomin: 124, lamax: 43, lomax: 132, label: 'Korean Peninsula' },
  caribbean: { lamin: 18, lomin: -90, lamax: 30, lomax: -72, label: 'Caribbean' },
  gulfOfGuinea: { lamin: -2, lomin: -5, lamax: 8, lomax: 10, label: 'Gulf of Guinea' },
  capeRoute: { lamin: -38, lomin: 12, lamax: -28, lomax: 24, label: 'Cape Route' },
  hornOfAfrica: { lamin: 5, lomin: 40, lamax: 15, lomax: 55, label: 'Horn of Africa' },
};

// Briefing — check hotspot regions for flight activity.
// Also preserves the first ~600 raw state vectors (deduped by icao24) as a top-level
// `states` array so the AIR layer can render individual planes on the globe per
// LAYER_AUDIT_2026-04-24.md fix #1. Without this passthrough, the densest layer
// on the dashboard rendered zero entities despite the adapter pulling data fine.
export async function briefing() {
  const hotspotEntries = Object.entries(HOTSPOTS);
  const STATE_CAP = 600;
  const seenIcao = new Set();
  const allStates = [];

  const results = await Promise.all(
    hotspotEntries.map(async ([key, box]) => {
      const data = await getFlightsInArea(box.lamin, box.lomin, box.lamax, box.lomax);
      const states = data?.states || [];

      // Preserve raw state vectors (deduped, capped) for client-side rendering.
      for (const s of states) {
        if (allStates.length >= STATE_CAP) break;
        if (!Array.isArray(s) || s.length < 8) continue;
        const icao24 = s[0];
        if (!icao24 || seenIcao.has(icao24)) continue;
        if (typeof s[5] !== 'number' || typeof s[6] !== 'number') continue;
        seenIcao.add(icao24);
        allStates.push({
          icao24,
          callsign: (s[1] || '').trim(),
          country: s[2] || null,
          lon: s[5],
          lat: s[6],
          alt: typeof s[7] === 'number' ? s[7] : null,
          onGround: Boolean(s[8]),
          velocity: typeof s[9] === 'number' ? s[9] : null,
          heading: typeof s[10] === 'number' ? s[10] : null,
          verticalRate: typeof s[11] === 'number' ? s[11] : null,
        });
      }

      return {
        region: box.label,
        key,
        totalAircraft: states.length,
        // states format: [icao24, callsign, origin_country, ...]
        byCountry: states.reduce((acc, s) => {
          const country = s[2] || 'Unknown';
          acc[country] = (acc[country] || 0) + 1;
          return acc;
        }, {}),
        // Flag potentially interesting (military often have no callsign or specific patterns)
        noCallsign: states.filter(s => !s[1]?.trim()).length,
        highAltitude: states.filter(s => s[7] && s[7] > 12000).length, // >12km altitude
      };
    })
  );

  return {
    source: 'OpenSky',
    timestamp: new Date().toISOString(),
    states: allStates,  // raw state vectors for client AIR layer rendering
    hotspots: results,
  };
}

if (process.argv[1]?.endsWith('opensky.mjs')) {
  const data = await briefing();
  console.log(JSON.stringify(data, null, 2));
}
