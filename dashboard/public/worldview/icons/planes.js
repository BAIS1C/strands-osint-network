// S.O.N Worldview — Plane icon SVGs as data URLs
// Two silhouettes:
//   CIVILIAN_PLANE:  classic top-down airliner with swept wings
//   MILITARY_PLANE:  fighter jet silhouette, slightly more aggressive
// Both fill="#FFFFFF" so Cesium billboard `color` tints work cleanly.
// Canonical orientation: nose pointing UP (north). Apply rotation = -heading
// in the renderer so live aircraft heading drives the icon direction.

function svgDataUrl(svg) {
  // URL-encode an inline SVG so it can be used as a Cesium billboard image.
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Civilian airliner — classic Google Maps plane, top-down, nose up
const CIVILIAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
<path fill="#FFFFFF" stroke="#0B1E19" stroke-width="0.6" stroke-linejoin="round"
      d="M12 1.5 L12.7 8.0 L22 12.5 L22 13.5 L12.7 12.0 L12.7 18.5 L15 19.8 L15 20.8 L12 20 L9 20.8 L9 19.8 L11.3 18.5 L11.3 12.0 L2 13.5 L2 12.5 L11.3 8.0 Z"/>
</svg>`;

// Military fighter — sharper swept-back wings, longer nose, taller tail
const MILITARY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
<path fill="#FFFFFF" stroke="#0B1E19" stroke-width="0.6" stroke-linejoin="round"
      d="M12 0.8 L12.6 9.0 L21.5 13.0 L21.5 14.2 L12.6 12.4 L12.4 17.0 L16 19.0 L16 20.0 L12 18.6 L8 20.0 L8 19.0 L11.6 17.0 L11.4 12.4 L2.5 14.2 L2.5 13.0 L11.4 9.0 Z"/>
</svg>`;

export const CIVILIAN_PLANE_ICON = svgDataUrl(CIVILIAN_SVG);
export const MILITARY_PLANE_ICON = svgDataUrl(MILITARY_SVG);

// Convenience for renderers — translates an OpenSky-style heading (degrees,
// 0=N, 90=E, clockwise) into the radians value Cesium's billboard.rotation
// expects. Negative because Cesium's screen-space rotation is counter-clockwise
// while compass heading is clockwise. The icon's nose-up baseline cancels out.
export function headingToRotation(headingDegrees) {
  if (typeof headingDegrees !== 'number' || isNaN(headingDegrees)) return 0;
  return -((headingDegrees * Math.PI) / 180);
}
