// S.O.N Worldview — Shader Presets
// Cycles four post-process stages on number keys 0-4:
//   0 = clean (default)
//   1 = NVG  (night vision green tint, gain noise, bloom)
//   2 = FLIR (thermal LUT, edge enhance, contrast lift)
//   3 = CRT  (scanlines, chromatic aberration, vignette, optional pixelation)
//   4 = OPS  (Strands tactical: desaturated, contrast lift, Hanko red highlights)
//
// Per RECON_SPRINT_ARCHITECTURE 2026-04-30 Section 2.2 + Addendum A1.4.
// Cesium 1.124 — GLSL ES 3.0 (in/out, texture() not texture2D()).

const NVG_FS = /* glsl */`
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;
float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  // Convert to luminance — NVG tubes don't see colour
  float l = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  // Boost highlights for the classic NVG bloom feel
  l = pow(l, 0.7);
  // Phosphor green tint
  vec3 nvg = vec3(l * 0.10, l * 1.05, l * 0.30);
  // Gain noise — coarse film-grain pattern, animated would need a uniform but
  // a static seed off the texcoords gives the right visual texture.
  float noise = rand(v_textureCoordinates * 1500.0) * 0.18;
  nvg += vec3(noise * 0.05, noise * 0.18, noise * 0.06);
  // Subtle vignette so the edges of the tube fade
  vec2 c = v_textureCoordinates - vec2(0.5);
  float v = 1.0 - dot(c, c) * 0.6;
  nvg *= v;
  out_FragColor = vec4(nvg, color.a);
}
`;

const FLIR_FS = /* glsl */`
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;
// Thermal LUT — cool blue → green → yellow → orange → red → white-hot
vec3 thermalLUT(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.20) return mix(vec3(0.0, 0.0, 0.10), vec3(0.0, 0.0, 0.55), t / 0.20);
  if (t < 0.40) return mix(vec3(0.0, 0.0, 0.55), vec3(0.0, 0.55, 0.20), (t - 0.20) / 0.20);
  if (t < 0.60) return mix(vec3(0.0, 0.55, 0.20), vec3(0.95, 0.85, 0.10), (t - 0.40) / 0.20);
  if (t < 0.80) return mix(vec3(0.95, 0.85, 0.10), vec3(0.95, 0.30, 0.05), (t - 0.60) / 0.20);
  return mix(vec3(0.95, 0.30, 0.05), vec3(1.0, 1.0, 0.95), (t - 0.80) / 0.20);
}
void main() {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  // Sample neighbours for edge enhancement (cheap Sobel-lite)
  vec2 px = vec2(1.0 / 1920.0, 1.0 / 1080.0);
  float lc = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  float lx = dot(texture(colorTexture, v_textureCoordinates + vec2(px.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
  float ly = dot(texture(colorTexture, v_textureCoordinates + vec2(0.0, px.y)).rgb, vec3(0.299, 0.587, 0.114));
  float edge = abs(lc - lx) + abs(lc - ly);
  // Map luminance to thermal LUT, lift edges slightly
  float t = pow(lc, 0.85) + edge * 0.5;
  out_FragColor = vec4(thermalLUT(t), color.a);
}
`;

const CRT_FS = /* glsl */`
uniform sampler2D colorTexture;
uniform float u_pixelation;  // 0..8 — 0 = off, 8 = chunky CCTV
in vec2 v_textureCoordinates;
void main() {
  vec2 uv = v_textureCoordinates;
  // Pixelation: integer-quantize UVs at the requested resolution divisor
  if (u_pixelation > 0.5) {
    float step = u_pixelation / 540.0; // 540 ~= half the typical viewport height
    uv = floor(uv / step) * step + step * 0.5;
  }
  // Chromatic aberration — sample R/G/B at slightly different offsets
  vec2 ab = (uv - 0.5);
  float r = texture(colorTexture, uv + ab * 0.005).r;
  float g = texture(colorTexture, uv).g;
  float b = texture(colorTexture, uv - ab * 0.005).b;
  vec3 col = vec3(r, g, b);
  // Scanlines — every other line darkened
  float scan = 0.86 + 0.14 * sin(uv.y * 1080.0 * 3.14159);
  col *= scan;
  // Vignette
  vec2 c = uv - vec2(0.5);
  float v = 1.0 - dot(c, c) * 0.85;
  col *= v;
  out_FragColor = vec4(col, 1.0);
}
`;

const OPS_FS = /* glsl */`
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;
void main() {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  // Tactical desaturation — drop saturation by 50%
  float l = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 col = mix(color.rgb, vec3(l), 0.5);
  // Contrast lift — push midtones away from 0.5
  col = (col - 0.5) * 1.18 + 0.5;
  // Hanko red criticality — bias warm tones toward seal red (#D4593C ≈ 0.83, 0.35, 0.24)
  float warm = max(0.0, col.r - col.b);
  col.r += warm * 0.10;
  col.g -= warm * 0.05;
  col.b -= warm * 0.08;
  out_FragColor = vec4(col, color.a);
}
`;

export class ShaderPresets {
  constructor(viewer, opts = {}) {
    this.viewer = viewer;
    this.stages = {};        // name -> PostProcessStage
    this.activeName = 'clean';
    this.crtPixelation = opts.crtPixelation ?? 0;
    this._init();
    this._wireKeys();
  }

  _make(name, fragmentShader, uniforms = {}) {
    const stage = new Cesium.PostProcessStage({
      name: `son_${name}`,
      fragmentShader,
      uniforms,
    });
    stage.enabled = false;
    this.viewer.scene.postProcessStages.add(stage);
    this.stages[name] = stage;
  }

  _init() {
    this._make('nvg',  NVG_FS);
    this._make('flir', FLIR_FS);
    this._make('crt',  CRT_FS, { u_pixelation: this.crtPixelation });
    this._make('ops',  OPS_FS);
  }

  _wireKeys() {
    window.addEventListener('keydown', (e) => {
      // Don't fire while typing in the chat input or any text field
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case '0': this.set('clean'); break;
        case '1': this.set('nvg'); break;
        case '2': this.set('flir'); break;
        case '3': this.set('crt'); break;
        case '4': this.set('ops'); break;
        // CRT pixelation sub-toggle: + / - cycles 0 → 2 → 4 → 6 → 8 → 0
        case '+':
        case '=':
          if (this.activeName === 'crt') {
            this.setCrtPixelation(Math.min(8, this.crtPixelation + 2));
          }
          break;
        case '-':
        case '_':
          if (this.activeName === 'crt') {
            this.setCrtPixelation(Math.max(0, this.crtPixelation - 2));
          }
          break;
      }
    });
  }

  set(name) {
    const valid = ['clean', 'nvg', 'flir', 'crt', 'ops'];
    if (!valid.includes(name)) return;
    for (const [n, stage] of Object.entries(this.stages)) {
      stage.enabled = (n === name);
    }
    this.activeName = name;
    // Surface in window for chat tools / debug
    if (window.son) window.son.shader = name;
    console.log(`[S.O.N] Shader: ${name.toUpperCase()}${name === 'crt' && this.crtPixelation > 0 ? ` · px ${this.crtPixelation}` : ''}`);
  }

  setCrtPixelation(level) {
    this.crtPixelation = Math.max(0, Math.min(8, level));
    if (this.stages.crt) {
      this.stages.crt.uniforms.u_pixelation = this.crtPixelation;
    }
    console.log(`[S.O.N] CRT pixelation: ${this.crtPixelation}`);
  }

  current() { return this.activeName; }
}
