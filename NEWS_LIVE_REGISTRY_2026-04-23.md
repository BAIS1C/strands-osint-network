# S.O.N Live News Registry — 2026-04-23

## Overview

24/7 YouTube live news streams are mapped to broadcaster HQ coordinates and surface on the S.O.N globe as CCTV-category markers with `category: 'news-live'`. Click any marker to open the live stream inline.

Rather than hardcoding rotating VIDEO_IDs, S.O.N uses the **YouTube Data API v3** to resolve each broadcaster's **current** live video ID at sweep time.

## Why this approach

Hardcoded VIDEO_IDs rot. Every time a network restarts its livestream (every few weeks for most, every few months for the stable ones), the video ID changes and every embed goes to Error 153. Stable channel IDs (the `UCxxxxx` identifiers) plus API resolution gives a library that self-heals per sweep.

## Setup

1. Visit https://console.cloud.google.com
2. Create a project or pick an existing one
3. Enable **YouTube Data API v3** under APIs & Services
4. Create an API key under Credentials
5. Restrict the key to the YouTube Data API v3 (security hygiene; not required)
6. Add to `.env`:

```
YOUTUBE_API_KEY=your_key_here
```

Restart `node server.mjs`. On the next sweep the adapter will resolve every entry in `CHANNEL_REGISTRY` (in `apis/sources/news_live.mjs`) to whatever video is currently streaming live on that channel, or skip it quietly if the channel is dark.

## Quota math

- `search.list` (with `eventType=live`) costs 100 quota units per call.
- Free tier is 10,000 units/day.
- 25 channels × 4 sweeps/hour × 24 hours × 100 units = 240,000 units/day (would blow quota).
- Adapter caches resolved IDs for 14 minutes in-memory.
- Effective cost: ~25 calls × 4/hour × 24 hours × 100 = 240,000 cached — wait, re-math:
- With 14-min cache, each channel resolves once per sweep window (every 15 min). That's 25 channels × 96 sweeps/day = 2,400 calls = **240,000 units**. Still over budget.

Therefore the **default sweep interval of 15 minutes is NOT compatible with the free tier** if all 25 channels are polled every sweep. Options:

1. Cut the registry to 10 channels = 96,000 units/day (under free tier).
2. Increase `CACHE_TTL_MS` in `news_live.mjs` to 60 minutes (4x the sweep interval) — 25 channels resolved once per hour = 25 × 24 × 100 = 60,000 units/day (under free tier).
3. Apply for a YouTube Data API quota increase (free, but requires justification).
4. Rotate the registry — resolve a subset per sweep, round-robin through all channels over the hour.

**Recommended default**: option 2 (hourly cache) for the free tier; option 4 if you want sub-hour freshness without quota juggling.

## Channel Registry

25 entries across 6 continents. See `apis/sources/news_live.mjs` `CHANNEL_REGISTRY` for the full structured list with HQ coordinates.

| Region | Channel | Network | HQ |
|---|---|---|---|
| MEA | Al Jazeera English | Al Jazeera Media | Doha |
| EU | DW News | Deutsche Welle | Bonn |
| EU | FRANCE 24 English | France Médias Monde | Paris |
| EU | Sky News | Sky Group | London |
| EU | Euronews English | Euronews | Lyon |
| EU | TRT World | TRT | Istanbul |
| US | Bloomberg Television | Bloomberg | NYC |
| US | Bloomberg Originals | Bloomberg | NYC |
| US | CNBC | NBCUniversal | Englewood Cliffs NJ |
| US | NBC News NOW | NBCUniversal | NYC |
| US | CBS News | Paramount | NYC |
| US | ABC News | Disney | NYC |
| US | LiveNOW from FOX | Fox Corp | NYC |
| US | NewsNation | Nexstar | Chicago |
| APAC | NHK WORLD-JAPAN | NHK | Tokyo |
| APAC | Arirang News | Arirang | Seoul |
| APAC | KBS World News | KBS | Seoul |
| APAC | WION | Zee Media | Noida |
| APAC | CNA | Mediacorp | Singapore |
| OCE | ABC News (Australia) | ABC | Sydney |
| MENA | i24NEWS English | i24NEWS | Tel Aviv |
| MENA | Al Arabiya English | MBC | Dubai |
| AM | CBC News | CBC | Toronto |

## Known embed-blocked networks

BBC News and CNN historically disable third-party embedding (Error 153). These are deliberately excluded from the registry. If you want a BBC/CNN presence on the globe, the fallback is a static marker with `kind: 'link'` that opens in a new tab instead of an inline iframe.

## Expanding the registry

Add entries to `CHANNEL_REGISTRY` in `apis/sources/news_live.mjs`. Find channel IDs by:

1. Visit the network's YouTube channel page
2. View page source
3. Search for `"channelId":"UC` — the value is the stable channel ID

Remember that a channel must actually stream live 24/7 (or near-24/7) for this approach to pay off. Networks that only go live for shows will usually return empty from the adapter.

## Architecture: why this lives under CCTV

The S.O.N CCTV layer already handles iframe embeds with inspector playback, geo-marker rendering, and band tile grids. News-live streams re-use all of it. The only new metadata is `category: 'news-live'` which the client uses to pick a distinct marker glyph (**TV** instead of **CAM**) once the renderer is wired — that's a small future enhancement in `app.js` `renderCCTV`.
