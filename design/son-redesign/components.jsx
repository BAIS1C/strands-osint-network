/* SON redesign — shared components */

const Icon = ({ d, size = 14 }) => (
  <span className="i" style={{ fontSize: size }}>
    <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: d }} />
  </span>
);

// Minimal stroke-icon paths (24x24)
const ICONS = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/>',
  feed: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  chat: '<path d="M21 12a8 8 0 1 1-3-6.2L21 4l-1 4.4A8 8 0 0 1 21 12z"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.8a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.5a7 7 0 0 0-2 1.2l-2.3-.8-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.8a7 7 0 0 0 2 1.2L10 21h4l.6-2.5a7 7 0 0 0 2-1.2l2.3.8 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
  power: '<path d="M12 3v9M5 8a8 8 0 1 0 14 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/>',
  pin: '<path d="M12 22v-7M9 3h6l-1 6 4 3v2H6v-2l4-3-1-6z"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  collapse: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  chevL: '<path d="M14 6l-6 6 6 6"/>',
  chevR: '<path d="M10 6l6 6-6 6"/>',
  chevU: '<path d="M6 14l6-6 6 6"/>',
  chevD: '<path d="M6 10l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/>',
  pause: '<path d="M9 4v16M15 4v16"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  mute: '<path d="M3 10v4h4l5 4V6L7 10z"/><path d="M16 9l4 6M20 9l-4 6"/>',
  cam: '<path d="M3 7h13l4-3v16l-4-3H3z"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.1"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  filter: '<path d="M4 4h16l-6 8v6l-4 2v-8z"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  region: '<path d="M5 5h14v14H5z"/><path d="M9 9h6v6H9z" stroke-dasharray="2 2"/>',
  flash: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  layers2: '<path d="M12 3l9 5-9 5-9-5z"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  download: '<path d="M12 4v12M6 12l6 6 6-6M4 21h16"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9 2 2-2 2 2 2-3 3-2-2-3 3"/>',
  dot: '<circle cx="12" cy="12" r="3"/>',
  shield: '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 13v.1M15 13v.1M12 4v4M8 8h8"/>',
};

const Ico = ({ name, size }) => <Icon d={ICONS[name] || ''} size={size} />;

// 13 OSINT layers
const LAYERS = [
  { id: 'mil', tag: 'MIL', kind: 'kin', name: 'Military Flights', count: 47, status: 'key', src: 'ADS-B Exchange' },
  { id: 'hot', tag: 'HOT', kind: 'kin', name: 'Thermal Anomalies', count: 312, status: 'key', src: 'NASA FIRMS' },
  { id: 'war', tag: 'WAR', kind: 'kin', name: 'Conflict Events', count: 89, status: 'key', src: 'ACLED' },
  { id: 'gps', tag: 'GPS', kind: 'kin', name: 'GPS Jamming', count: 23, status: 'ok',  src: 'GPSJam' },
  { id: 'net', tag: 'NET', kind: 'kin', name: 'Internet Blackouts', count: 4, status: 'deg', src: 'Cloudflare Radar' },
  { id: 'sat', tag: 'SAT', kind: 'pas', name: 'Satellite Passes', count: 1147, status: 'ok', src: 'CelesTrak' },
  { id: 'air', tag: 'AIR', kind: 'pas', name: 'Commercial Aircraft', count: 614, status: 'ok', src: 'OpenSky' },
  { id: 'sea', tag: 'SEA', kind: 'pas', name: 'Maritime AIS', count: 8203, status: 'key', src: 'AISStream' },
  { id: 'rss', tag: 'RSS', kind: 'pas', name: 'News Events', count: 142, status: 'ok', src: 'GDELT + 14 RSS' },
  { id: 'soc', tag: 'SOC', kind: 'pas', name: 'Social Signals', count: 76, status: 'deg', src: 'Bluesky / Reddit' },
  { id: 'asp', tag: 'ASP', kind: 'pas', name: 'Airspace Closures', count: 12, status: 'ok', src: 'NOTAM' },
  { id: 'chk', tag: 'CHK', kind: 'pas', name: 'Chokepoints', count: 9, status: 'ok', src: 'Curated' },
  { id: 'cam', tag: 'CAM', kind: 'pas', name: 'Public CCTV', count: 27, status: 'ok', src: 'YouTube + curated' },
];

// ─────────────────────────────────────────
// LAYER PANEL
// ─────────────────────────────────────────
function LayerPanel({ activeLayers, toggleLayer, collapsed, onCollapse }) {
  if (collapsed) {
    return (
      <div className="son-panel son-panel--collapsed">
        <div className="son-panel-head">
          <span>Layers · {activeLayers.length}/{LAYERS.length}</span>
          <button className="son-panel-collapse" onClick={onCollapse} title="Expand"><Ico name="chevR" size={14}/></button>
        </div>
      </div>
    );
  }
  const kin = LAYERS.filter(l => l.kind === 'kin');
  const pas = LAYERS.filter(l => l.kind === 'pas');
  return (
    <div className="son-panel">
      <div className="son-panel-head">
        <Ico name="layers" size={12}/>
        <span>Intelligence Layers</span>
        <div className="son-panel-head-actions">
          <button className="son-panel-collapse" title="Settings"><Ico name="settings" size={12}/></button>
          <button className="son-panel-collapse" onClick={onCollapse} title="Collapse"><Ico name="chevL" size={14}/></button>
        </div>
      </div>
      <div className="son-panel-body">
        <input className="ew-input" placeholder="search 13 layers…" style={{height:30, fontSize:'var(--ew-text-xs)', marginBottom:'var(--ew-space-3)'}}/>
        <div className="son-panel-section">
          <div className="son-panel-section-label">
            <span style={{color:'var(--ew-danger)'}}>●</span>
            <span>Kinetic · 5</span>
            <span style={{marginLeft:'auto', color:'var(--ew-text-faint)'}}>{kin.filter(l=>activeLayers.includes(l.id)).length} on</span>
          </div>
          {kin.map(l => <LayerRow key={l.id} layer={l} active={activeLayers.includes(l.id)} onToggle={() => toggleLayer(l.id)}/>)}
        </div>
        <div className="son-panel-section">
          <div className="son-panel-section-label">
            <span style={{color:'var(--ew-success)'}}>●</span>
            <span>Passive · 8</span>
            <span style={{marginLeft:'auto', color:'var(--ew-text-faint)'}}>{pas.filter(l=>activeLayers.includes(l.id)).length} on</span>
          </div>
          {pas.map(l => <LayerRow key={l.id} layer={l} active={activeLayers.includes(l.id)} onToggle={() => toggleLayer(l.id)}/>)}
        </div>
        <div className="son-panel-section">
          <div className="son-panel-section-label"><span>Region</span></div>
          <button className="son-pull-btn" style={{width:'100%', justifyContent:'center', marginBottom:6}}>
            <span className="dot"/><Ico name="flash" size={11}/> Pull Live (global)
          </button>
          <button className="son-pull-btn" style={{width:'100%', justifyContent:'center', borderColor:'var(--ew-primary)', color:'var(--ew-primary)'}}>
            <Ico name="region" size={11}/> Pull Region (viewport)
          </button>
        </div>
      </div>
    </div>
  );
}

function LayerRow({ layer, active, onToggle }) {
  return (
    <div className={"son-layer-row" + (active ? ' son-layer-on' : '')} onClick={onToggle}>
      <input type="checkbox" className="ew-check" checked={active} onChange={onToggle} onClick={e=>e.stopPropagation()}/>
      <span className={"son-layer-status son-status--" + layer.status} title={layer.status}/>
      <span className={"son-layer-tag son-layer-tag--" + layer.kind}>{layer.tag}</span>
      <span className="son-layer-name">{layer.name}</span>
      <span className="son-layer-count">{layer.count.toLocaleString()}</span>
      <Ico name="chevR" size={10}/>
    </div>
  );
}

// ─────────────────────────────────────────
// GLOBE — stylized SVG placeholder
// ─────────────────────────────────────────
function GlobeSVG({ density = 60 }) {
  // Generate points around a sphere projection (random but deterministic)
  const pts = React.useMemo(() => {
    const arr = [];
    let s = 7;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < density; i++) {
      const lat = (rnd() - 0.5) * 140;
      const lon = (rnd() - 0.5) * 280;
      const r = 0.42;
      const x = 0.5 + r * Math.cos(lat * Math.PI/180) * Math.sin(lon * Math.PI/180);
      const y = 0.5 + r * Math.sin(lat * Math.PI/180);
      const z = Math.cos(lat * Math.PI/180) * Math.cos(lon * Math.PI/180);
      const kind = rnd();
      const layer = kind < 0.18 ? 'mil' : kind < 0.32 ? 'hot' : kind < 0.42 ? 'war'
        : kind < 0.6 ? 'air' : kind < 0.78 ? 'sea' : kind < 0.88 ? 'sat' : 'cam';
      arr.push({ x, y, z, layer });
    }
    return arr;
  }, [density]);

  const colorOf = (l) => {
    if (l === 'mil' || l === 'hot' || l === 'war') return 'var(--ew-danger)';
    if (l === 'air' || l === 'sat') return 'var(--ew-info)';
    if (l === 'sea') return 'var(--ew-primary)';
    return 'var(--ew-warm)';
  };

  return (
    <svg className="son-globe-svg" viewBox="0 0 100 100">
      <defs>
        <radialGradient id="globeAtm" cx="50%" cy="50%" r="50%">
          <stop offset="80%" stopColor="transparent"/>
          <stop offset="92%" stopColor="var(--ew-primary)" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="var(--ew-primary)" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="globeShade" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="var(--ew-surface-raised)"/>
          <stop offset="70%" stopColor="var(--ew-surface)"/>
          <stop offset="100%" stopColor="var(--ew-bg)"/>
        </radialGradient>
        <pattern id="terr" x="0" y="0" width="2" height="2" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="transparent"/>
          <rect width="0.5" height="0.5" fill="var(--ew-text-muted)" fillOpacity="0.18"/>
        </pattern>
      </defs>
      {/* Atmosphere glow */}
      <circle cx="50" cy="50" r="48" fill="url(#globeAtm)"/>
      {/* Sphere */}
      <circle cx="50" cy="50" r="42" fill="url(#globeShade)" stroke="var(--ew-border-strong)" strokeWidth="0.2"/>
      {/* Latitude lines */}
      {[-60,-30,0,30,60].map(lat => {
        const y = 50 + 42 * Math.sin(lat*Math.PI/180);
        const rx = 42 * Math.cos(lat*Math.PI/180);
        return <ellipse key={lat} cx="50" cy={y} rx={rx} ry={rx*0.08+0.4} fill="none" stroke="var(--ew-text)" strokeOpacity="0.08" strokeWidth="0.15"/>;
      })}
      {/* Longitude lines */}
      {[-60,-30,0,30,60].map(lon => {
        const rx = 42 * Math.abs(Math.sin(lon*Math.PI/180)) || 0.1;
        return <ellipse key={lon} cx="50" cy="50" rx={rx} ry="42" fill="none" stroke="var(--ew-text)" strokeOpacity="0.08" strokeWidth="0.15"/>;
      })}
      {/* Continents — abstracted blobs */}
      <g fill="url(#terr)" stroke="var(--ew-primary)" strokeOpacity="0.35" strokeWidth="0.15">
        <path d="M28 36 q4 -6 12 -6 q8 0 10 6 q-2 8 -8 10 q-10 -2 -14 -10z"/>
        <path d="M44 28 q8 -2 14 4 q4 8 -2 14 q-10 4 -16 -2 q-2 -10 4 -16z"/>
        <path d="M58 38 q8 0 12 8 q-2 12 -10 14 q-8 -2 -10 -10 q0 -8 8 -12z"/>
        <path d="M30 56 q8 -2 14 4 q-2 10 -10 12 q-8 -2 -8 -10 q0 -4 4 -6z"/>
        <path d="M52 60 q10 -2 14 6 q-4 10 -12 10 q-8 -2 -6 -12 q0 -2 4 -4z"/>
      </g>
      {/* Event dots */}
      {pts.filter(p => p.z > 0).map((p, i) => (
        <g key={i}>
          <circle cx={p.x*100} cy={p.y*100} r="0.5" fill={colorOf(p.layer)} opacity="0.4"/>
          <circle cx={p.x*100} cy={p.y*100} r="0.9" fill={colorOf(p.layer)}>
            <animate attributeName="opacity" values="1;0.3;1" dur={(2+i%4)+"s"} repeatCount="indefinite"/>
          </circle>
        </g>
      ))}
      {/* Hot zones */}
      <g fill="none" stroke="var(--ew-danger)" strokeWidth="0.3" strokeDasharray="0.8 0.8" opacity="0.6">
        <circle cx="59" cy="44" r="3"/>
        <circle cx="55" cy="46" r="2"/>
      </g>
    </svg>
  );
}

function GlobeStage({ shader, setShader }) {
  return (
    <div className="son-globe-stage">
      <div className="son-globe-overlay-top">
        <div className="son-globe-title">
          <Ico name="globe" size={12}/>
          <span>Global Situation</span>
          <span style={{color:'var(--ew-text-faint)', marginLeft:8}}>SAT, 09 MAY 2026 · 02:14:08 UTC</span>
        </div>
        <div style={{flex:1}}/>
        <div className="son-globe-mode">
          <button className="on">3D</button>
          <button>2D</button>
          <button>CV</button>
        </div>
        <div style={{display:'inline-flex', gap:0, border:'1px solid var(--ew-border-strong)'}}>
          {['0','1','2','3','4'].map(n => (
            <button key={n} onClick={()=>setShader(n)}
              style={{padding:'2px 8px', fontFamily:'var(--ew-font-mono)', fontSize:'var(--ew-text-xs)',
                background: shader===n ? 'var(--ew-primary)' : 'transparent',
                color: shader===n ? 'var(--ew-primary-fg)' : 'var(--ew-text-muted)',
                border:'none', cursor:'pointer'}}>
              {n}·{['CLN','NVG','FLR','CRT','OPS'][n]}
            </button>
          ))}
        </div>
      </div>
      <div className="son-globe">
        <div className="son-globe-grid"/>
        <GlobeSVG/>
      </div>
      <div className="son-globe-zoom">
        <button><Ico name="plus" size={12}/></button>
        <button><Ico name="minus" size={12}/></button>
        <button><Ico name="reset" size={12}/></button>
      </div>
      <div className="son-globe-overlay-bottom">
        <SweepStrip/>
        <div className="son-globe-attr">© Cesium · Google 3D Tiles · ESRI · OpenStreetMap</div>
      </div>
    </div>
  );
}

function SweepStrip() {
  // 29 sources across health states
  const segments = [
    { kind: 'ok',   n: 18, label: 'OK' },
    { kind: 'key',  n: 6,  label: 'KEY-GATED' },
    { kind: 'deg',  n: 3,  label: 'DEGRADED' },
    { kind: 'fail', n: 2,  label: 'FAILED' },
  ];
  const total = segments.reduce((a,b)=>a+b.n,0);
  let acc = 0;
  return (
    <div className="son-sweep" style={{flex:1, maxWidth:560}}>
      <span style={{fontFamily:'var(--ew-font-mono)', fontSize:10, letterSpacing:'var(--ew-track-wider)', textTransform:'uppercase', color:'var(--ew-text-muted)'}}>
        Sweep · t-08m32s
      </span>
      <div className="son-sweep-bar">
        {segments.map((s,i) => {
          const left = (acc/total)*100;
          const w = (s.n/total)*100;
          acc += s.n;
          return <div key={i} className={"seg "+s.kind} style={{left: left+'%', width: w+'%'}} title={`${s.n} ${s.label}`}/>;
        })}
      </div>
      <div className="son-sweep-counts">
        {segments.map(s => (
          <span key={s.kind} className="c">
            <span className="dot" style={{background: s.kind==='ok' ? 'var(--ew-success)' : s.kind==='fail' ? 'var(--ew-danger)' : 'var(--ew-warning)'}}/>
            {s.n} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// FEED RAIL (right side)
// ─────────────────────────────────────────
const NEWS_SRC = ['BLOOMBERG','SKYNEWS','EURONEWS','DW','CNBC','CNN','FRANCE24','AL JAZEERA','REUTERS'];
const NEWS = [
  { src:'REUTERS',  sev:'high', title:'Strait of Hormuz: AIS spike — three tankers reroute around chokepoint', loc:'PERSIAN GULF', t:'2m', snippet:'Maritime transponder data shows three Suezmax-class tankers altering course south of Larak Island within the last hour.' },
  { src:'GDELT',    sev:'med',  title:'Wildfire perimeter expands 12% overnight near Athens metro', loc:'ATTICA, GR', t:'9m', snippet:'NASA FIRMS picks 47 new thermal anomalies in a 14km arc; ACLED has not flagged conflict use.' },
  { src:'BLOOMBERG',sev:'med',  title:'Brent +3.4% on Hormuz traffic disruption rumours',           loc:'GLOBAL',     t:'14m', snippet:'Spot crude moved on weekend volume; equity futures lagging.' },
  { src:'SKYNEWS',  sev:'low',  title:'NOTAM: NATO joint air exercise restricts FL280-FL410 over Baltic',loc:'BALTIC',  t:'21m', snippet:'Airspace restriction valid 09 MAY 04:00z — 11 MAY 22:00z.' },
  { src:'CNBC',     sev:'high', title:'GPS jamming corridor reactivated along Black Sea littoral',  loc:'BLACK SEA',  t:'34m', snippet:'GPSJam H3 tile density up sharply; AIS gaps reported by 11 vessels in a 90 nm arc.' },
  { src:'AL JAZEERA',sev:'low', title:'Sudan: humanitarian convoy reaches Wadi Halfa border crossing',loc:'SUDAN',     t:'47m', snippet:'ReliefWeb and ACLED both confirm; first cross-border movement in 9 days.' },
];

function FeedRail({ sectionStates, toggleSection }) {
  return (
    <div className="son-rail">
      <RailSection id="news" title="Live News" count={93} sectionStates={sectionStates} toggleSection={toggleSection} grow="0">
        <div className="son-rail-tabs">
          {NEWS_SRC.map((s,i) => <button key={s} className={"son-rail-tab" + (i===1 ? ' on' : '')}>{s}</button>)}
        </div>
        <div className="son-rail-body">
          <div className="son-feed-list">
            {NEWS.map((n,i) => (
              <div key={i} className="son-feed-card">
                <div className="son-feed-meta">
                  <span className="src">{n.src}</span>
                  <span>·</span>
                  <span>{n.loc}</span>
                  <span style={{marginLeft:'auto'}}>{n.t}</span>
                  <span className={"sev sev--"+n.sev}>{n.sev}</span>
                </div>
                <div className="son-feed-title">{n.title}</div>
                <div className="son-feed-snippet">{n.snippet}</div>
              </div>
            ))}
          </div>
        </div>
      </RailSection>

      <RailSection id="cctv" title="Live CCTV" count={27} sectionStates={sectionStates} toggleSection={toggleSection} grow="1">
        <div className="son-rail-tabs">
          {['HORMUZ','MIDEAST','EUROPE','AMERICAS','ASIA','SPACE','ALL'].map((s,i) => (
            <button key={s} className={"son-rail-tab" + (i===0 ? ' on' : '')}>{s}</button>
          ))}
        </div>
        <div className="son-rail-body">
          <div className="son-cctv-grid">
            {[
              {label:'TEHRAN', tc:'02:14:08'},
              {label:'TEL AVIV', tc:'02:14:08'},
              {label:'JERUSALEM', tc:'02:14:08'},
              {label:'STR. OF HORMUZ', tc:'02:14:07'},
              {label:'BANDAR ABBAS', tc:'02:14:08'},
              {label:'AL UDEID AB', tc:'02:14:08'},
            ].map((c,i) => (
              <div key={i} className="son-cctv-cell">
                <div className="ph"/>
                <div className="label"><span className="dot"/>{c.label}</div>
                <div className="timecode">{c.tc}</div>
              </div>
            ))}
          </div>
        </div>
      </RailSection>

      <RailSection id="ai" title="AI Insights" count={null} badge="1 NEW" sectionStates={sectionStates} toggleSection={toggleSection} grow="0">
        <div className="son-rail-body" style={{maxHeight:200}}>
          <div className="son-mini-card">
            <div className="head">
              <Ico name="bot" size={10}/>
              <span>Posture · 2m ago</span>
              <span style={{marginLeft:'auto', color:'var(--ew-warm)'}}>DEFCON 3</span>
            </div>
            <div className="body">Hormuz AIS divergence + GPS jamming in Black Sea + Brent +3.4%. Three independent kinetic-adjacent signals within 40 minutes. Recommend pinning chokepoint layer.</div>
          </div>
          <div className="son-mini-card">
            <div className="head">
              <Ico name="bot" size={10}/>
              <span>Strategic · 14m ago</span>
            </div>
            <div className="body">No change to strategic posture. Macro indicators flat; conflict event tempo within 7-day baseline.</div>
          </div>
        </div>
      </RailSection>
    </div>
  );
}

function RailSection({ id, title, count, badge, grow, children, sectionStates, toggleSection }) {
  const open = sectionStates[id] !== false;
  return (
    <div className="son-rail-section" data-grow={open ? grow : '0'} style={{flex: open && grow==='1' ? '1' : '0 0 auto'}}>
      <div className="son-rail-head" onClick={() => toggleSection(id)}>
        <span>{title}</span>
        {count !== null && <span className="count">● {count}</span>}
        {badge && <span style={{color:'var(--ew-warm)', fontFamily:'var(--ew-font-mono)', fontSize:10}}>{badge}</span>}
        <div className="actions">
          <button className="son-panel-collapse" onClick={(e) => { e.stopPropagation(); toggleSection(id); }}>
            <Ico name={open ? 'chevU' : 'chevD'} size={12}/>
          </button>
          <button className="son-panel-collapse" onClick={(e) => e.stopPropagation()}><Ico name="expand" size={12}/></button>
        </div>
      </div>
      {open && children}
    </div>
  );
}

Object.assign(window, { Ico, ICONS, LAYERS, NEWS, NEWS_SRC, LayerPanel, GlobeStage, GlobeSVG, FeedRail, SweepStrip });
