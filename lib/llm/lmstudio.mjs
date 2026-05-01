// LM Studio Provider — OpenAI-compatible local inference
// Connects to a local LM Studio server (default http://localhost:1234/v1)
// No API key required. Supports tool-use for models with tool-capable chat templates
// (Qwen2.5-Instruct, Llama-3.1-Instruct, Hermes-3, Mistral-Small-Instruct, etc.)

import { LLMProvider } from './provider.mjs';

export class LMStudioProvider extends LLMProvider {
  constructor(config) {
    super(config);
    this.name = 'lmstudio';
    this.baseUrl = (config.baseUrl || process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1').replace(/\/$/, '');
    // LM Studio accepts any string as model id; it routes to whatever is loaded.
    // Set LMSTUDIO_MODEL to match the loaded model for clarity in logs.
    this.model = config.model || process.env.LMSTUDIO_MODEL || 'local-model';
    this.apiKey = config.apiKey || 'lm-studio'; // LM Studio ignores the key but OpenAI clients require a non-empty Bearer
  }

  // Treat as configured if the base URL responds. We can't pre-flight in constructor,
  // so isConfigured returns true and failures surface on first call.
  get isConfigured() { return true; }

  // Lightweight reachability probe. Used by /api/health so the UI can flip
  // the Consigliere pill to ONLINE / OFFLINE based on real status, not
  // config presence. Short timeout so a slow or dead LM Studio doesn't
  // block the health endpoint.
  async ping(timeoutMs = 1500) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      clearTimeout(t);
      return res.ok;
    } catch {
      clearTimeout(t);
      return false;
    }
  }

  // Single-shot completion to match the base LLMProvider interface.
  // Used by existing S.O.N LLM consumers (ideas generator, alert synthesiser).
  async complete(systemPrompt, userMessage, opts = {}) {
    const { text, raw } = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ], opts);

    return {
      text,
      usage: {
        inputTokens: raw?.usage?.prompt_tokens || 0,
        outputTokens: raw?.usage?.completion_tokens || 0,
      },
      model: raw?.model || this.model,
    };
  }

  // Multi-turn chat with optional tool-use. Returns the raw assistant message
  // so callers can inspect tool_calls. The /api/chat endpoint orchestrates
  // the tool-use loop on top of this.
  async chat(messages, opts = {}) {
    const body = {
      model: this.model,
      messages,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.4,
      stream: false,
    };

    if (opts.tools?.length) {
      body.tools = opts.tools;
      body.tool_choice = opts.toolChoice || 'auto';
    }
    if (opts.responseFormat) body.response_format = opts.responseFormat;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeout || 120000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`LM Studio ${res.status} @ ${this.baseUrl}: ${err.substring(0, 300)}`);
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message || {};
    return {
      text: message.content || '',
      toolCalls: message.tool_calls || [],
      finishReason: data.choices?.[0]?.finish_reason,
      message,
      raw: data,
    };
  }

  // Note: a second ping() returning {ok, models} previously lived here and
  // shadowed the boolean ping() above (last declaration wins). Server code
  // checked truthiness, so an object {ok:false, error:'...'} read as truthy
  // and the boot banner reported ONLINE even when LM Studio was off.
  // Fix per session 2026-05-01 SGT — keep the single boolean ping() above.
}
