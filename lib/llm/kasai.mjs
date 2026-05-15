// Kasai Provider — local Kasai HTTP bridge
// Talks to Kasai Local's embedded Axum server:
//   GET  /health
//   POST /api/chat { message, stream:false }
//
// Current Kasai builds still return a placeholder response from /api/chat, but
// wiring this provider now lets S.O.N adopt the real endpoint as soon as the
// agent loop is connected upstream.

import { LLMProvider } from './provider.mjs';

export class KasaiProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'kasai';
    this.baseUrl = (config.baseUrl || process.env.KASAI_BASE_URL || 'http://127.0.0.1:8420').replace(/\/$/, '');
    this.model = config.model || process.env.KASAI_MODEL || 'kasai-local';
    this.apiKey = config.apiKey || process.env.KASAI_API_KEY || null;
  }

  get isConfigured() { return true; }

  _headers() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  async ping(timeoutMs = 1500) {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(timeoutMs),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  renderPrompt(messages) {
    const parts = [];
    for (const msg of messages || []) {
      const role = (msg.role || 'user').toUpperCase();
      const content = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map(block => block?.text || '').join('\n')
          : '';
      if (!content) continue;
      parts.push(`${role}:\n${content}`);
    }
    parts.push('ASSISTANT:');
    return parts.join('\n\n');
  }

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

  async chat(messages, opts = {}) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        message: this.renderPrompt(messages),
        stream: false,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.4,
      }),
      signal: AbortSignal.timeout(opts.timeout || 120000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Kasai ${res.status} @ ${this.baseUrl}: ${err.substring(0, 300)}`);
    }

    const data = await res.json();
    const text = data.response || data.reply || '';
    return {
      text,
      toolCalls: [],
      finishReason: 'stop',
      message: { content: text },
      raw: data,
    };
  }
}
