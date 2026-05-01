# LAYER U: ARCHITECTURE & ROADMAP

**Location:** `C:\Users\MAG MSI\Project Claude\Project S.O.N\LAYER_U_ARCHITECTURE_2026-04-22.md`
**Timestamp:** 2026-04-22 SGT, Lombok
**Status:** Reference document. Public Layer U parked until operator build ships.
**Author:** Kasai (in-session architectural capture for Sean Uddin / Somo Kasane)

---

## 1. Canonical Definition

Layer U is defined by **Whitepaper v6 Chapter 12**: the resistance economy and pirate broadcast layer, counter-system to SOVcorp, with SIGOPS integration. This supersedes the v5 "AR ad real estate" framing, though the ad-layer thread remains alive as a downstream dimension.

Layer U is not a single product. It is a **geospatial substrate** for the Everywear ecosystem, exposing primitives that first-party Strands surfaces and third-party Everywear apps consume.

---

## 2. Current Build State (2026-04-22)

**Operator console (S.O.N · Strands OSINT Network)** is under active development in `C:\Users\MAG MSI\Project Claude\Project S.O.N`. This is the local-only, founder-private cockpit. Public Layer U deployment is paused.

Operator deliverables before Layer U v1 public release:
- LM Studio integration (done)
- Cesium globe + 27-source OSINT feed (done)
- Chokepoint visualisation (done, 2026-04-22)
- Director mode (Phase 7–11): REC control, BriefPlan schema, ScenePlayer, MediaRecorder MVP
- NVENC sidecar handoff (Phase 12): broadcast-quality encode via strands-sound-studio

After operator ships and Director loop produces its first briefs, Layer U public goes live.

---

## 3. Layer U Public: v1 Scope

**Deployment target:** `layeru.xyz` (Cloudflare DNS via seanie.sean; Vercel hosting; Cloudflare R2 for media; Supabase for DB shared with Founders Pass).

**Two sub-layers, one parent toggle:**

### 3.1 NEWS Sub-Layer
Geo-anchored news cards over hotspots. Sources: Reuters RSS, Bloomberg Politics RSS, GDELT Events 2.1 (geo-tagged, 15-min refresh, free), X trending by geo (via Nitter RSS mirrors if no API). Thumbnails: synthetic Cesium snapshots preferred over source CDN images (consistent aesthetic, no licensing exposure for distribution).

### 3.2 STRANDSNATION Sub-Layer
Living population overlay of Founders Pass holders (6,000 cap). Default: anonymous Strand logo glyph, country centroid jitter, no identifying info. Opt-in tier ladder (user-controlled from everywear.id profile):

- Tier 0 (default): anonymous Strand logo, no handle
- Tier 1: + country flag
- Tier 2: + everywear.id shown on hover
- Tier 3: + city centroid + clickable everywear.id deep link

Identity root is everywear.id. Founders Pass claim triggers everywear.id creation if not held. Map functions as adoption funnel for Everywear.

Visualisation uses Cesium EntityCluster for density collapse/expand on zoom. Hanko red glow for Founders tier. No timestamp trails stored or displayed. Ever.

### 3.3 Compounding Loops (v1)
- News loop: daily return visits
- Population loop: social gravity (Blanks see themselves and neighbours)
- Director loop: monthly "State of the StrandsNation" briefs auto-published to X / Telegram
- Everywear adoption: map visibility as incentive to claim everywear.id

---

## 4. Future Dimensions (Parked)

All dimensions below are documented here for continuity. None are actively built in v1. Schema reservations noted where present-day decisions would otherwise force costly migrations later.

### 4.1 Commerce Layer: Geospatial Escrow Primitive

**Core primitive:** two everywear.ids commit to a meet at a hotspot, both stake signed metadata to an encrypted vault pre-meet, both must sign post-meet to release, failure-to-release triggers a pre-designated escalation path.

**Architectural non-negotiable:** client-controlled threshold escrow, NOT central escrow.

- Data is encrypted client-side with a key split 2-of-3 between Alice, Bob, and each party's user-designated escalation contact.
- Strands holds no decryption keys.
- Strands carries no subpoena exposure.
- Escalation contacts are user-chosen at commitment time: can be a friend, a lawyer, a specific LEO contact, a domestic violence NGO, etc. Each party chooses their own.
- If post-meet release fails within timeout, escalation contact receives enough key material to decrypt and decide what to do.

This architecture preserves the whitepaper's anti-techno-feudalism thesis: users hold keys, platforms do not.

**First commerce use cases (not dating):**
- Service marketplace: tutors, handymen, massage, driving lessons
- Travel hosting: Couchsurfing analogue
- Peer-to-peer pickup: Craigslist core: used items confirmed by both parties
- Co-working / meetup
- Skill trade / language exchange

These prove the primitive with minimal liability. Dating only considered after primitive is battle-tested on lower-stakes applications.

**API surface (reserved, unimplemented):**
```
POST /api/layer-u/escrow/open
POST /api/layer-u/escrow/release
POST /api/layer-u/escrow/escalate
GET  /api/layer-u/escrow/:id/status
```

**Schema reservation for v1:** add `escrow_ref` nullable field to Layer U hotspot table now. Zero present cost, avoids migration later.

### 4.2 Dating Layer: T&C-Locked Escrow with Surety

**Framing:** dating uses the same escrow primitive as commerce, plus explicit T&C binding at match creation. Both parties sign T&Cs asserting:
- Meeting intent
- Safety parameters (public location preferred, time-bounded, release protocol)
- Escalation contacts each party designates
- Data retention terms

Surety layer: optional stake (Kreds or fiat) that unlocks to both parties on successful mutual release, or slashes to the escalation pool if one party abandons the protocol. Economic incentive to comply with safety release.

**Compliance constraints:**
- PT Metafintek / Lombok hosting exposes Indonesian PDP Law and local social law
- Same-sex matching is criminalised in Indonesia; dating layer cannot be offered from Indonesian infrastructure without compliance review
- Singapore entity (somokasane Pte. Ltd.) likely the correct operator for any dating surface
- Age verification: everywear.id KYC at Tier 2+ becomes mandatory for dating consumer
- First tragedy on a dating platform destroys whitepaper brand narrative: ship only after commerce primitive is proven

**Decision posture:** dating is an eventual application, not a v1 use case. Revisit no earlier than post-Alpha, post-DAO launch, post-first-commerce-app-success.

### 4.3 Ad Layer: Resurrected v5 Thread

The v5 "Layer U AR real estate" concept is not dead. It re-enters as a downstream commerce dimension, reframed under v6 canonical:

- XR advertising anchored to real-world hotspots
- dNFT ownership of hotspot ad real estate (Strands SPL-721 tokens)
- Creator royalties baked into the dNFT contract
- City-scale advertising zones (downstream: not "City DAOs" per Sean 2026-04-22, just ad geometry)
- Integration with Everywear Browser mobile surface for AR rendering
- Native Strands game integration: in-game advertising that matches real-world Layer U placements (diegetic coherence: see 4.5)

**Reserved concept:** "skin the world" packs: location-anchored visual overlays that users can buy and apply. Layer U ad layer ships these as tradable dNFT assets.

### 4.4 Third-Party Developer Platform: Steam for AI Apps

Everywear is positioned as "Steam for AI Apps". Layer U is the geospatial substrate apps on Everywear can consume. First-party exposed primitives:

```
layer_u.post_listing({ anchor, tags, expiry, visibility_tier })
layer_u.query_nearby({ lat, lon, radius, filter })
layer_u.open_escrow({ parties[], terms, timeout, escalation_contacts[] })
layer_u.verify_presence({ everywear_id, hotspot, time })
layer_u.publish_brief({ brief_plan, anchor })
layer_u.subscribe_to_hotspot({ hotspot, event_types[] })
```

Third-party developers build dating apps, tutor marketplaces, travel hosts, AR games, and more on these primitives. Strands takes a rev share (model TBD: likely 10-15% of transactions routed through escrow, free for non-commercial surfaces).

**10-year roadmap framing:** Layer U becomes the default geospatial identity-aware substrate for physical-world coordination in Everywear. Apps compete on UX and vertical specialisation; Strands owns the substrate.

### 4.5 Diegetic Game Integration: Strands + XR

The Strands game becomes a training ground for Layer U protocols in fiction:

- In-game quests teach players the escrow-release-or-escalate mechanic through NPC interactions
- Game world hotspots mirror real-world Layer U hotspots (Malacca, Hormuz, Jakarta: same geometry, stylised)
- Players who complete in-game safety protocols unlock real-world Layer U trust scores
- XR games (future Everywear mobile) overlay Strands characters on real-world Layer U hotspots: find-a-Blank quests, location-anchored PvE events
- Sublime VIP Pass holders get in-game avatar appearances on the real Layer U map: their Blanks visible as rendered characters, not just Strand logo glyphs, when zoomed in

**Purpose:** train the user base on Layer U primitives safely, gamified, before the primitive is used for high-stakes coordination. Make the protocol literacy a gameplay achievement.

---

## 5. Architectural Non-Negotiables

These are load-bearing constraints, not preferences. Violating any of them breaks the whitepaper thesis or creates fatal liability.

1. **Users hold keys.** Strands never holds decryption material for user-to-user interactions. Platform is the substrate, not the custodian.
2. **Privacy-first opt-in.** Every identifying detail: handle, country, city, trail: is opt-in from Tier 0 anonymous default. Retrofit existing holders with wallet-signed consent update.
3. **everywear.id is the identity root.** No parallel pseudonym systems. One identity, tiered visibility, user-controlled.
4. **No timestamp trails.** Presence state is latest-only. Historical location data is never stored for third-party query. Aggregate-only analytics for Strands.
5. **Jurisdictional separation.** Any surface with criminal-law exposure (dating, adult commerce) operates from Singapore entity, not PT Metafintek Indonesia.
6. **Hanko semantics preserved.** Seal red reserved for criticality (chokepoint alerts, escalation events). Never used for routine markers.

---

## 6. Deferred Decisions (To Revisit)

- First commerce use case selection (service marketplace vs peer-to-peer pickup vs travel hosting)
- Rev-share percentage for third-party Layer U apps
- Sublime VIP visual treatment in v1 (render character sprites or stay logo-only)
- City-scale governance surfaces (Sean holds this context outside vault; revisit when directly prompted)
- XR / mobile Everywear UX for Layer U (blocked on Everywear mobile browser availability)

---

## 7. Immediate Next Actions (Operator Build)

1. Phase 7: Kill timeline play button, stub REC control
2. Phase 8: Port vidDirectorApi schema → S.O.N BriefPlan schema
3. Phase 9: News adapter (Reuters / Bloomberg / GDELT / X trending)
4. Phase 10: Layer U v1 primitives (News + StrandsNation renderers, OPERATOR-SIDE)
5. Phase 11: ScenePlayer + MediaRecorder MVP; first Malacca 30-sec brief
6. Phase 12: NVENC sidecar handoff for broadcast-quality encode

Layer U public (layeru.xyz) deployment deferred until operator pipeline produces publishable briefs.

---

## 8. Glossary (Session-Captured)

- **S.O.N**: Strands OSINT Network. Operator-side console. Currently in Project S.O.N folder.
- **Layer U**: Canonical Whitepaper v6 Ch.12 resistance broadcast layer. Public surface at `layeru.xyz` (parked).
- **Blanks**: Canonical term for Strands player avatars. No exceptions.
- **Somo Kasane**: Sean Uddin's Strands identity alias.
- **Founders Pass**: 6,000-cap NFT. $20-$50 wave pricing. Sublime VIP Pass tier included.
- **Everywear**: "Steam for AI Apps" platform. Desktop + mobile browser. Runs on `everywear.id`.
- **everywear.id**: Canonical decentralised identity for all Strands ecosystem surfaces.
- **Hanko**: Japanese red seal motif. Used only for criticality semantics in UI.
- **T&C's**: Terms and Conditions. (Earlier typo "TNCX" clarified by Sean 2026-04-22 as this.)
- **Kasai mode**: Lateral, strategic, assumption-challenging counsel mode.
- **BriefPlan**: S.O.N director schema, ported from strands-sound-studio vidDirectorApi.ts ShotPlan.
- **Scene**: Single shot in a BriefPlan: camera + layers + caption + newsTag + duration.
- **PostureMap**: Geopolitical analogue to BeatMap: sweep deltas, criticality spikes by region+time.

---

## 9. File Stewardship

Per operator preferences: this document does not overwrite any existing CONTEXT.md. It is a Context Append, intended for mymory vault ingest on next session-filing pass. Updates should append dated addenda at the bottom of this file rather than rewriting earlier sections. Historical decisions remain visible; pruning happens through the KASAI memory stack, not through deletion here.

---

## 10. Addenda

*(Future timestamped additions below. Do not delete prior entries.)*

---

### Addendum 2026-04-30 SGT: Bilawal WorldView Recalibration and RECON Sprint

**Competitive recalibration.** Bilawal Sidhu (credited in `README.md` for the 4 Gods Eye framework that anchored S.O.N's interface) shipped a vibe-coded Palantir analogue called WorldView in three days using Google Photorealistic 3D Tiles, OpenSky live commercial flights, ADS-B Exchange military flights, CelesTrak satellite TLEs, public CCTV projected onto 3D geometry, and NVG/FLIR/CRT shader post-processing. Trended on X overnight; Palantir co-founder Joe Lonsdale responded publicly. WorldView is closed source and serves as breadcrumb marketing for Bilawal's underlying SpatialOS / Argus platform thesis. Conclusion: S.O.N is not in the same race. Bilawal is building civilian fusion-layer-as-a-service for solo operators. S.O.N stays a personal OSINT beta, with Layer U services (events, social, escrow, flashmobs, dating, ad layer) bolting on as Founders Pass holders are onboarded. The OSINT layer is shared visual language; the value capture is structurally different. WorldView serves as visual benchmark and feature reference, not competitor.

**RECON sprint scoped (2026-04-30 to 2026-05-02 SGT).** Three-day sprint to ship: Google Photorealistic 3D Tiles globe replacement, four shader presets (NVG/FLIR/CRT/OPS), layout decompression, AIR + MIL + SAT + CCTV inspector + RSS Atom layer fixes per `LAYER_AUDIT_2026-04-24.md`, and RECON v0 (journey planner with OSRM routing, hardcoded Indonesian ferry resolver, OSM corridor query for accommodation + fuel + events, junction screenshot capture, save/load itinerary, ScenePlayer v0). Bali trip departure 2026-05-03 is the hard deadline. Full architecture in `RECON_SPRINT_ARCHITECTURE_2026-04-30.md`. Phase 7-12 Director mode work from Section 7 of this document is partially absorbed into RECON v0: ScenePlayer ships now against the locked itinerary schema, MediaRecorder export uses CPU ffmpeg as placeholder.

**Distribution and Phase 12 deferral.** S.O.N stays web-served via `node server.mjs` for the duration of personal beta. Distribution pivot to local Tauri shell is deferred until the Kasai bot OS (parallel workstream) ships, at which point S.O.N migrates to Kasai-bot-embedded sidecar with Cesium worldview running inside the bot's webview. Phase 12 NVENC sidecar handoff in Section 2 is collapsed into the Kasai bot migration via reuse of the existing Project ACE / Gener8 Rust NVENC pipeline. New operator email: `kasai@strandsnation.xyz` (forwards to `seanie.sean@gmail.com`) for all API key registrations going forward.

**Diary Module reservation (Sprint 2, post-trip).** A new Section 4.6 to be filed: permanent video diary of a real journey, composed from user's metatagged photos, RECON itinerary substrate, 3D Tiles globe flythroughs, local CCTV captures, knowledge-layer text snippets via LM Studio + Wikipedia GeoSearch, and optional ACE-Step generated music. Director engine borrowed from S³ Studio Creator Pro AI music director. RECON itineraries are Class A (auto-fade 30/90 days post-journey-expiry); Diary entries are Class B (permanent). Promotion event: user clicks Build Diary on returned itinerary, JSON copies to `runs/diary/`. First commercial wedge for Layer U public: branded diaries with hotel partnerships embedded as sponsorship via the existing v6 Ad Layer dNFT primitive (Section 4.3). Diary Module brand name pending Sean's final call; working placeholder used in code and docs until locked.
