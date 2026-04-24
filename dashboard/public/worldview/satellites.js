// S.O.N Worldview — Satellite Tracker
// Pulls TLEs from the sweep (data.space) and propagates positions via
// satellite.js SGP4. Renders animated entities with ground tracks.

export class SatelliteTracker {
  constructor(viewer) {
    this.viewer = viewer;
    this.entities = [];
    this.satrecs = new Map(); // id -> satrec
  }

  renderAll(data) {
    this.clear();
    const sats = this._extractTLEs(data);
    if (!sats.length) return;

    const now = Cesium.JulianDate.now();
    const stop = Cesium.JulianDate.addSeconds(now, 60 * 90, new Cesium.JulianDate()); // 90 min window

    // Configure viewer clock to span the window
    this.viewer.clock.startTime = now.clone();
    this.viewer.clock.stopTime = stop.clone();
    this.viewer.clock.currentTime = now.clone();
    this.viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;

    for (const s of sats.slice(0, 40)) {
      if (!window.satellite) continue;
      let satrec;
      try {
        satrec = window.satellite.twoline2satrec(s.tle1, s.tle2);
      } catch { continue; }
      if (!satrec || satrec.error) continue;
      this.satrecs.set(s.id, satrec);

      const position = this._buildSampledPosition(satrec, now, stop);
      if (!position) continue;

      const color = s.critical ? '#FF5F63' : '#64F0C8';
      const ent = this.viewer.entities.add({
        id: `sat-${s.id}`,
        position,
        orientation: new Cesium.VelocityOrientationProperty(position),
        point: {
          pixelSize: 6,
          color: Cesium.Color.fromCssColorString(color),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
        },
        label: {
          text: s.name,
          font: '10px "IBM Plex Mono"',
          fillColor: Cesium.Color.fromCssColorString(color),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          pixelOffset: new Cesium.Cartesian2(10, -6),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 20_000_000),
        },
        path: {
          resolution: 120,
          width: 1,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.18,
            color: Cesium.Color.fromCssColorString(color).withAlpha(0.55),
          }),
          leadTime: 60 * 30,   // 30 min ahead
          trailTime: 60 * 30,  // 30 min behind
        },
      });
      ent._cruxMeta = { kind: 'satellite', ...s };
      this.entities.push(ent);
    }
  }

  _buildSampledPosition(satrec, start, stop) {
    const position = new Cesium.SampledPositionProperty();
    const stepSec = 30; // one sample every 30s
    const totalSec = Cesium.JulianDate.secondsDifference(stop, start);
    for (let t = 0; t <= totalSec; t += stepSec) {
      const when = Cesium.JulianDate.addSeconds(start, t, new Cesium.JulianDate());
      const jsDate = Cesium.JulianDate.toDate(when);
      let pv;
      try {
        pv = window.satellite.propagate(satrec, jsDate);
      } catch { return null; }
      if (!pv || !pv.position) continue;
      const gmst = window.satellite.gstime(jsDate);
      const geo = window.satellite.eciToGeodetic(pv.position, gmst);
      const lonDeg = window.satellite.degreesLong(geo.longitude);
      const latDeg = window.satellite.degreesLat(geo.latitude);
      const hM = geo.height * 1000;
      position.addSample(when, Cesium.Cartesian3.fromDegrees(lonDeg, latDeg, hM));
    }
    position.setInterpolationOptions({
      interpolationDegree: 2,
      interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
    });
    return position;
  }

  _extractTLEs(data) {
    // Accept shapes:
    // data.space = { satellites: [{name, tle1, tle2, noradId, operator, critical}] }
    // data.space = [ {...} ]
    // data.satellites = [...]
    const raw = data?.space?.satellites
              || data?.space
              || data?.satellites
              || [];
    const list = Array.isArray(raw) ? raw : (raw?.satellites || []);
    return list
      .filter(s => s && s.tle1 && s.tle2)
      .map(s => ({
        id: s.noradId || s.id || s.name,
        name: s.name || `SAT-${s.noradId || '?'}`,
        tle1: s.tle1,
        tle2: s.tle2,
        noradId: s.noradId,
        operator: s.operator,
        classification: s.classification,
        critical: !!(s.critical || /MAXAR|CAPELLA|PERSONA|TOPAZ|USA-234|GAOFEN/i.test(s.name || '')),
      }));
  }

  clear() {
    for (const e of this.entities) {
      try { this.viewer.entities.remove(e); } catch {}
    }
    this.entities = [];
    this.satrecs.clear();
  }
}
