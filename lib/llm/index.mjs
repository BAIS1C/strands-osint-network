// LLM Factory — creates the configured provider or returns null

import { AnthropicProvider } from './anthropic.mjs';
import { OpenAIProvider } from './openai.mjs';
import { OpenRouterProvider } from './openrouter.mjs';
import { GeminiProvider } from './gemini.mjs';
import { CodexProvider } from './codex.mjs';
import { MiniMaxProvider } from './minimax.mjs';
import { LMStudioProvider } from './lmstudio.mjs';
import { KasaiProvider } from './kasai.mjs';

export { LLMProvider } from './provider.mjs';
export { AnthropicProvider } from './anthropic.mjs';
export { OpenAIProvider } from './openai.mjs';
export { OpenRouterProvider } from './openrouter.mjs';
export { GeminiProvider } from './gemini.mjs';
export { CodexProvider } from './codex.mjs';
export { MiniMaxProvider } from './minimax.mjs';
export { LMStudioProvider } from './lmstudio.mjs';
export { KasaiProvider } from './kasai.mjs';

/**
 * Create an LLM provider based on config.
 * @param {{ provider: string|null, apiKey: string|null, model: string|null }} llmConfig
 * @returns {LLMProvider|null}
 */
export function createLLMProvider(llmConfig) {
  if (!llmConfig?.provider) return null;

  const { provider, apiKey, model } = llmConfig;

  switch (provider.toLowerCase()) {
    case 'anthropic':
      return new AnthropicProvider({ apiKey, model });
    case 'openai':
      return new OpenAIProvider({ apiKey, model });
    case 'openrouter':
      return new OpenRouterProvider({ apiKey, model });
    case 'gemini':
      return new GeminiProvider({ apiKey, model });
    case 'codex':
      return new CodexProvider({ model });
    case 'minimax':
      return new MiniMaxProvider({ apiKey, model });
    case 'kasai':
      return new KasaiProvider({ apiKey, model, baseUrl: llmConfig.baseUrl });
    case 'kasai-lite':
      return new LMStudioProvider({ apiKey, model, baseUrl: llmConfig.baseUrl || process.env.KASAI_LITE_BASE_URL || process.env.LMSTUDIO_BASE_URL });
    case 'lmstudio':
    case 'lm-studio':
    case 'local':
      return new LMStudioProvider({ apiKey, model, baseUrl: llmConfig.baseUrl });
    default:
      console.warn(`[LLM] Unknown provider "${provider}". LLM features disabled.`);
      return null;
  }
}
