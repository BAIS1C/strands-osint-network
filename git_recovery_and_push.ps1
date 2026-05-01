# Git Recovery and Push Script
# Run from PowerShell in C:\Users\MAG MSI\Project SON
# Usage: .\git_recovery_and_push.ps1
#
# Recovers from the corrupted index left by a failed bash renormalize, then
# stages, commits, and pushes the Day 1 sprint work to BAIS1C/strands-osint-network.

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Step($msg) {
  Write-Host ""
  Write-Host "===" $msg "===" -ForegroundColor Cyan
}

Step "1. Recover corrupted git index"
if (Test-Path .git\index.lock) {
  Remove-Item .git\index.lock -Force
  Write-Host "Removed stale .git/index.lock"
}
if (Test-Path .git\index) {
  Remove-Item .git\index -Force
  Write-Host "Removed corrupt .git/index"
}
git reset
if ($LASTEXITCODE -ne 0) { throw "git reset failed (exit $LASTEXITCODE)" }
Write-Host "Index rebuilt from HEAD."

Step "2. Clean up stale temp objects from failed renormalize"
$tempCount = (Get-ChildItem .git\objects -Recurse -Filter 'tmp_obj_*' -ErrorAction SilentlyContinue).Count
if ($tempCount -gt 0) {
  Get-ChildItem .git\objects -Recurse -Filter 'tmp_obj_*' | Remove-Item -Force -ErrorAction SilentlyContinue
  Write-Host "Removed $tempCount stale temp objects."
} else {
  Write-Host "No stale temp objects."
}

Step "3. Verify git identity"
$userName  = git config user.name
$userEmail = git config user.email
if (-not $userName -or -not $userEmail) {
  Write-Host "Setting git identity (Sean Uddin / seanie.sean@gmail.com)"
  git config user.name "Sean Uddin"
  git config user.email "seanie.sean@gmail.com"
  $userName  = git config user.name
  $userEmail = git config user.email
}
Write-Host "user.name  = $userName"
Write-Host "user.email = $userEmail"
Write-Host "If your GitHub account uses a different verified email, change with:"
Write-Host '   git config user.email "your-verified@email.com"'

Step "4. Show working-tree status"
$modified = (git status --short).Length
Write-Host "Files in working tree change set:"
git status --short
Write-Host ""
Write-Host "Total lines (each line is one file): $modified"

Step "5. Stage everything (excluding gitignored google dorking.html)"
git add .
if ($LASTEXITCODE -ne 0) { throw "git add failed (exit $LASTEXITCODE)" }
$staged = (git diff --cached --name-only).Count
Write-Host "Staged files: $staged"

Step "6. Sanity check — should NOT see google dorking.html or node_modules"
$bad = git diff --cached --name-only | Select-String -Pattern 'google dorking|node_modules'
if ($bad) {
  Write-Host "WARNING — these files should not be staged:" -ForegroundColor Yellow
  $bad
  Write-Host "Aborting. Investigate .gitignore and re-run."
  exit 1
}
Write-Host "OK. No accidentally-staged junk."

Step "7. Commit"
$commitMsg = @"
Day 1 sprint: visual upgrade, layer fixes, RECON + Dossier scaffolds

Substantive fixes
- AIR layer: opensky.mjs preserves raw state vectors; V2.opensky exposed in synthesize
- SAT layer: space.mjs preserves TLE_LINE1/2; V2.space.satellites built from launches+stations+ISS
- CCTV inspector merge order fix (app.js:1466)
- RSS Atom + GUID permalink parser (inject.mjs)
- Layout decompression: bands 26vh to 18vh, collapsible bands-folded class
- Google Photorealistic 3D Tiles loader with graceful ellipsoid fallback
- Four shader presets (NVG, FLIR, CRT, OPS) on number keys 0-4
- Auto-collapse plus hover-expand sidebars and bands
- Plane icons (civilian + military silhouettes) heading-rotated
- Verbose per-source sweep logging with honest health classification (ok / key-gated / degraded / failed)
- LM Studio duplicate ping() bug fix (was reporting ONLINE incorrectly)
- FRED + EIA disabled (free tiers discontinued by providers)

Architecture docs
- RECON_SPRINT_ARCHITECTURE_2026-04-30.md — full sprint plan, schema-locked itinerary, RECON v0 spec
- DOSSIER_ARCHITECTURE_2026-05-01.md — Person Recon BI stack, ethics charter, phased rollout
- X_BROWSER_ARCHITECTURE_2026-05-01.md — X / Bluesky access strategy (auth API + Playwright burner)
- LAYER_AUDIT_2026-04-24.md — preserved from earlier audit
- OPTIMIZATION_ARCHITECTURE_2026-04-29.md — preserved as historical critique
- STATUS_2026-04-30_NIGHT.md — Day 1 overnight ship report
- LAYER_U_ARCHITECTURE_2026-04-22.md — addendum appended (Bilawal recalibration, sprint scope, Diary reservation)

Scaffolds (Phase 0, no execution until greenlight)
- apis/recon/ethics.mjs — FUNCTIONAL subject classification gate (load-bearing)
- apis/recon/dossier_builder.mjs — orchestrator stub
- apis/recon/sources/web_search.mjs — representative source adapter
- apis/recon/analysis/bigfive.mjs — representative analysis module
- apis/sources/bluesky_auth.mjs — Bluesky AT Protocol authenticated stub
- apis/sources/x_browser.mjs — X Playwright headless burner stub

Tooling
- .gitattributes added for line-ending normalization (text=auto eol=lf)
- .gitignore extended to exclude MindStudio HTML dumps
- son.config.mjs extended with Maps Platform keys, event APIs, ADS-B, HERE traffic
- .env.example extended with all new key registration URLs
- /api/config endpoint added to server.mjs (exposes public client config)

Co-authored-by: Kasai <kasai@strandsnation.xyz>
"@

git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) { throw "git commit failed (exit $LASTEXITCODE)" }
Write-Host "Commit created."

Step "8. Show the commit"
git log --oneline -3
git log -1 --stat | Select-Object -First 30

Step "9. Push to origin/main"
Write-Host "Pushing to https://github.com/BAIS1C/strands-osint-network.git ..."
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Push failed. Most likely cause: GitHub auth not configured." -ForegroundColor Yellow
  Write-Host "Try one of:"
  Write-Host "  - Install GitHub CLI: winget install --id GitHub.cli, then 'gh auth login'"
  Write-Host "  - Or use a Personal Access Token: GitHub > Settings > Developer settings > PAT (classic) with 'repo' scope"
  Write-Host "  - Then re-run: git push -u origin main"
  exit 1
}

Step "10. Done"
Write-Host "Pushed to GitHub successfully." -ForegroundColor Green
Write-Host "View at: https://github.com/BAIS1C/strands-osint-network/commits/main"
