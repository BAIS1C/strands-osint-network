# S.O.N — UI Redesign Handoff

## What this is

A complete UI redesign of **strands-osint-network** (S.O.N) layered on the **everywear OS** design system. The reference build is in `son-redesign/` — six fully-mocked screens, all 13 OSINT layers, three skins × two modes, and a working in-page Tweaks panel for skin/mode/density/screen.

The mock is React-via-Babel so it runs from a single `index.html`. Your job is to port the layout, tokens, and component vocabulary into the real app while keeping the existing backend (single-binary Node + Express + sweep orchestrator + LM Studio bridge) untouched.

**Default skin: `terminal · dark`. All three skins (terminal / classic / refined) and both modes (dark / light) must remain available at runtime via a `data-skin` + `data-mode` attribute on `<html>`.**

---

## Files in this bundle

```
son-redesign/
  index.html              # entry — sets data-skin, mounts <App/>
  styles.css              # SON-specific layout (grid columns, panels, alert console, etc.)
  components.jsx          # Ico, LAYERS (the 13), LayerPanel, GlobeStage (SVG placeholder), FeedRail
  screens.jsx             # Worldview · Consigliere · Inspector · Alerts · Settings · Boot
  tweaks-panel.jsx        # The everywear tweaks-panel starter (do not modify protocol)
  image-slot.js           # Drop-in image slot web component (used by feed cards if needed)
  everywear/
    tokens.css            # CANONICAL — copy verbatim into the real app
    components.css        # CANONICAL — copy verbatim
    icons.css             # CANONICAL — copy verbatim
HANDOFF.md                # this file
```

---

## Mapping the mock → the real app

The mock screen IDs map to existing routes/views in the live app. Replace, do not rebuild:

| Mock screen   | Live concept                       | Replace                                                        |
|---------------|------------------------------------|----------------------------------------------------------------|
| `worldview`   | Cesium globe + layer chips + panels| `index.html` body, `assets/js/dashboard.js`, layer chip CSS    |
| `consigliere` | LM Studio chat panel               | `assets/js/consigliere.js` + chat markup                       |
| `inspector`   | News / CCTV / social card grid     | The "drop panels here" zone + feed widgets                     |
| `alerts`      | Telegram / Discord / Webhook log   | `routes/alerts.mjs` viewer + delivery log table                |
| `settings`    | API keys + LM Studio config        | `views/settings.html` and the `.env` reload UI                 |
| `loading`     | Boot sweep log                     | `assets/boot.html` (the splash before websocket attaches)      |

The taskbar, titlebar, command bar and status bar are **app chrome** — they wrap every route, including the existing globe view. Implement them in a layout component (`<AppShell>` or an Express partial) and let routes render into `.son-surface`.

---

## Implementation order

### 1. Drop in everywear (1 day)
1. Copy `son-redesign/everywear/{tokens,components,icons}.css` into `public/everywear/` (or wherever your static dir is).
2. Add `<link>` tags to your root template **before** any existing CSS.
3. On `<html>` set `data-skin="terminal"` and `data-mode="dark"`. Persist user choice in `localStorage`.
4. Wrap the body with `class="ew"` so the everywear baseline applies.

**Acceptance:** existing dashboard renders with everywear typography (Orbitron / Rajdhani / JetBrains Mono) and the terminal palette (phosphor amber on near-black). Layout untouched yet.

### 2. App chrome (2 days)
Replace the current top bar (`MONITOR v2.8.0 @eliehabib · LIVE · Global ▾ · DEFCON 3 34% · Search · Sign In`) with the two-row chrome:

- **Titlebar** (32px): traffic lights · `S.O.N · strands osint network` brand · tab strip (Worldview / Consigliere / Inspector / Alerts / Settings) · `DEFCON N` chip · version · user.
- **Command bar** (44px): UTC clock · `⌘K` search · region picker · time-window picker · layer count · LM Studio status badge · sweep status badge · tweaks gear.
- **Status bar** (24px): screen name · sweep timer · uplink count · skin/mode/density readout.

All three are flat, monospace, mode-aware. Use `.ew-tab`, `.ew-btn--sm`, `.ew-badge` from `everywear/components.css` — no custom hex.

**Acceptance:** route changes update the active tab; UTC clock ticks; clicking the gear opens the tweaks panel.

### 3. Worldview body grid (3 days)
This is the big one. Replace the current 4-column dashboard with:

```css
.son-body {
  display: grid;
  grid-template-columns: var(--col-layers, 280px) 1fr var(--col-feeds, 420px);
}
.son-body[data-collapsed-layers="1"] { --col-layers: 36px; }
.son-body[data-collapsed-feeds="1"]  { --col-feeds: 36px; }
```

- **Left:** `<LayerPanel>` from `components.jsx`. Replace the existing flat layer list with the **kinetic / passive** split, status dots (ok / key / deg / fail), region pull buttons. The 13 layers are defined in `components.jsx LAYERS[]`. Keep your existing `toggleLayer` calls — only the markup changes.
- **Center:** the existing Cesium canvas. Add the overlay chrome from `<GlobeStage>` (top-left title pill, top-right 3D/2D/CV + shader picker, bottom sweep strip, bottom-right zoom cluster, attribution). The `<GlobeSVG>` placeholder is **only for the mock** — drop it; keep Cesium.
- **Right:** `<FeedRail>` with three collapsible sections — **Live News** (tabs per source, card list), **Live CCTV** (2-col video grid, give it `flex: 1` so it absorbs leftover height), **AI Insights** (mini-cards). The rail must be top-to-bottom collapsible with chevron buttons in each section header.

**Acceptance:** both side panels collapse to 36px rails; globe stays centered at all panel states; CCTV grid grows to fill vertical space; sweep strip animates in real time from the websocket.

### 4. Consigliere (2 days)
3-pane layout: 56px tray gutter · 280px session list · 1fr chat. Chat bubbles use `.son-chat-bubble`. Tool-use rows render inline (`.son-chat-tool` with green ✓ / red ✗ / amber …) above source citation chips (`.son-chat-cite-chip`). The existing LM Studio streaming response goes in the bubble; tool calls intercept the stream and render as the user-visible action log.

**Acceptance:** when the model calls `toggleLayer`, `flyTo`, `querySource`, etc., the chip appears in real time and the globe responds (or the side panel re-renders) within the same screen.

### 5. Inspector / Alerts / Settings (2 days each)
Straightforward — these are all token-driven layouts on top of the existing data sources:

- **Inspector:** 280px filters + auto-fill card grid (`minmax(260px, 1fr)`) + 360px detail. Cards are layer-tagged (`CAM`, `RSS`, `SOC`). LIVE pill on video sources.
- **Alerts:** 360px alert list + 1fr detail. Each alert shows per-channel delivery state (Telegram / Discord / Webhook / Email) as a 2×2 card grid. Wire to your existing alert log table.
- **Settings:** 2-col API key cards. Each card: name · description · masked input · reveal · "get @" link · unlocked-feature badges. Add an LM Studio block at the bottom (endpoint / model / tools / status). Hook to existing `.env` reload endpoint.

### 6. Boot screen (0.5 days)
Replace the current splash with the structured boot log (`screens.jsx ScreenLoading`). Stream from your existing sweep orchestrator events; map each source health to `info` / `ok` / `warn` / `fail` line classes. Progress bar reads `completedSweeps / totalSources`.

### 7. Theme + size toggles (REQUIRED in production) (0.5 days)
**These are first-class user features, not dev affordances.** Surface them as toggleable options the operator can flip at runtime:

- **Theme toggle:** skin (`terminal` / `classic` / `refined`) + mode (`dark` / `light`) — 6 combinations, all must work. Place the control in the command bar (gear icon → popover) **and** mirror it in Settings → Appearance.
- **Size toggle:** density (`compact` / `default` / `roomy`) — same surface as theme. Affects spacing tokens only; no layout reflow needed.

Persist all three to `localStorage` (`son.skin`, `son.mode`, `son.density`). Apply via `data-skin` / `data-mode` / `data-density` attributes on `<html>` — the everywear tokens already handle every visual change downstream, so you do not need any other state.

You can drop `tweaks-panel.jsx` from production; it was a dev affordance. The toggles themselves are a permanent part of the operator UI.

---

## Hard rules

- **Zero raw hex.** Every color comes from `--ew-*` tokens. If you need a new shade, derive it with `color-mix(in oklab, var(--ew-primary) N%, transparent)`.
- **All three skins must work.** When you write a component, mentally check it under `[data-skin="terminal"][data-mode="dark"]`, `[data-skin="classic"][data-mode="dark"]`, and `[data-skin="refined"][data-mode="light"]` — the mock has all six combinations rendering correctly.
- **Density: `compact` is the operator default for terminal**; `default` is the operator default for classic; `roomy` is reserved for refined / light mode.
- **Globe is sacred.** It must remain centered and grow as panels collapse. Never put the globe in a fixed-width column.
- **CCTV is prominent.** It is the second most important surface after the globe. Give it real pixels — 2-col grid minimum, 16:10 aspect, always live timecodes.
- **Status dots only.** Do not invent new color semantics. Use `--ew-success` (ok), `--ew-warning` (key-gated / degraded), `--ew-danger` (failed), `--ew-text-faint` (muted).
- **Don't touch the everywear CSS.** If the design system needs a token that isn't there, file an issue against the design system project, don't patch in the app.

---

## Testing checklist

- [ ] All three skins switch cleanly with no FOUC.
- [ ] Light mode is readable on every screen (especially terminal-light).
- [ ] Globe stays centered when both panels are collapsed, both expanded, one collapsed.
- [ ] CCTV grid fills available height; never letterboxed.
- [ ] Consigliere tool-use rows appear in stream order with the correct status icon.
- [ ] Alert console shows the failed Webhook channel in red and offers Retry.
- [ ] Settings reload triggers a sweep without restarting the binary.
- [ ] Boot log scrolls smoothly during the initial 18s sweep.
- [ ] No raw hex anywhere in the app's own CSS — only `var(--ew-*)`.

---

## Open questions for the team

1. Does `Refined` need its own dashboard layout, or is it purely a token swap on top of `Terminal`?  *(mock assumes pure token swap)*
2. Should the tab strip live in the titlebar (current mock) or move to the left rail as vertical icons? *(mock uses titlebar; vertical rail might scale better past 6 tabs)*
3. Do we need a dedicated `Replay` route for the time-scrubber, or does it overlay on Worldview? *(not in mock)*
4. The mock CCTV grid is 2-col; if we end up with 27 simultaneous streams, do we paginate, virtualise, or downscale to a 4-col mosaic?

---

## Reference

The mock at `son-redesign/index.html` is the canonical visual spec. When in doubt, open it side-by-side with your branch and match.
