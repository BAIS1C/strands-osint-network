# S.O.N Context

Updated: 2026-05-15

## What Changed

- Removed dead `X` / `Bluesky` operator affordances from the active worldview workflow by repurposing their band space into:
  - `Local Context`
  - `Source Health`
- Removed the `social` layer registration from the globe so the map no longer advertises broken geotagged social sources.
- Added browser/OS-backed local geolocation support in the worldview client:
  - operator fix marker on the globe
  - auto-focus to the operator on first successful fix
  - `◎` locate control
  - local-context band fed by nearby news, alerts, and CCTV counts
- Fixed the side-panel collapse conflict by consolidating control logic in `worldview/app.js` and removing duplicate toggle handlers from `worldview.html`.
- Smoothed collapse visuals by switching from hard `display:none` snapping to opacity/visibility/transform transitions.
- Fixed `Pull Region` fallback so it re-triggers `/api/sweep` instead of calling the nonexistent `/api/brief`.
- Improved CCTV visibility:
  - feed rail cells now render real thumbnails when available
  - camera view cards render thumbnails instead of placeholder `CAM`
- Added source-health passthrough from the sweep payload into synthesized client data:
  - `sourceHealth`
  - `sourceErrors`
  - `sourceTiming`
- Added Kasai local provider support in the LLM factory:
  - `LLM_PROVIDER=kasai`
  - `LLM_PROVIDER=kasai-lite`
- Added a small Kasai provider unit test.
- Added RSS fallback resolution for selected high-value feeds so a single upstream feed failure does not zero that source family.

## Kasai Notes

- Kasai Local already exposes an HTTP server surface at:
  - `GET /health`
  - `GET /api/models`
  - `POST /api/chat`
- Default bind in the Kasai repo is `127.0.0.1:8420`.
- The current Kasai `POST /api/chat` route is still a placeholder response upstream, so S.O.N can talk to it now, but it is not yet a real operator-grade chat backend until Kasai wires its inference loop to that route.
- `kasai-lite` is mapped to the existing local OpenAI-compatible path so a smaller GGUF loaded through LM Studio can be used immediately as a local conversationalist/operator fallback.

## Remaining Follow-Ups

- Replace the retired social adapters with a working authenticated collection path or keep them fully absent.
- Decide whether to keep browser geolocation as the canonical local-fix source, or add an OS-native Windows location bridge on the server side.
- If Kasai HTTP chat is completed upstream, validate tool-use and upgrade S.O.N from basic text chat to full consigliere tool loop against Kasai.
- Consider a larger RSS architecture pass:
  - publisher fallback chains
  - per-feed health registry
  - cached dedupe across RSS, GDELT, and live-news streams
  - optional local ingest queue for operator-curated feeds
