/* SON redesign — screens */

// ─── WORLDVIEW ─────────────────────────────────────────────────
function ScreenWorldview({ tweaks, setTweak }) {
  const [activeLayers, setActiveLayers] = React.useState(['mil','hot','war','sat','air','sea','rss','chk','cam']);
  const [collapseLeft, setCollapseLeft] = React.useState(false);
  const [collapseRight, setCollapseRight] = React.useState(false);
  const [shader, setShader] = React.useState('4');
  const [sectionStates, setSectionStates] = React.useState({ news: true, cctv: true, ai: true });

  const toggleLayer = (id) => setActiveLayers(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  const toggleSection = (id) => setSectionStates(s => ({...s, [id]: !s[id]}));

  return (
    <div className="son-body" data-collapsed-layers={collapseLeft ? '1':'0'} data-collapsed-feeds={collapseRight ? '1':'0'}>
      <LayerPanel activeLayers={activeLayers} toggleLayer={toggleLayer} collapsed={collapseLeft} onCollapse={()=>setCollapseLeft(!collapseLeft)}/>
      <GlobeStage shader={shader} setShader={setShader}/>
      {collapseRight ? (
        <div className="son-panel son-panel--collapsed son-panel--right">
          <div className="son-panel-head">
            <span>Feeds</span>
            <button className="son-panel-collapse" onClick={()=>setCollapseRight(false)}><Ico name="chevL" size={14}/></button>
          </div>
        </div>
      ) : (
        <div className="son-panel son-panel--right" style={{padding:0}}>
          <div className="son-panel-head" style={{padding:'0 var(--ew-space-3)'}}>
            <Ico name="feed" size={12}/>
            <span>Live Feeds</span>
            <div className="son-panel-head-actions">
              <button className="son-panel-collapse" title="Layout"><Ico name="layers2" size={12}/></button>
              <button className="son-panel-collapse" onClick={()=>setCollapseRight(true)} title="Collapse"><Ico name="chevR" size={14}/></button>
            </div>
          </div>
          <div style={{flex:1, minHeight:0, overflow:'hidden'}}>
            <FeedRail sectionStates={sectionStates} toggleSection={toggleSection}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CONSIGLIERE ───────────────────────────────────────────────
function ScreenConsigliere() {
  return (
    <div style={{display:'grid', gridTemplateColumns:'56px 280px 1fr', flex:1, minHeight:0}}>
      <div/>
      <div className="son-panel">
        <div className="son-panel-head"><Ico name="chat" size={12}/><span>Sessions</span></div>
        <div className="son-panel-body" style={{padding:'var(--ew-space-2)'}}>
          {[
            {t:'Hormuz divergence', a:'2m', on:true},
            {t:'Brent vol replay', a:'1h', on:false},
            {t:'GPS jamming corridor', a:'5h', on:false},
            {t:'ISS pass — Singapore', a:'1d', on:false},
            {t:'NK launch posture brief', a:'2d', on:false},
          ].map((s,i) => (
            <div key={i} className={"ew-list-item" + (s.on ? ' ew-list-item--active' : '')}>
              <Ico name="chat" size={12}/>
              <span>{s.t}</span>
              <span className="ew-list-item-meta">{s.a}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="son-chat">
        <div className="son-chat-head">
          <div style={{flex:1}}>
            <div style={{fontFamily:'var(--ew-font-display)', fontSize:'var(--ew-text-md)', textTransform:'uppercase', letterSpacing:'var(--ew-track-wider)'}}>Consigliere</div>
            <div style={{fontFamily:'var(--ew-font-mono)', fontSize:10, color:'var(--ew-text-faint)', letterSpacing:'var(--ew-track-wider)', textTransform:'uppercase', marginTop:2}}>Hormuz divergence · qwen3-32b · 47k ctx</div>
          </div>
          <span className="son-chat-pill"><span style={{width:6,height:6,borderRadius:'50%', background:'var(--ew-success)', boxShadow:'0 0 6px var(--ew-success)'}}/>LM Studio · ONLINE</span>
        </div>
        <div className="son-chat-body">
          <div className="son-chat-msg son-chat-msg--user">
            <span className="son-chat-byline">Operator · 02:11:42</span>
            <div className="son-chat-bubble">what's happening in hormuz</div>
          </div>
          <div className="son-chat-msg son-chat-msg--ai">
            <span className="son-chat-byline">Consigliere · 02:11:46</span>
            <div className="son-chat-bubble">
              Three signals converging on the Strait in the last 40 minutes:
              <ol style={{margin:'var(--ew-space-2) 0 0', paddingLeft:18, lineHeight:'var(--ew-leading-snug)'}}>
                <li>AIS: three Suezmax tankers altered course south of Larak Island; AIS gaps ~6 minutes on two of them.</li>
                <li>GPS: jamming density increased along the Iranian littoral; H3 tile coverage doubled vs 24h baseline.</li>
                <li>Markets: Brent +3.4% on weekend volume.</li>
              </ol>
              <p style={{marginTop:'var(--ew-space-2)'}}>Pinned the CHK and SEA layers, flew camera to 26.6°N 56.3°E. Posture remains DEFCON 3.</p>
              <div className="son-chat-tools">
                <div className="son-chat-tool"><Ico name="layers2" size={10}/> toggleLayer("CHK", true) <span className="ok">✓</span></div>
                <div className="son-chat-tool"><Ico name="layers2" size={10}/> toggleLayer("SEA", true) <span className="ok">✓</span></div>
                <div className="son-chat-tool"><Ico name="globe" size={10}/> flyTo(26.6, 56.3, 800km) <span className="ok">✓</span></div>
                <div className="son-chat-tool"><Ico name="search" size={10}/> querySource("AISStream", bbox=Hormuz) <span className="ok">3 hits</span></div>
                <div className="son-chat-tool"><Ico name="search" size={10}/> querySource("GPSJam", region=BlackSea+Gulf) <span className="ok">+118%</span></div>
              </div>
              <div className="son-chat-cite">
                <span className="son-chat-cite-chip">[1] AISStream · 02:08z</span>
                <span className="son-chat-cite-chip">[2] GPSJam · 24h</span>
                <span className="son-chat-cite-chip">[3] YFinance BRENT</span>
                <span className="son-chat-cite-chip">[4] GDELT REUTERS</span>
              </div>
            </div>
          </div>
          <div className="son-chat-msg son-chat-msg--user">
            <span className="son-chat-byline">Operator · 02:13:01</span>
            <div className="son-chat-bubble">show me military aircraft over the gulf in the last 2 hours</div>
          </div>
          <div className="son-chat-msg son-chat-msg--ai">
            <span className="son-chat-byline">Consigliere · 02:13:08</span>
            <div className="son-chat-bubble">
              MIL layer pinned. ADS-B Exchange has 11 contacts with military squawks in the bbox over the window — two RC-135s out of Al Udeid, one P-8 Poseidon transit, three KC-135 tankers, and five unidentified squawks consistent with rotary CAP. Filter applied to the globe.
              <div className="son-chat-tools">
                <div className="son-chat-tool"><Ico name="layers2" size={10}/> toggleLayer("MIL", true) <span className="ok">✓ 11 contacts</span></div>
                <div className="son-chat-tool"><Ico name="region" size={10}/> setBBox(24,52,28,58) · 2h <span className="ok">✓</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="son-chat-input-row">
          <button className="ew-btn ew-btn--icon" title="Tools"><Ico name="settings" size={14}/></button>
          <button className="ew-btn ew-btn--icon" title="Pin to globe"><Ico name="pin" size={14}/></button>
          <input className="son-chat-input" placeholder="ask the globe…  ⌘K"/>
          <button className="ew-btn ew-btn--primary"><Ico name="send" size={12}/> Send</button>
        </div>
      </div>
    </div>
  );
}

// ─── INSPECTOR ─────────────────────────────────────────────────
function ScreenInspector() {
  const cards = [
    {layer:'CAM', loc:'TEHRAN',         t:'LIVE', title:'Tehran skyline · municipal cam #14'},
    {layer:'CAM', loc:'TEL AVIV',       t:'LIVE', title:'24/7 multi-cam composite — SGN'},
    {layer:'CAM', loc:'JERUSALEM',      t:'LIVE', title:'Jerusalem skyline — Associated Press'},
    {layer:'CAM', loc:'BANDAR ABBAS',   t:'LIVE', title:'Bandar Abbas port approaches'},
    {layer:'CAM', loc:'AL UDEID',       t:'LIVE', title:'Al Udeid AB perimeter'},
    {layer:'CAM', loc:'STR. HORMUZ',    t:'LIVE', title:'Larak Island traffic camera'},
    {layer:'RSS', loc:'GLOBAL',         t:'2m',   title:'Reuters: AIS spike at Hormuz chokepoint'},
    {layer:'RSS', loc:'GLOBAL',         t:'14m',  title:'Bloomberg: Brent +3.4% on weekend volume'},
    {layer:'SOC', loc:'BLUESKY',        t:'4m',   title:'@osinttechnical: tracking 3 Suezmax course changes'},
  ];
  return (
    <div className="son-inspector">
      <div className="son-insp-filter">
        <div className="ew-eyebrow" style={{marginBottom:'var(--ew-space-3)'}}>Filters</div>
        <div className="ew-field" style={{marginBottom:'var(--ew-space-3)'}}>
          <label className="ew-field-label">Layer</label>
          {['ALL','CAM (27)','RSS (142)','SOC (76)','SAT (1147)','AIR (614)','MIL (47)','SEA (8203)'].map((l,i) => (
            <label key={l} className="ew-inline-field"><input type="checkbox" className="ew-check" defaultChecked={i<4}/>{l}</label>
          ))}
        </div>
        <div className="ew-field" style={{marginBottom:'var(--ew-space-3)'}}>
          <label className="ew-field-label">Region</label>
          <select className="ew-select"><option>Hormuz Strait</option><option>Black Sea</option><option>South China Sea</option><option>Mediterranean</option><option>Bab al-Mandeb</option></select>
        </div>
        <div className="ew-field">
          <label className="ew-field-label">Severity</label>
          <select className="ew-select"><option>All</option><option>High only</option><option>High + Medium</option></select>
        </div>
        <hr/>
        <div className="ew-eyebrow" style={{marginBottom:'var(--ew-space-2)'}}>Sources online</div>
        <div className="son-mini-card" style={{padding:0, border:'none'}}>
          {[
            {n:'YouTube Live', s:'ok'}, {n:'Reuters', s:'ok'}, {n:'Bloomberg', s:'ok'},
            {n:'Bluesky', s:'deg'}, {n:'AISStream', s:'key'}, {n:'NASA FIRMS', s:'key'},
          ].map((src,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:8, padding:'4px 0', fontSize:'var(--ew-text-xs)', fontFamily:'var(--ew-font-mono)'}}>
              <span className={"son-layer-status son-status--"+src.s}/>{src.n}
            </div>
          ))}
        </div>
      </div>
      <div className="son-insp-grid">
        {cards.map((c,i) => (
          <div key={i} className="son-insp-card">
            <div className="son-insp-card-thumb">
              {c.t==='LIVE' && <span className="live">● LIVE</span>}
              <span className="timecode">{c.layer === 'CAM' ? '02:14:08' : c.t}</span>
            </div>
            <div className="son-insp-card-body">
              <div className="son-insp-card-meta">
                <span style={{color:'var(--ew-primary)', fontWeight:700}}>{c.layer}</span>
                <span>·</span><span>{c.loc}</span>
                <span style={{marginLeft:'auto'}}>{c.t}</span>
              </div>
              <div className="son-insp-card-title">{c.title}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="son-insp-detail">
        <div className="ew-eyebrow" style={{marginBottom:'var(--ew-space-2)'}}>Selected · CAM</div>
        <h3 style={{marginBottom:'var(--ew-space-2)'}}>Larak Island</h3>
        <div className="son-insp-card-thumb" style={{marginBottom:'var(--ew-space-3)'}}>
          <span className="live">● LIVE</span>
          <span className="timecode">02:14:08</span>
        </div>
        <div className="son-mini-card" style={{padding:0, border:'none', marginBottom:'var(--ew-space-3)'}}>
          <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:'4px var(--ew-space-3)', fontSize:'var(--ew-text-xs)', fontFamily:'var(--ew-font-mono)'}}>
            <span style={{color:'var(--ew-text-faint)'}}>LAT/LON</span><span>26.852°N · 56.357°E</span>
            <span style={{color:'var(--ew-text-faint)'}}>SOURCE</span><span>YouTube Live · channel UC4Yk</span>
            <span style={{color:'var(--ew-text-faint)'}}>UPTIME</span><span>03:15:52</span>
            <span style={{color:'var(--ew-text-faint)'}}>BITRATE</span><span>1.8 Mbps · 720p30</span>
          </div>
        </div>
        <button className="ew-btn ew-btn--primary" style={{width:'100%', marginBottom:6}}><Ico name="pin" size={12}/> Pin to globe</button>
        <button className="ew-btn" style={{width:'100%', marginBottom:6}}><Ico name="link" size={12}/> Open source</button>
        <button className="ew-btn ew-btn--ghost" style={{width:'100%'}}><Ico name="bell" size={12}/> Subscribe to alerts</button>
      </div>
    </div>
  );
}

// ─── ALERTS ────────────────────────────────────────────────────
function ScreenAlerts() {
  const alerts = [
    {sev:'crit', layer:'WAR', loc:'HORMUZ', t:'2m', title:'Three Suezmax tankers diverge AIS course at chokepoint',
     channels:[{name:'Telegram', state:'sent', when:'02:14:09', msg:'Delivered to 1 chat (-1001234567890)'},
               {name:'Discord',  state:'sent', when:'02:14:09', msg:'Delivered to #ops-alerts'},
               {name:'Webhook',  state:'fail', when:'02:14:11', msg:'connect ETIMEDOUT 100.64.0.4:443'},
               {name:'Email',    state:'muted',when:'—',         msg:'Tier-2 alerts muted in user prefs'}], on:true},
    {sev:'crit', layer:'GPS', loc:'BLACK SEA', t:'34m', title:'GPS jamming corridor reactivated', on:false},
    {sev:'warn', layer:'HOT', loc:'ATTICA, GR', t:'09m', title:'Wildfire perimeter +12% overnight near Athens', on:false},
    {sev:'warn', layer:'NET', loc:'PAKISTAN', t:'1h', title:'Internet blackout — Cloudflare Radar score < 25%', on:false},
    {sev:'info', layer:'SAT', loc:'SINGAPORE', t:'2h', title:'ISS pass: 03:22z, max elev 64°', on:false},
    {sev:'info', layer:'ASP', loc:'BALTIC', t:'21m', title:'NOTAM: NATO joint air exercise · FL280-FL410', on:false},
  ];
  const a = alerts[0];
  return (
    <div className="son-alerts">
      <div className="son-alerts-list">
        <div className="son-rail-head" style={{position:'sticky', top:0, zIndex:2}}>
          <Ico name="bell" size={12}/><span>Alert Console</span>
          <span className="count">● 2 new</span>
        </div>
        <div className="son-rail-tabs" style={{position:'sticky', top:32, zIndex:1}}>
          {['ALL','CRIT (2)','WARN (5)','INFO (12)','MUTED (3)'].map((s,i) => (
            <button key={s} className={"son-rail-tab" + (i===0 ? ' on' : '')}>{s}</button>
          ))}
        </div>
        {alerts.map((al,i) => (
          <div key={i} className={"son-alert-row " + al.sev + (al.on ? ' on' : '')}>
            <div className="bar"/>
            <div>
              <div className="son-alert-meta">
                <span style={{color:'var(--ew-primary)', fontWeight:700}}>{al.layer}</span>
                <span>·</span><span>{al.loc}</span>
                <span style={{marginLeft:'auto'}}>{al.t}</span>
              </div>
              <div className="son-alert-title">{al.title}</div>
              <div className="son-alert-snippet">3 channels delivered · 1 failed · 1 muted</div>
            </div>
          </div>
        ))}
      </div>

      <div className="son-alert-detail">
        <div className="ew-eyebrow">Alert · {a.layer} · {a.loc}</div>
        <div style={{display:'flex', alignItems:'center', gap:12, marginTop:8}}>
          <h2 style={{flex:1}}>{a.title}</h2>
          <span className="ew-badge ew-badge--danger"><span className="ew-badge-dot"/>CRIT</span>
          <span className="ew-badge ew-badge--neutral">02:14:09 UTC</span>
        </div>

        <div className="son-mini-card" style={{padding:'var(--ew-space-4)', background:'var(--ew-surface)', border:'1px solid var(--ew-border)'}}>
          <div style={{fontSize:'var(--ew-text-sm)', color:'var(--ew-text)', lineHeight:'var(--ew-leading-snug)'}}>
            <strong>Trigger:</strong> AIS gap > 4 minutes on 3 vessels in Strait of Hormuz bbox + course delta &gt; 30°.
            <br/><strong>Posture:</strong> moved DEFCON observed → DEFCON 3 (was 4) at 02:13:41 UTC.
            <br/><strong>Recommended:</strong> pin CHK + SEA + MIL layers; query Brent + WTI deltas.
          </div>
        </div>

        <div>
          <div className="ew-eyebrow" style={{marginBottom:'var(--ew-space-2)'}}>Delivery</div>
          <div className="son-delivery-grid">
            {a.channels.map((ch,i) => (
              <div key={i} className="son-delivery-card">
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                  <span style={{fontFamily:'var(--ew-font-mono)', fontSize:'var(--ew-text-sm)', fontWeight:700, letterSpacing:'var(--ew-track-wider)', textTransform:'uppercase'}}>{ch.name}</span>
                  <span className={"son-delivery-state " + ch.state} style={{marginLeft:'auto'}}>
                    <span className="son-layer-status" style={{background: ch.state==='sent'?'var(--ew-success)':ch.state==='fail'?'var(--ew-danger)':ch.state==='queued'?'var(--ew-warning)':'var(--ew-text-faint)'}}/>
                    {ch.state}
                  </span>
                </div>
                <div style={{fontFamily:'var(--ew-font-mono)', fontSize:10, color:'var(--ew-text-faint)', letterSpacing:'var(--ew-track-wider)', marginBottom:4}}>{ch.when}</div>
                <div style={{fontFamily:'var(--ew-font-mono)', fontSize:'var(--ew-text-xs)', color:'var(--ew-text-muted)'}}>{ch.msg}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="ew-eyebrow" style={{marginBottom:'var(--ew-space-2)'}}>Actions</div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button className="ew-btn ew-btn--primary"><Ico name="pin" size={12}/> Pin to globe</button>
            <button className="ew-btn"><Ico name="chat" size={12}/> Open in Consigliere</button>
            <button className="ew-btn"><Ico name="reset" size={12}/> Retry failed (1)</button>
            <button className="ew-btn ew-btn--ghost"><Ico name="bell" size={12}/> Mute layer 1h</button>
            <button className="ew-btn ew-btn--danger">Acknowledge & dismiss</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS ──────────────────────────────────────────────────
function ScreenSettings({ tweaks, setTweak }) {
  const keys = [
    {name:'GOOGLE_MAPS_API_KEY', desc:'Photorealistic 3D Tiles globe basemap',     unlocks:['3D buildings','City zoom'], set:true,  val:'AIza••••••••••••••••••••pK7n', src:'console.cloud.google.com'},
    {name:'ADSB_API_KEY',        desc:'Military aircraft tracking',                 unlocks:['MIL layer'],                set:true,  val:'••••••••••••rx8q',                  src:'rapidapi.com'},
    {name:'AISSTREAM_API_KEY',   desc:'Live maritime AIS via persistent WebSocket', unlocks:['SEA layer'],                set:true,  val:'••••••••••••5h3a',                  src:'aisstream.io'},
    {name:'FIRMS_MAP_KEY',       desc:'NASA fire detection',                        unlocks:['HOT layer'],                set:true,  val:'••••••••••••2qe',                   src:'firms.modaps.eosdis.nasa.gov'},
    {name:'ACLED_EMAIL+PASS',    desc:'Conflict events (academic registration)',    unlocks:['WAR layer'],                set:true,  val:'kasai@strandsnation.xyz · ••••',    src:'acleddata.com'},
    {name:'BLS_API_KEY',         desc:'US Bureau of Labor Statistics',              unlocks:['Macro · CPI/UNEMP'],        set:false, val:'',                                    src:'bls.gov'},
    {name:'OPENSANCTIONS_KEY',   desc:'Sanctions and politically exposed persons',  unlocks:['OFAC search'],              set:false, val:'',                                    src:'data.opensanctions.org'},
    {name:'YOUTUBE_API_KEY',     desc:'Live news TV streams (Al Jazeera, CNBC, …)', unlocks:['10 RSS sources','CCTV+27'], set:true,  val:'AIza••••••••••••••••••••3xRk',     src:'console.cloud.google.com'},
  ];
  return (
    <div className="son-settings">
      <div className="ew-eyebrow">Configuration</div>
      <h2 style={{marginTop:6, marginBottom:4}}>API Keys & Integrations</h2>
      <p className="ew-lead">All keys are optional. S.O.N degrades gracefully when a source is missing — the layer is still listed but tagged <span className="ew-badge ew-badge--warm" style={{marginLeft:4}}>KEY-GATED</span>.</p>

      <div style={{display:'flex', gap:'var(--ew-space-3)', marginTop:'var(--ew-space-5)', alignItems:'center'}}>
        <span className="ew-badge ew-badge--success">{keys.filter(k=>k.set).length}/{keys.length} configured</span>
        <span className="ew-badge ew-badge--warm">{keys.filter(k=>!k.set).length} unset</span>
        <span style={{flex:1}}/>
        <button className="ew-btn"><Ico name="download" size={12}/> Export .env</button>
        <button className="ew-btn ew-btn--primary"><Ico name="reset" size={12}/> Reload config</button>
      </div>

      <div className="son-settings-grid">
        {keys.map((k,i) => (
          <div key={i} className="son-key-card">
            <div className="son-key-card-head">
              <Ico name="key" size={12}/>
              <span className="name">{k.name}</span>
              <span className="badge">{k.set ? <span className="ew-badge ew-badge--success">SET</span> : <span className="ew-badge ew-badge--neutral">UNSET</span>}</span>
            </div>
            <div className="desc">{k.desc}</div>
            <div className="son-key-input">
              <input className="ew-input" type="password" placeholder="paste key…" defaultValue={k.val}/>
              <button className="ew-btn ew-btn--icon" title="Reveal"><Ico name="search" size={12}/></button>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:6, marginTop:'var(--ew-space-2)'}}>
              <span style={{fontFamily:'var(--ew-font-mono)', fontSize:10, color:'var(--ew-text-faint)', letterSpacing:'var(--ew-track-wider)', textTransform:'uppercase'}}>get @ {k.src}</span>
            </div>
            <div className="son-key-unlocks">
              {k.unlocks.map(u => <span key={u} className="ew-badge">{u}</span>)}
            </div>
          </div>
        ))}
      </div>

      <div style={{marginTop:'var(--ew-space-8)'}}>
        <h2>LM Studio</h2>
        <div className="son-key-card" style={{marginTop:'var(--ew-space-3)'}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--ew-space-3)'}}>
            <div className="ew-field">
              <label className="ew-field-label">Endpoint</label>
              <input className="ew-input" defaultValue="http://localhost:1234/v1"/>
            </div>
            <div className="ew-field">
              <label className="ew-field-label">Model</label>
              <input className="ew-input" defaultValue="qwen3-32b-instruct"/>
            </div>
            <div className="ew-field">
              <label className="ew-field-label">Tools</label>
              <select className="ew-select"><option>All 14 enabled</option><option>Read-only</option><option>Disabled</option></select>
            </div>
            <div className="ew-field">
              <label className="ew-field-label">Status</label>
              <div style={{display:'flex', alignItems:'center', gap:8, height:36, padding:'0 var(--ew-space-3)'}}>
                <span className="son-layer-status son-status--ok"/>
                <span style={{fontFamily:'var(--ew-font-mono)', fontSize:'var(--ew-text-xs)', letterSpacing:'var(--ew-track-wider)', textTransform:'uppercase', color:'var(--ew-success)'}}>ONLINE · 47k ctx · 18 tok/s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LOADING / BOOT ────────────────────────────────────────────
function ScreenLoading() {
  const lines = [
    { ts:'00.001', lvl:'info', msg:'son.boot — Strands OSINT Network v1.4.0', stat:'' },
    { ts:'00.002', lvl:'info', msg:'node 22.7.0 · express 4.21 · single-binary', stat:'OK' },
    { ts:'00.014', lvl:'ok',   msg:'config: son.config.mjs loaded · port 3117', stat:'OK' },
    { ts:'00.087', lvl:'ok',   msg:'static assets mounted at /', stat:'OK' },
    { ts:'00.142', lvl:'ok',   msg:'cesium 1.124 · ESRI World Imagery basemap', stat:'OK' },
    { ts:'00.301', lvl:'ok',   msg:'GOOGLE_MAPS_API_KEY detected · 3D Tiles enabled', stat:'OK' },
    { ts:'00.482', lvl:'info', msg:'sweep orchestrator initializing 29 sources', stat:'…' },
    { ts:'00.612', lvl:'ok',   msg:'GDELT · global news+geo events', stat:'OK · 142 events' },
    { ts:'00.701', lvl:'ok',   msg:'OpenSky · 614 commercial aircraft', stat:'OK' },
    { ts:'00.789', lvl:'ok',   msg:'CelesTrak · 1147 active satellites', stat:'OK' },
    { ts:'00.811', lvl:'ok',   msg:'NOAA CAP · 12 active alerts', stat:'OK' },
    { ts:'00.844', lvl:'ok',   msg:'YFinance · BRENT WTI NATGAS VIX SPX HY', stat:'OK' },
    { ts:'00.901', lvl:'warn', msg:'NASA FIRMS · key-gated', stat:'KEY · 312 thermals' },
    { ts:'00.974', lvl:'warn', msg:'AISStream · key-gated', stat:'KEY · 8203 vessels' },
    { ts:'01.108', lvl:'warn', msg:'ACLED · key-gated', stat:'KEY · 89 events' },
    { ts:'01.211', lvl:'fail', msg:'Bluesky · public AT proto search returning 5xx', stat:'DEGRADED' },
    { ts:'01.318', lvl:'fail', msg:'FRED · provider discontinued free API 2026-04', stat:'SKIPPED' },
    { ts:'01.402', lvl:'ok',   msg:'LM Studio · http://localhost:1234/v1', stat:'ONLINE · qwen3-32b' },
    { ts:'01.488', lvl:'ok',   msg:'Telegram bot · @strands_son_bot', stat:'OK' },
    { ts:'01.501', lvl:'ok',   msg:'sweep complete · 24 ok · 3 key · 1 deg · 1 fail', stat:'18.0 OK' },
    { ts:'01.512', lvl:'info', msg:'opening dashboard at http://localhost:3117', stat:'' },
    { ts:'01.514', lvl:'info', msg:'awaiting operator…', stat:'' },
  ];
  return (
    <div className="son-center">
      <div className="son-boot">
        <div className="son-boot-logo">S · O · N</div>
        <div className="son-boot-tag">strands osint network · v1.4.0 · build 2026.05.09</div>
        <div className="son-boot-log">
          {lines.map((l,i) => (
            <div key={i} className="son-boot-line">
              <span className="ts">+{l.ts}s</span>
              <span className={"lvl "+l.lvl}>{l.lvl.toUpperCase()}</span>
              <span>{l.msg}</span>
              <span className="stat">{l.stat}</span>
            </div>
          ))}
        </div>
        <div style={{marginTop:'var(--ew-space-3)', display:'flex', alignItems:'center', gap:12}}>
          <div className="ew-progress" style={{flex:1}}>
            <div className="ew-progress-bar" style={{width:'92%'}}/>
          </div>
          <span style={{fontFamily:'var(--ew-font-mono)', fontSize:'var(--ew-text-xs)', color:'var(--ew-primary)', letterSpacing:'var(--ew-track-wider)', textTransform:'uppercase'}}>92% · sweeping</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenWorldview, ScreenConsigliere, ScreenInspector, ScreenAlerts, ScreenSettings, ScreenLoading });
