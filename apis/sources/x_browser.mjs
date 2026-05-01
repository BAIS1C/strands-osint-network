// X (Twitter) — Authenticated Browser Adapter (SCAFFOLD, NOT IMPLEMENTED)
//
// Headless Chromium scraping path for X / Twitter. Replaces dead Nitter mirrors.
// Per X_BROWSER_ARCHITECTURE_2026-05-01.md Section 5.
//
// Status: scaffold. briefing() returns {status: 'not_implemented'} until Sean
// greenlights, creates the burner account, and runs `npm run x:auth-setup`.
//
// Implementation plan (deferred):
//   1. npm install playwright playwright-extra puppeteer-extra-plugin-stealth
//   2. npx playwright install chromium    (~250MB first-run download)
//   3. Build x:auth-setup CLI script that opens non-headless Chromium for
//      manual burner-account login, saves storageState to runs/auth/x.storage-state.json
//   4. briefing() launches headless Chromium with storageState loaded
//   5. For each regional bucket, navigate to x.com/search?q=...&f=live
//   6. Wait for tweets to render, scrape DOM with data-testid selectors
//   7. Geo-tag via existing geoTagText() heuristic in dashboard/inject.mjs
//   8. Return {source, status, posts, totalPosts, authNotes}
//
// Output contract (when shipped):
//   {
//     source: 'X',
//     status: 'active' | 'rate_limited' | 'auth_expired',
//     posts: [{id, author, text, date, likes, reposts, region, lat, lon}],
//     totalPosts: <number>,
//     authNotes: <string>
//   }
//
// Stealth checklist baked into implementation:
//   - playwright-extra + stealth plugin to hide webdriver flag
//   - Real desktop User-Agent string
//   - Randomized viewport dimensions per session
//   - 300-1500ms randomized delays between actions
//   - Max 12 searches per sweep, 5s minimum between searches
//   - locale: 'en-US', timezoneId: 'Asia/Singapore'
//
// Account hygiene: NEVER use Sean's personal X handle. Burner only.
// See X_BROWSER_ARCHITECTURE_2026-05-01.md §5.6 for the burner profile spec.

import { existsSync } from 'fs';
import { join } from 'path';

const STORAGE_STATE_PATH = join(
  process.env.SON_RUNS_DIR || './runs',
  'auth',
  'x.storage-state.json'
);

export async function briefing() {
  if (!existsSync(STORAGE_STATE_PATH)) {
    return {
      source: 'X',
      status: 'no_credentials',
      error: 'No X session state. Run `npm run x:auth-setup` to log in once. See X_BROWSER_ARCHITECTURE_2026-05-01.md §5.2.',
      posts: [],
      totalPosts: 0,
    };
  }
  return {
    source: 'X',
    status: 'not_implemented',
    error: 'X browser adapter scaffolded but not implemented. Greenlight via X_BROWSER_ARCHITECTURE §9.',
    posts: [],
    totalPosts: 0,
  };
}

if (process.argv[1]?.endsWith('x_browser.mjs')) {
  const data = await briefing();
  console.log(JSON.stringify(data, null, 2));
}
