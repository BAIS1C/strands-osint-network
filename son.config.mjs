// S.O.N Configuration — all settings with env var overrides

import './apis/utils/env.mjs'; // Load .env first

export default {
  port: parseInt(process.env.PORT) || 3117,
  refreshIntervalMinutes: parseInt(process.env.REFRESH_INTERVAL_MINUTES) || 15,

  // Globe / map (RECON sprint Section 2.1)
  // Free-tier key from console.cloud.google.com → APIs → Map Tiles API.
  // Without this key, S.O.N falls back to a flat ellipsoid + ESRI imagery.
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null,
  cesiumIonToken: process.env.CESIUM_ION_TOKEN || null,

  // Event tracker (RECON sprint Section 6) — free-tier API keys, all optional
  events: {
    eventbriteToken: process.env.EVENTBRITE_TOKEN || null,
    songkickKey: process.env.SONGKICK_API_KEY || null,
    bandsintownKey: process.env.BANDSINTOWN_KEY || null,
    ticketmasterKey: process.env.TICKETMASTER_KEY || null,
    foursquareKey: process.env.FOURSQUARE_KEY || null,
  },

  // Real-time traffic (optional — RECON sprint Section 5)
  hereApiKey: process.env.HERE_API_KEY || null,

  // Military aircraft tracking via ADS-B Exchange (RapidAPI)
  adsbApiKey: process.env.ADSB_API_KEY || process.env.RAPIDAPI_KEY || null,

  llm: {
    // Default to lmstudio so the Consigliere pill correctly reports OFFLINE (red)
    // when LM Studio isn't running. Override with LLM_PROVIDER in .env to switch
    // to anthropic | openai | gemini | codex | openrouter | minimax.
    provider: process.env.LLM_PROVIDER || 'lmstudio',
    apiKey: process.env.LLM_API_KEY || null,
    model: process.env.LLM_MODEL || null,
    baseUrl: process.env.LLM_BASE_URL || null, // override for lmstudio / any OpenAI-compatible endpoint
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || null,
    chatId: process.env.TELEGRAM_CHAT_ID || null,
    botPollingInterval: parseInt(process.env.TELEGRAM_POLL_INTERVAL) || 5000,
    channels: process.env.TELEGRAM_CHANNELS || null, // Comma-separated extra channel IDs
  },

  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN || null,
    channelId: process.env.DISCORD_CHANNEL_ID || null,
    guildId: process.env.DISCORD_GUILD_ID || null,   // Server ID (for instant slash command registration)
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || null, // Fallback: webhook-only alerts (no bot needed)
  },

  // Delta engine thresholds — override defaults from lib/delta/engine.mjs
  // Set to null to use built-in defaults
  delta: {
    thresholds: {
      numeric: {
        // Example overrides (uncomment to customize):
        // vix: 3,       // more sensitive to VIX moves
        // wti: 5,       // less sensitive to oil moves
      },
      count: {
        // urgent_posts: 3,     // need ±3 urgent posts to flag
        // thermal_total: 1000, // need ±1000 thermal detections
      },
    },
  },
};
