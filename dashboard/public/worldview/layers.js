// S.O.N Worldview — Layer Manager
// Registers data layers, builds the toggle UI with checkboxes, tracks
// Cesium entities per layer, and re-renders on sweep refresh.

export class LayerManager {
  constructor(viewer, listEl) {
    this.viewer = viewer;
    this.listEl = listEl;
    this.layers = new Map();     // id -> Layer
    this.order = [];             // registration order
  }

  register(def) {
    const layer = new Layer(this.viewer, def);
    this.layers.set(def.id, layer);
    this.order.push(def.id);
    this._renderRow(layer);
    return layer;
  }

  get(id) { return this.layers.get(id); }
  list() {
    return this.order.map(id => {
      const l = this.layers.get(id);
      return { id, label: l.label, on: l.on, count: l.count(), critical: !!l.critical };
    });
  }

  toggle(id, force) {
    const layer = this.layers.get(id);
    if (!layer) return false;
    const next = typeof force === 'boolean' ? force : !layer.on;
    layer.setOn(next);
    this._syncRow(layer);
    // Re-render if toggling back on and we have current sweep cached
    if (next && window.son?.state?.data) {
      layer.render(window.son.state.data);
    } else if (!next) {
      layer.clearEntities();
    }
    return true;
  }

  refreshAll(data) {
    for (const id of this.order) {
      const layer = this.layers.get(id);
      if (layer.on) layer.render(data);
      this._syncRow(layer);
    }
  }

  _renderRow(layer) {
    const row = document.createElement('div');
    row.className = 'layer' + (layer.critical ? ' critical' : '');
    row.dataset.layer = layer.id;
    if (layer.on) row.classList.add('on');
    row.innerHTML = `
      <div class="layer-check" data-check></div>
      <div class="layer-glyph">${layer.glyph}</div>
      <div class="layer-name">${layer.label}<small>${layer.sub || ''}</small></div>
      <div class="layer-count" data-count>—</div>
    `;
    row.addEventListener('click', () => this.toggle(layer.id));
    this.listEl.appendChild(row);
    layer._row = row;
  }

  _syncRow(layer) {
    const row = layer._row;
    if (!row) return;
    const count = row.querySelector('[data-count]');
    if (count) count.textContent = layer.count() || '—';
    row.classList.toggle('on', layer.on);
  }
}

class Layer {
  constructor(viewer, def) {
    this.viewer = viewer;
    this.id = def.id;
    this.label = def.label;
    this.sub = def.sub || '';
    this.glyph = def.glyph || '•';
    this.critical = !!def.critical;
    this.on = def.on !== false ? (def.on === true) : false;
    // Default: only chokepoints on, everything else off unless explicitly on
    if (def.on === undefined) {
      this.on = ['chokepoints'].includes(def.id);
    } else {
      this.on = !!def.on;
    }
    this._render = def.render;                 // (data) => void — custom full-control
    this._renderFromSweep = def.renderFromSweep; // (layer, data) => void
    this._source = def.source;                 // optional data key hint
    this.entities = [];
  }

  count() { return this.entities.length; }

  setOn(v) { this.on = !!v; }

  addEntity(spec) {
    const meta = spec.meta;
    delete spec.meta;
    const entity = this.viewer.entities.add(spec);
    entity._cruxMeta = meta;
    entity._cruxLayer = this.id;
    this.entities.push(entity);
    return entity;
  }

  clearEntities() {
    for (const e of this.entities) {
      try { this.viewer.entities.remove(e); } catch {}
    }
    this.entities = [];
  }

  render(data) {
    this.clearEntities();
    try {
      if (typeof this._render === 'function') {
        this._render(data);
      } else if (typeof this._renderFromSweep === 'function') {
        this._renderFromSweep(this, data);
      }
    } catch (e) {
      console.warn(`[layer:${this.id}] render error:`, e);
    }
  }
}
