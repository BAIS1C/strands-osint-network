# DOSSIER — PERSON RECON ARCHITECTURE
**Timestamp:** 2026-05-01 SGT, Lombok
**Author:** Kasai (in-session architectural capture for Sean Uddin / Somo Kasane)
**Working name:** Dossier (placeholder, pending Sean's final brand call)
**Status:** Phase 0. Scaffolds laid, ethics charter encoded, no execution.
**Trigger to activate Phase 1:** Sean confirms post-trip and approves the ethics charter.

---

## 1. Strategic Frame

Dossier is a Business Intelligence OSINT stack that produces a structured profile of an individual from publicly indexable sources, layered with personality inference and communication strategy. Same primitives used by ZoomInfo, Apollo, Clay, Crunchbase Pro, Sales Navigator — fragments of which run between USD $99 and $1500 per seat per month. None of those products combine source aggregation with personality inference and goal-conditioned handling strategy. None are local-first. None gate by an identity-sovereign substrate.

Dossier takes inputs at three levels:
1. **Sean's personal beta:** investor pre-meets, partner due diligence, recruitment, competitor positioning, crisis-comms research.
2. **Strands Founders Pass tier:** premium feature for the 6,000-cap holder pool. Network intelligence over their own ecosystem.
3. **Layer U public:** monetized tier for spatial-substrate users. Privacy-tiered, opt-in for private individuals, default-on for public figures.

Differentiator: this is the only profile-building tool that runs entirely on operator hardware (5090 + LM Studio Qwen) for personality inference, never sending the subject's text to a third-party model.

---

## 2. The Three-Layer Architecture

### 2.1 Layer one — source ingestion

Each adapter takes a `subject` object and returns a normalized slice of the dossier.

```
apis/recon/sources/
  web_search.mjs       Google Custom Search dorks targeting the subject's name
  x_search.mjs         X posts by handle, mentions, replies (uses x_browser scaffold)
  bluesky_search.mjs   Bluesky posts (uses bluesky_auth scaffold)
  github.mjs           Public profile, repos, commits, README signals, contribution graph
  linkedin.mjs         Playwright scrape against logged-in burner, separate from X burner
  academic.mjs         Google Scholar + ORCID + ResearchGate dorks
  podcast.mjs          Listen Notes API for podcast appearances
  patents.mjs          Reuses existing apis/sources/patents.mjs sweep adapter
  sec.mjs              EDGAR filings if subject is officer of a public company
  crunchbase.mjs       Crunchbase API for company history (free tier, limited)
  whois.mjs            Domain ownership cross-reference for declared websites
```

### 2.2 Layer two — analysis

Each analysis module takes the raw source bundle and produces a typed insight.

```
apis/recon/analysis/
  identity_resolution.mjs   Cross-reference all sources, confirm same person, flag conflicts
  bigfive.mjs               Big Five OCEAN scores from corpus of posts, with confidence
  mbti.mjs                  MBTI 4-letter code derived from Big Five plus communication patterns
  comm_style.mjs            Verbose/terse, formal/casual, data-driven/narrative, conflict style
  network.mjs               Co-founders, board memberships, declared associations
  timeline.mjs              Career arc, life events, signal moments
  red_flags.mjs             Litigation, sanctions, reputational issues
  handling_strategy.mjs     LLM-generated approach recommendations against stated goal
```

All analysis runs against LM Studio (local Qwen 3.5 9B). Subject text never leaves the operator's machine.

### 2.3 Layer three — composition and surface

```
apis/recon/dossier_builder.mjs    Composes the final report
apis/recon/ethics.mjs             Subject classification gate — runs FIRST, gates everything

dashboard/public/worldview/
  dossier/
    panel.js          Trigger UI in the chat sidebar or dedicated tab
    report.js         Renders the full dossier
    export.js         Markdown / PDF export
```

Consigliere chat receives a natural-language request ("research [name] for [purpose]"), routes through `ethics.mjs` for subject classification, runs source ingestion across enabled adapters, runs analysis, surfaces the dossier in the UI.

---

## 3. The Output Dossier

```
1. IDENTITY              Multiple data points cross-referenced, confidence score
2. PROFESSIONAL          Current role, company, brief career arc
3. EDUCATION             From LinkedIn / academic
4. PUBLIC COMMS          Synthesized from posts (last 6 months default)
5. CONTRIBUTIONS         Papers, patents, talks, repos, podcasts
6. NETWORK               Companies, co-founders, declared associations
7. FINANCIAL SIGNALS     SEC filings, public investments, ownership
8. PERSONALITY           Big Five (with confidence), MBTI 4-letter, archetype
9. COMM STYLE            Tone, pacing, preferred topics, conflict style
10. HANDLING STRATEGY    Custom to operator's goal
11. RED FLAGS            Anything noteworthy that affects engagement
12. SOURCES              Every claim cited, operator can verify
```

Each section is weighted by confidence and citation density. Nothing asserted from a single source. Sources visible inline so the operator can verify or dispute.

---

## 4. Personality Methodology

### 4.1 Big Five OCEAN — primary

OCEAN (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism) is the rigorous personality framework. Strong test-retest reliability, validated across cultures, predicts life outcomes. LLM-derived scoring is well-studied (Yarkoni 2010, Park et al. 2015, etc).

Process:
1. Aggregate corpus of 50 to 200 posts/comments by subject (X, Bluesky, blog, podcast transcripts).
2. LM Studio runs a Big Five scoring prompt over batched text.
3. Output: five 0-to-100 scores plus per-trait confidence band.
4. Below 30 posts of corpus, confidence flagged low across all traits.

### 4.2 MBTI 4-letter — secondary, for actionability

MBTI is barely scientific (test-retest reliability is poor, factor analysis does not support its dichotomies). But it is **actionable** because the 16 archetypes map to recognizable handling patterns operators can act on. Derived, not measured directly.

Process:
1. Big Five scored first.
2. MBTI derived via canonical mapping: high Extraversion → E, low → I; high Openness → N, low → S; high Agreeableness with low Thinking → F, low Agreeableness with high Thinking → T; high Conscientiousness → J, low → P.
3. Communication patterns from `comm_style.mjs` overlay the prediction.
4. Output: 4-letter code plus archetype name plus confidence band.

UI displays both Big Five (primary) and MBTI (secondary "executive summary") with explicit confidence. Operator never sees MBTI without Big Five for context.

### 4.3 Communication style overlay

Independent of personality framework. Direct linguistic features:

```
Verbose / terse           Average post length percentile
Formal / casual           Vocabulary register
Data-driven / narrative   Frequency of numbers, charts, citations vs stories
Direct / hedged           "definitely" "always" vs "perhaps" "maybe"
Conflict-engaged / avoidant   Reply patterns under disagreement
Topic preferences         Tag clouds from corpus
```

These layer onto Big Five plus MBTI for the handling strategy.

---

## 5. Handling Strategy Generator

LM Studio takes:
- Personality profile (Big Five + MBTI + comm style)
- Operator's stated goal ("raise $5M from this VC", "negotiate equity with this co-founder", "land partnership with this corp dev lead", "prepare for adversarial press interview")
- Optional context (relationship history, prior interactions, who introduced)

Outputs a custom playbook:
- Communication recommendations (formal, data-driven, use stories, etc.)
- Topic angles likely to engage
- Topics to avoid
- Negotiation style match
- Trust-building approach
- Red flags / sensitivities
- Suggested opening lines or framing
- Likely objections and how to address them

Output is recommendations not directives. The operator decides how to use them.

---

## 6. Ethics Charter (Load-Bearing)

This section is encoded in `apis/recon/ethics.mjs` as runtime gating, not just policy.

### 6.1 Subject classification gate

Every Dossier request runs through this gate FIRST. Adapters refuse to engage until classification completes.

```
A. Public figure
   Defined: politicians, executives of public companies, public-facing media, declared
            spokespersons, anyone with a verified blue tick on a major platform, anyone
            who has voluntarily entered public discourse on the topic in question.
   Treatment: full source set enabled, default-on for Layer U public users.

B. Private individual
   Defined: everyone not classified as public figure.
   Treatment for personal beta: full source set, no constraint (Sean's research workflow).
   Treatment for Layer U public: requires opt-in by subject (everywear.id-signed consent
                                  token), or only public-record sources (court, SEC,
                                  patent, declared bio) without social/communication
                                  inference.

C. Strands Founders Pass holder
   Defined: anyone in the 6,000-cap pool with a registered everywear.id.
   Treatment: visibility tier per LAYER_U_ARCHITECTURE Section 3.2. Holder controls own
              tier and what other holders can see. Tier 0 default = anonymous, Tier 3
              = full handle + bio + contact.

D. Minor (under 18)
   Treatment: Dossier refuses. No exceptions. Adapter array returns error.
```

Classification is operator-asserted plus verified against public-figure heuristics. Mismatches surface as warnings.

### 6.2 No real-time tracking

Single-shot research request, never continuous monitoring. No alert subscriptions on a person. No "watch this profile" feature. Each Dossier is a one-time crystallization.

### 6.3 No reverse-image surveillance

Photo input only used for identity confirmation against the subject's own declared profile photos. Never used for face-search, face-matching, or biometric inference.

### 6.4 Subject notification (GDPR Article 14)

When a Layer U user runs a Dossier on a private individual, that subject gets notified via everywear.id (if held) within 30 days of the request. Compliant with EU regulation. Personal-beta exempt; this is a Layer U public requirement.

### 6.5 Cited sources only

Every claim in the dossier carries a citation back to source URL or document. Subjects can dispute claims they believe inaccurate; dispute mechanism in Layer U public version.

### 6.6 No data brokerage

Dossiers are user-personal artifacts. Never sold, shared, indexed, or aggregated into a public directory. Strands holds no copy. Stored locally on the operator's machine.

### 6.7 Use restrictions

Encoded as terms-of-service for the Layer U tier:
- No use for harassment, stalking, or coordinated targeting.
- No use to compromise election integrity.
- No use for adversarial competitive intelligence against private individuals.
- Operator self-attests to legitimate purpose at request time.

Violations surfacing publicly result in immediate Layer U access revocation.

### 6.8 Local-first guarantee

Subject's text never leaves the operator's machine for personality inference. LM Studio runs locally. The only cloud calls are to public source endpoints (Google Custom Search, GitHub API, etc.) that the operator could make manually.

---

## 7. Phased Build

### Phase 0 — Architecture and scaffold (today)

```
DOSSIER_ARCHITECTURE_2026-05-01.md           This document
apis/recon/dossier_builder.mjs               Orchestrator stub
apis/recon/ethics.mjs                        Subject classification gate (functional)
apis/recon/sources/web_search.mjs            Stub (representative example)
apis/recon/analysis/bigfive.mjs              Stub (representative example)
```

No execution. No dependencies installed. Other source/analysis adapters scaffolded on activation per Phase 1.

### Phase 1 — MVP (post-trip, roughly week of 2026-05-12 SGT)

Public sources only. Personal beta. No Layer U surface yet.

```
Day 1     bluesky_search, x_search via existing scaffolds (after X-browser greenlit)
Day 2     web_search (Google Custom Search + dork generator), github
Day 3     podcast (Listen Notes), academic (Scholar)
Day 4     bigfive scoring against LM Studio, mbti derivation, comm_style
Day 5     handling_strategy generator, dossier_builder composition
Day 6     UI: chat-triggered Dossier panel, markdown report renderer
Day 7     Test against three real subjects (you choose), tune prompts
```

End of Phase 1: Sean can run "research [name] for [purpose]" in the Consigliere and get a usable dossier within 90 seconds.

### Phase 2 — Premium sources (roughly weeks 2 to 3 post-MVP)

```
LinkedIn (Playwright + dedicated burner account, separate from X burner)
SEC EDGAR (filings, officer roles)
Crunchbase (company history, funding rounds)
WHOIS (domain ownership cross-reference)
PDF export with Strands branding
```

End of Phase 2: depth on public-company executives, founders, professionals.

### Phase 3 — Layer U integration (rolls in alongside Layer U public launch)

```
Subject classification gate enforcement
everywear.id consent flow for private individuals
Founders Pass tier visibility integration
Premium tier monetization (TBD: subscription vs per-dossier credits)
Subject dispute mechanism
GDPR Article 14 notification pipeline
```

End of Phase 3: Dossier ships as a public Layer U feature with full ethics enforcement.

---

## 8. Connection to Existing S.O.N Substrate

Not a new platform; a focused harvest of substrate you have already built.

| Reuses | What |
|---|---|
| `apis/sources/x_browser.mjs` (scaffolded) | X post ingestion via burner |
| `apis/sources/bluesky_auth.mjs` (scaffolded) | Bluesky post ingestion via authenticated AT Protocol |
| `apis/sources/dork_search.mjs` (proposed) | Web search dork generator |
| `apis/sources/patents.mjs` (live) | Patent filings |
| LM Studio plus Qwen 3.5 | All personality inference, fully local |
| Telegram / Discord alert primitive | Optional notify-on-dossier-completion |
| everywear.id (planned) | Subject classification, consent, tier gating |
| The Consigliere chat tools | Natural-language Dossier requests |

---

## 9. Open Decisions

Locked or pending Sean confirmation:

| Topic | Status |
|---|---|
| Working name | `Dossier` placeholder, pending final |
| Big Five primary, MBTI secondary | Locked |
| Phase 0 scaffold-only | Locked |
| Layer U monetization model | Subscription tier vs per-dossier credit, pending |
| GDPR Article 14 notification timing | 30 days, locked |
| Adversarial-research adapter (e.g. court records) | Phase 2, pending legal review |
| Handling strategy goal taxonomy | Open — what goals to support out of the box |

---

## 10. Greenlight Criteria for Phase 1 Activation

Before any code beyond the Phase 0 scaffold gets written:

1. Bali trip completed and Sean back at the desk.
2. X browser scaffold greenlit and burner account live (provides X posts as input).
3. Sean confirms ethics charter as written, with any redlines applied.
4. Final brand name confirmed (Dossier, Mirror, Read, or other).
5. LM Studio confirmed running with a tool-capable model.
6. Three test subjects identified for prompt tuning (suggest: a public figure, a Founders Pass holder, and a Strands ecosystem partner).

Then Phase 1 day-by-day plan begins.

---

## 11. Filing

This document is the active reference for Person Recon work. When Phase 1 activates, append a one-paragraph entry to `LAYER_U_ARCHITECTURE_2026-04-22.md` Section 10 Addenda noting Dossier became operational. When Phase 3 ships into Layer U public, file a new section 4.7 in the master architecture doc capturing it as a permanent dimension.

Until then, this file remains the active reference.
