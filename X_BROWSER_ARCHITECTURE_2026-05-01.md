# X / BLUESKY ACCESS ARCHITECTURE
**Timestamp:** 2026-05-01 SGT, Lombok
**Author:** Kasai
**Status:** Architecture locked. Scaffolds in place. Execution deferred per Sean.
**Trigger to ship:** Sean confirms burner X account is created and credentials are in `.env`.

---

## 1. Why This Document Exists

The two social adapters in S.O.N's sweep returned `degraded` continuously per `LAYER_AUDIT_2026-04-24.md`:

```
Bluesky    public.api.bsky.app       returns 403 since 2026-04 (rate-limited public access)
Nitter     all 6 mirrors             offline since 2026-04 (project effectively dead)
```

X (Twitter) has had no working free path since the 2023 API shutdown. Paid Basic tier starts at USD $200/month, well outside personal-beta budget.

**Sean's proposal (2026-05-01):** instead of paying for X API, run a logged-in browser session with a dedicated account and scrape the search results. Treat X like an OSINT source the human operator would normally read manually, but automate the read.

**This document captures the architecture for that path on both platforms, with implementation deferred until Sean greenlights and provides credentials.**

---

## 2. Two Platforms, Two Different Solutions

### 2.1 Bluesky → Authenticated AT Protocol (NOT scraping)

Bluesky's official `@atproto/api` SDK works fine for authenticated users. The "DEAD" status in the audit was specifically for the unauthenticated `public.api.bsky.app` endpoint that started returning 403 in April 2026.

**With a Bluesky handle and an app password, full feed and search access are available at zero cost via official API. No browser automation needed.**

Implementation cost: roughly 30 lines.
Risk profile: zero. Official SDK, official endpoint.
Account requirement: one Bluesky account with an app password (Settings → App Passwords). Sean's existing handle works fine; no burner needed.

### 2.2 X (Twitter) → Authenticated Browser via Playwright

X (Twitter) has no usable free API path. Browser automation with a logged-in account is genuinely the right approach for personal-beta scale.

**With a dedicated burner X account, headless Chromium can navigate to search results pages and scrape the rendered DOM.** Same `posts[]` shape the existing adapter pipeline expects.

Implementation cost: roughly 200 lines plus Playwright as a runtime dep (~250MB Chromium download on first install).
Risk profile: TOS-violating, account-ban risk, brittleness on UI changes.
Account requirement: dedicated burner account, not Sean's personal handle.

---

## 3. File Scaffold

```
apis/
  sources/
    bluesky_auth.mjs         # NEW — AT Protocol authenticated adapter
    x_browser.mjs            # NEW — Playwright headless scraper
  auth/
    README.md                # explains storage state format, ignore from git
    .gitkeep                 # keeps directory in git, contents gitignored
runs/
  auth/                      # already gitignored (under runs/)
    bsky.session.json        # Bluesky auth tokens (refreshable)
    x.storage-state.json     # Playwright storage state cookies
```

Scaffolds for `bluesky_auth.mjs` and `x_browser.mjs` shipped today. Both export `briefing()` returning `{ status: 'not_implemented' }` until execution is greenlit.

---

## 4. Bluesky Authenticated Adapter

### 4.1 Dependencies

```
npm install @atproto/api
```

### 4.2 Auth Flow

First run:
1. Read `BLUESKY_HANDLE` and `BLUESKY_APP_PASSWORD` from `.env`.
2. Call `agent.login({ identifier, password })`.
3. Save `agent.session` to `runs/auth/bsky.session.json` for refresh on subsequent runs.

Subsequent runs:
1. Load saved session.
2. Call `agent.resumeSession(saved)` — refreshes if expired.
3. If refresh fails, fall back to login flow.

### 4.3 Search Strategy

For each regional bucket from `geoKeywords` (Iran, Hormuz, Taiwan, etc), call:

```
agent.app.bsky.feed.searchPosts({ q: '<bucket keyword>', limit: 50 })
```

Returns posts with author handle, text, timestamp, like count, embedded media. Geo-tag each post via existing `geoTagText()` heuristic in `dashboard/inject.mjs`.

### 4.4 Output Shape

```js
{
  source: 'Bluesky',
  status: 'active',
  topics: {
    'iran-war': [{ author, text, date, likes, ... }],
    'taiwan-strait': [...],
    'ukraine': [...],
    ...
  },
  totalPosts: <number>
}
```

Matches the existing Bluesky adapter's contract so `synthesize()` in `inject.mjs` picks it up without changes. `V2.social.posts` populates correctly. SOC layer renders again.

### 4.5 Account Plan

Sean uses his existing Bluesky handle. Generate an app password specifically for S.O.N (not the main account password). Stored in `.env` as `BLUESKY_APP_PASSWORD=<16-char-app-pwd>`. Revocable independently of the main account.

---

## 5. X Browser Adapter

### 5.1 Dependencies

```
npm install playwright
npx playwright install chromium    # ~250MB download, first-run only
```

### 5.2 Auth Flow

**First run (manual login):**
1. Run a one-time setup script `npm run x:auth-setup`.
2. Script launches a non-headless Chromium window pointed at `x.com/i/flow/login`.
3. Sean (or whoever holds the burner account) logs in manually.
4. Script waits for the home timeline to load (heuristic: presence of `[data-testid="primaryColumn"]`).
5. Script saves `context.storageState()` to `runs/auth/x.storage-state.json`.
6. Window closes. From this point, headless mode works without password prompts.

**Subsequent runs (headless):**
1. Launch Playwright with `storageState: 'runs/auth/x.storage-state.json'`.
2. Navigate to `x.com/search?q=<query>&f=live` for each regional bucket.
3. Wait for tweet articles to render.
4. Scrape rendered DOM for tweet text, author handle, timestamp, like/repost counts.
5. Detect rate-limit walls (`"You've reached your limit"` text) and back off.
6. If session expired (redirected to login), fail with `{ status: 'auth_expired' }` — operator must re-run `x:auth-setup`.

### 5.3 Stealth Considerations

X actively detects headless Chromium. Mitigations baked into the adapter:

```js
// Use Playwright with explicit user-agent override and viewport randomization
context = await browser.newContext({
  storageState: 'runs/auth/x.storage-state.json',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',  // real desktop UA
  viewport: { width: 1280 + Math.floor(Math.random() * 200), height: 800 + Math.floor(Math.random() * 100) },
  locale: 'en-US',
  timezoneId: 'Asia/Singapore',
});

// Hide webdriver flag — playwright-extra + stealth plugin recommended
// npm install playwright-extra puppeteer-extra-plugin-stealth
```

Random delays between actions (300ms to 1500ms). No more than 1 search per 5 seconds. Total session capped at 12 searches per sweep, 1 sweep per 15 minutes.

### 5.4 Search Strategy

Same regional buckets as Bluesky. URL pattern:

```
https://x.com/search?q=<URL-encoded bucket query>&f=live&src=typed_query
```

`f=live` orders by recency. Scrape first 20 visible tweets per bucket.

### 5.5 Output Shape

```js
{
  source: 'X',
  status: 'active' | 'rate_limited' | 'auth_expired',
  posts: [{
    id: '<tweet status id>',
    author: '<handle>',
    text: '<body text>',
    date: '<ISO 8601>',
    likes: <number>,
    reposts: <number>,
    region: '<geo bucket>',
    lat: <derived via geoTagText>,
    lon: <derived via geoTagText>,
  }],
  totalPosts: <number>,
  authNotes: '<string if any session issue>'
}
```

Synthesizer reads `data.sources.X.posts` (note: `data.sources.X`, not `data.sources['X']`, to avoid the same hyphen-key trap as ADS-B). Existing inject.mjs already handles `data.sources.X` for the dead Nitter adapter; no changes needed.

### 5.6 Account Plan

**Do not use Sean's personal X account.** Create a dedicated burner with the following profile:

```
Username:  kasai_osint  (or son_recon, son_node — TBD by Sean)
Email:     kasai@strandsnation.xyz
Password:  generated, stored in vault outside .env
Bio:       deliberately vague — "exploring spatial intelligence" or empty
Avatar:    minimal — Strands hanko or empty
Following: 30-50 OSINT accounts to make the timeline look organic
Posting:   never — read-only account
```

Ban risk is moderate. Plan for re-creation: keep the email forwarding alive at `kasai@strandsnation.xyz` so a new burner can be spun up in 5 minutes when needed.

### 5.7 What `.env` Will Hold

```
# Bluesky (authenticated adapter)
BLUESKY_HANDLE=somokasane.bsky.social     # or whatever Sean's handle is
BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # generated in Bluesky Settings → App Passwords

# X (browser adapter, set by setup script, used at runtime)
# Storage state lives in runs/auth/x.storage-state.json — not .env
# Optional credential override only if you want unattended re-login:
X_AUTH_EMAIL=kasai@strandsnation.xyz      # optional, omit unless Playwright re-login is wired
X_AUTH_PASSWORD=...                        # optional, never echo to logs
```

`runs/auth/` is gitignored already (under `runs/`).

---

## 6. Sweep Integration

When greenlit, `apis/briefing.mjs`:

```js
// Re-enable the dead lines:
import { briefing as bluesky } from './sources/bluesky_auth.mjs';
import { briefing as xBrowser } from './sources/x_browser.mjs';

// Inside fullBriefing():
runSource('Bluesky', bluesky),
runSource('X', xBrowser),
```

`X` adapter calls Playwright per sweep. To avoid 29 sources all racing for 5GB of RAM during sweep startup, Playwright runs in a long-lived shared browser instance (singleton pattern) rather than spawning a fresh Chromium per sweep.

**Performance budget:** X scraping per sweep should take 30 to 60 seconds for 12 buckets at 5-second intervals. Within the existing 100-second sweep window, but if it ever pushes past 90 seconds, gate it behind a separate slower cycle (every 30 minutes instead of 15).

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| X bans the burner | High over 6+ months | Medium (re-create) | Keep email alive, spin up new account in 5 min |
| X UI changes break scraper | High over months | Medium (debug + redeploy) | Selectors quoted as data-testids where possible, integration tests in repo |
| Cloudflare / bot detection | Medium | Medium | Stealth plugin, rate limits, random delays |
| Session token expiry mid-sweep | Low (refresh handled) | Low | `auth_expired` health flag surfaces in honest sweep summary |
| Bluesky API change | Low | Low | Official SDK absorbs most changes |
| Layer U public ships and X scraping becomes liability | Eventual | High | Drop X coverage at Layer U public launch, switch to Bluesky-only |

---

## 8. Out of Scope (For Now)

- Posting to X or Bluesky from S.O.N. Read-only by design.
- Following / unfollowing accounts. Manual curation by burner-account holder.
- Scraping replies and quote-tweets (initial scope: top-level posts only).
- Image OCR on tweet media. SAM 2 + VLM pipeline can do this later if Diary module wants tweet imagery as B-roll.

---

## 9. Greenlight Criteria

Before execution starts:

1. Sean confirms burner X account is created.
2. Sean sets `BLUESKY_HANDLE` and `BLUESKY_APP_PASSWORD` in `.env`.
3. Sean runs `npm run x:auth-setup` once and logs the burner in manually.
4. Sean confirms in chat: "X browser go" or similar.

Then I install Playwright, ship both adapters, re-enable the briefing imports, restart, and the SOC layer renders again with real posts from real accounts.

Estimated implementation time after greenlight: 4 hours including test against current sweep cycle.

---

## 10. Filing

This document supersedes the "X / Social Signals coverage gap" framing in `LAYER_AUDIT_2026-04-24.md` rows for SOC and Nitter / Bluesky. It does not modify the audit itself. When execution lands, append a one-paragraph entry to `LAYER_U_ARCHITECTURE_2026-04-22.md` Section 10 Addenda noting the path was implemented.

Until then, this file remains the active reference.
