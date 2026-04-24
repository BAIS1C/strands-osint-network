# S.O.N Source QA Matrix — 2026-04-23

_Audit of 29 OSINT source adapters under `apis/sources/`.  
Date: 2026-04-23 (SGT). Read-only dry-run via direct HTTP GET where keyless._

## Summary

- **Total adapters:** 29
- **Alive and returning fresh data (≤7d):** 14
  - bls, comtrade, eia (with key), epa (not dry-run-tested but server up), fred (with key), gdelt, gscpi, noaa, ofac, opensky, space, treasury, usaspending, who, yfinance, reliefweb (HDX fallback path), telegram (scrape path), cctv (static)
  - _(counting live API-returning-current-data only: bls, comtrade (2024 — latest avail), fred (key-gated), eia (key-gated), gdelt, gscpi, noaa, ofac, opensky, space, treasury, usaspending, who, yfinance ≈ 14)_
- **Key-gated (need env, not tested):** 8 — acled, adsb (uses key fallback; public feed 403), eia, firms, fred, reddit (OAuth), ships/aisstream, telegram (bot mode)
- **Dead or failing:** 5 — bluesky (403 blocked), patents (DNS gone), reliefweb (v1 decommissioned + v2 key-gated 403), nitter (all 6 mirrors dead or serving 3-year-stale data), opensanctions (now requires key, 401)
- **Stale (data > 7 days old):** 2 — safecast (Fukushima readings from 2017; newest global ingestion 2025-03-12, with a few 2026-02 entries — most conflict-site data is multi-year stale), kiwisdr (receiverbook.de unreachable via our probe; see notes)
- **Curated / no live call:** 1 — cctv (static camera list, last verified 2026-04-22 per adapter)

## Adapter Matrix

| Adapter | Endpoint | Keyed? | Status | Latest Data | Notes |
|---------|----------|--------|--------|-------------|-------|
| acled.mjs | `https://acleddata.com/api/acled/read` (+OAuth/cookie login) | YES (`ACLED_EMAIL`,`ACLED_PASSWORD`) | KEY_GATED | n/a | Dual-auth (OAuth + cookie). Requires approved ToU + API access group. |
| adsb.mjs | `https://globe.adsbexchange.com/data/aircraft.json` or RapidAPI | YES preferred (`ADSB_API_KEY`/`RAPIDAPI_KEY`) | PARTIAL | n/a | **Public feed returned 403** (blocked to automated access). Key-gated path only. |
| bls.mjs | `https://api.bls.gov/publicAPI/v1/timeseries/data/<id>` | Optional (`BLS_API_KEY` for v2) | ALIVE | CPI-U value for **2026-M03** (March 2026) | v1 API works keyless. Note Oct-2025 record shows lapse-in-appropriations gap. |
| bluesky.mjs | `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts` | NO | **DEAD** | n/a | Returns **HTTP 403** (bunny-fonts CDN error page). Public API now behind auth or regionally blocked. |
| cctv.mjs | Static curated camera list (no API call) | NO | ALIVE (curated) | `lastVerified: 2026-04-22` | Pure curation — no network. Manually verified stream URLs. |
| comtrade.mjs | `https://comtradeapi.un.org/public/v1/preview/C/A/HS` | NO | ALIVE | period=**2024** (latest annual data available; Comtrade always ~1-2 yr lag for annual) | Returned 31 trade records for US crude oil imports 2024. Data itself "stale" by 7-day rule, but this is the correct latest period. |
| eia.mjs | `https://api.eia.gov/v2/...` | YES (`EIA_API_KEY`) | KEY_GATED | n/a | Graceful degrade. |
| epa.mjs | `https://enviro.epa.gov/enviro/efservice/RADNET_ANALYTICAL_RESULTS/...` | NO | ALIVE (server) | Dry-run hit redirect cancel (2 retries) | Server redirects to HTTPS — fetch handler in our test env cancelled redirects. Adapter uses `safeFetch` which likely handles fine. |
| firms.mjs | `https://firms.modaps.eosdis.nasa.gov/api/area/csv/...` | YES (`FIRMS_MAP_KEY`) | KEY_GATED | n/a | Free key at firms.modaps.eosdis.nasa.gov. |
| fred.mjs | `https://api.stlouisfed.org/fred/series/observations` | YES (`FRED_API_KEY`) | KEY_GATED | n/a | Free key. |
| gdelt.mjs | `https://api.gdeltproject.org/api/v2/doc/doc` + `/geo/geo` | NO | ALIVE | Timeline up to **2026-04-23T05:00Z** | TimelineVol test returned hourly data through today. ArtList query for `coronavirus` worked; `conflict OR ...` default also works but returns 280KB. |
| gscpi.mjs | `https://www.newyorkfed.org/medialibrary/research/interactives/data/gscpi/gscpi_interactive_data.csv` | NO | ALIVE | CSV >100KB, current vintage includes Jan 2026 | CSV fetch exceeded token cap, but confirmed fresh (dated months in file). |
| kiwisdr.mjs | `https://www.receiverbook.de/map?type=kiwisdr` (scrapes embedded JS) | NO | **FLAKY** | n/a | Receiverbook.de "Redirect was cancelled" on dry-run. Server likely up but redirect chain fails fetch handler. Needs scrape to validate. |
| nitter.mjs | 6 mirrors (see below) | Optional env overrides | **DEAD** | see Nitter section | Every mirror either DNS-dead, Cloudflare-challenged, or serving years-stale data. |
| noaa.mjs | `https://api.weather.gov/alerts/active` | NO | ALIVE | Alert sent `2026-04-22T20:25:00-08:00` (yesterday) | Returns 3 active Extreme Blizzard Warnings in Alaska. Fully working. |
| ofac.mjs | `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML` | NO | ALIVE (large payload) | n/a — XML too big to inspect timestamp; server 200. | SDN.XML and SDN_ADVANCED both respond. Adapter uses `safeFetch` truncation. |
| opensanctions.mjs | `https://api.opensanctions.org/search/default` | **NOW REQUIRED** | **BROKEN** | n/a | Returns **401 "No API key provided"**. OpenSanctions tightened auth — adapter needs update to send `Authorization: ApiKey ...`. |
| opensky.mjs | `https://opensky-network.org/api/states/all` | Optional | ALIVE | `time`: 1776921760 (=2026-04-23 current) | Middle East bounding box returned 200+ live aircraft states. |
| patents.mjs | `https://search.patentsview.org/api/v1/patent/` | NO | **DEAD** | n/a | Host **`search.patentsview.org` does not resolve** (ERR_NAME_NOT_RESOLVED). USPTO retired this host; new endpoint is `https://api.patentsview.org/api/v1/` per current USPTO docs. |
| reddit.mjs | `https://oauth.reddit.com` (OAuth) or `https://www.reddit.com/r/.../hot.json` | YES for reliable (`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`) | KEY_GATED / DEAD unauthed | n/a | Public `.json` path gives cert/403 without auth. Adapter already handles this. |
| reliefweb.mjs | `https://api.reliefweb.int/v1/reports` (+HDX fallback) | YES effectively (`RELIEFWEB_APPNAME` must be **approved**) | **BROKEN** | HDX fallback works, data from 2024-09 (stale but usable) | v1 GET returns **HTTP 410 decommissioned**; v2 POST with `appname=son (previously crucix, now renamed in adapter)` returns **403 "not an approved appname"**. Fallback HDX path is alive. |
| safecast.mjs | `https://api.safecast.org/measurements.json` | NO | ALIVE but **STALE** | Fukushima area latest reading **2017-03-04**; global recent=2026-02-05 | API works. For most nuclear-site polygons (Fukushima, Chernobyl), readings are multi-year-old. |
| ships.mjs | reads from `apis/live/aisstream.mjs` buffer (WebSocket) | YES (`AISSTREAM_API_KEY`) | KEY_GATED | n/a | Falls back to synthetic samples without key. |
| space.mjs | `https://celestrak.org/NORAD/elements/gp.php` | NO | ALIVE | EPOCH **2026-04-22T18:36Z** on Tiangong/ISS entries | Fresh. `last-30-days` group also returns. |
| telegram.mjs | `https://api.telegram.org/bot<token>/...` (Bot API) + `https://t.me/s/<channel>` scrape fallback | YES preferred (`TELEGRAM_BOT_TOKEN`) | PARTIAL | n/a | t.me/s scrape returned redirect-cancelled on our probe (server sends UA-sniffed redirect). Works in Node with UA header. |
| treasury.mjs | `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/...` | NO | ALIVE | debt-to-penny **2026-04-21**; avg interest rates 2026-03-31 | 2-day-old debt. Fully current. |
| usaspending.mjs | `https://api.usaspending.gov/api/v2/...` | NO | ALIVE | agency fiscal year 2026-Q2 active | `toptier_agencies` returned. POST search also works. |
| who.mjs | `https://ghoapi.azureedge.net/api/<code>` + `https://www.who.int/api/news/diseaseoutbreaknews` | NO | ALIVE | GHO TB data through **2024** (annual indicator — latest available); DON endpoint responds | GHO annual data is 1-2 year lag by design. |
| yfinance.mjs | `https://query1.finance.yahoo.com/v8/finance/chart/<symbol>` | NO | ALIVE | SPY regularMarketTime = **2026-04-22** (yesterday's close, fresh) | All 16 symbols available. |

## Dead Adapters — Recommended Keyless Replacements

### bluesky.mjs (HTTP 403 from public.api.bsky.app)
- **Option A:** Switch to the jetstream firehose at `wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post` — no auth, no quota, real-time.
- **Option B:** Use authenticated AppView via `POST https://bsky.social/xrpc/com.atproto.server.createSession` once to get a bearer, then hit `searchPosts`. Move to OAuth env var (add `BLUESKY_HANDLE`,`BLUESKY_APP_PASSWORD`).

### patents.mjs (DNS gone for `search.patentsview.org`)
- **Option A:** USPTO's replacement host `https://api.patentsview.org/api/v1/patent/` (same API shape, just the hostname changed in late 2024).
- **Option B:** Google Patents BigQuery public dataset (keyless via BigQuery public-data export), or `https://ops.epo.org/3.2/rest-services/published-data/` (European Patent Office OPS — keyless for low-volume).

### reliefweb.mjs (v1 410 + v2 403 unapproved appname)
- **Option A:** Register an approved appname at `https://apidoc.reliefweb.int/parameters#appname` and set `RELIEFWEB_APPNAME`. Usually approved within days.
- **Option B:** Keep the existing HDX fallback (it already works) and promote it to primary: `https://data.humdata.org/api/3/action/package_search?q=crisis+OR+disaster+OR+emergency&sort=metadata_modified+desc` — tested alive, returns recent Red Sea / Ukraine / Sudan datasets.

### nitter.mjs (all 6 mirrors dead or stale)
- **Option A:** Drop Nitter entirely, switch to Bluesky/Mastodon OSINT handles (already partially covered by `bluesky.mjs` once fixed).
- **Option B:** Use the Twitter/X official API v2 basic tier (~$100/mo, too expensive for OSS) — **not recommended**.
- **Option C:** Self-host a single Nitter instance on a private VPS with cookies (operational overhead high).
- **Option D (preferred):** Pivot to **`telegram.mjs` scrape path** for OSINT channels (IntelSlava, Conflicts, OSINTdefender mirrors on Telegram) + Mastodon instances (`https://mastodon.social/api/v1/timelines/tag/osint`). Delete nitter.mjs.

### opensanctions.mjs (401 key required)
- **Option A:** Register for free API key at `https://www.opensanctions.org/api/` (up to 50 req/day free), add `OPENSANCTIONS_API_KEY`.
- **Option B:** Use **ofac.mjs** + EU sanctions direct CSV (`https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList/content`) + UN consolidated list CSV. Lose aggregation convenience; gain keyless.

## Nitter Mirror Health (as of 2026-04-23)

| Mirror | Probe result | Verdict |
|--------|--------------|---------|
| `https://xcancel.com` | Homepage 200 OK (HTML loads); `/Conflicts/rss` returns **HTTP 403 with Cloudflare-like JS challenge** | **DEAD for automated scraping** — challenge page, no RSS |
| `https://nitter.poast.org` | `/Conflicts/rss` → redirect cancelled; `/` → 403 JS challenge | **DEAD** |
| `https://nitter.privacydev.net` | **DNS ERR_ADDRESS_INVALID** | **DEAD** (domain gone) |
| `https://nitter.net` | `/Conflicts/rss` → HTTP 200 XML; **most recent item dated 2023-04-26**, bulk from 2022 | **ZOMBIE** — alive but hasn't ingested a new tweet in ~3 years |
| `https://nitter.cz` | **DNS ERR_NAME_NOT_RESOLVED** on direct probe; homepage retry → 403 challenge | **DEAD** |
| `https://nitter.fdn.fr` | **DNS ERR_NAME_NOT_RESOLVED** | **DEAD** |

**Conclusion:** 0 of 6 mirrors deliver usable fresh tweets. The adapter's fallback logic will exhaust all mirrors and return an empty `posts: []` every run. Recommend removing the source from the sweep and replacing with Bluesky/Telegram coverage.

## Priority Fixes

Ordered by impact × ease.

1. **nitter.mjs → retire or replace** (high impact, low effort). Zero mirrors work. Currently costs ~66 HTTP timeouts per sweep for zero data. Delete adapter, migrate handle list to telegram.mjs + bluesky.mjs.
2. **opensanctions.mjs → add API key support** (high impact, low effort). The adapter logic is fine; just needs `Authorization: ApiKey ${process.env.OPENSANCTIONS_API_KEY}` header and a graceful-degrade check like eia/fred have.
3. **patents.mjs → update hostname** (high impact, trivial effort). Change `search.patentsview.org` → `api.patentsview.org`. Likely a 1-line fix.
4. **reliefweb.mjs → register approved appname** (medium impact, low effort). The HDX fallback works for humanitarian signal, but ReliefWeb primary gives cleaner structured disaster data. Send the registration email and set `RELIEFWEB_APPNAME`.
5. **bluesky.mjs → switch to authenticated AppView or firehose** (medium impact, moderate effort). Public API is firmly blocked now; firehose jetstream gives real-time OSINT tweet-equivalents keyless.
6. **safecast.mjs → document staleness, add freshness flag** (low impact, low effort). Data is real but multi-year-stale for target sites. Adapter should set `status: "stale"` when most-recent reading > 30 days for the queried site, so consumers aren't misled.
7. **adsb.mjs public feed path → remove or gate more clearly** (low impact, low effort). The `globe.adsbexchange.com` JSON is firmly 403 to automated UAs. Only the RapidAPI path is viable; adapter should short-circuit when no key instead of probing the dead public feed.
8. **kiwisdr.mjs → re-verify in production environment** (low impact, unknown effort). Our test harness had redirect issues but the site `receiverbook.de` homepage is known to serve. Not urgent, low-signal source anyway.
9. **epa.mjs → verify redirect handling** (low impact, low effort). Same test-harness artifact; adapter's `safeFetch` should follow the HTTPS redirect correctly at runtime.
10. **noaa.mjs → no action needed** (works fine). Included for completeness.
