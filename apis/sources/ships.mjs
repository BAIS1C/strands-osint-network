// Ship/Vessel Tracking — aisstream.io (free real-time global AIS)
// Reads live vessels from apis/live/aisstream.mjs buffer (persistent WebSocket
// started by server.mjs on boot). Falls back to a synthetic chokepoint sample
// when no key is set so the Maritime AIS layer isn't empty.
//
// Detects: dark ships, sanctions evasion, naval deployments, port congestion.

import { getLiveVessels, getSyntheticSampleVessels, getStatus } from '../live/aisstream.mjs';

// Key maritime chokepoints to monitor
const CHOKEPOINTS = {
  straitOfHormuz: { label: 'Strait of Hormuz', lat: 26.5, lon: 56.5, note: '20% of world oil' },
  suezCanal: { label: 'Suez Canal', lat: 30.5, lon: 32.3, note: '12% of world trade' },
  straitOfMalacca: { label: 'Strait of Malacca', lat: 2.5, lon: 101.5, note: '25% of world trade' },
  babElMandeb: { label: 'Bab el-Mandeb', lat: 12.6, lon: 43.3, note: 'Red Sea gateway' },
  taiwanStrait: { label: 'Taiwan Strait', lat: 24.0, lon: 119.0, note: '88% of largest container ships' },
  bosporusStrait: { label: 'Bosphorus', lat: 41.1, lon: 29.1, note: 'Black Sea access' },
  panamaCanal: { label: 'Panama Canal', lat: 9.1, lon: -79.7, note: '5% of world trade' },
  capeOfGoodHope: { label: 'Cape of Good Hope', lat: -34.4, lon: 18.5, note: 'Suez alternative' },
};

export async function briefing() {
  const aisStatus = getStatus();
  const hasKey = !!process.env.AISSTREAM_API_KEY;

  let vessels = getLiveVessels();
  let synthetic = false;
  if (!vessels.length) {
    vessels = getSyntheticSampleVessels();
    synthetic = true;
  }

  return {
    source: 'Maritime/AIS',
    timestamp: new Date().toISOString(),
    status: hasKey ? aisStatus.status : 'no_key',
    synthetic,
    vesselCount: vessels.length,
    liveStatus: aisStatus,
    message: hasKey
      ? `AIS stream: ${aisStatus.status}, ${vessels.length} vessels buffered`
      : 'Set AISSTREAM_API_KEY for real-time global vessel tracking (free at aisstream.io). Using synthetic samples for now.',
    chokepoints: CHOKEPOINTS,
    vessels,
    monitoringCapabilities: [
      'Dark ship detection (AIS transponder shutoffs)',
      'Sanctions evasion (ship-to-ship transfers)',
      'Naval deployment tracking',
      'Port congestion (vessel dwell time)',
      'Chokepoint traffic anomalies',
      'Oil tanker route changes',
    ],
  };
}

if (process.argv[1]?.endsWith('ships.mjs')) {
  const data = await briefing();
  console.log(JSON.stringify(data, null, 2));
}
