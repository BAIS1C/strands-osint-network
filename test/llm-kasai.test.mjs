import test from 'node:test';
import assert from 'node:assert/strict';
import { KasaiProvider } from '../lib/llm/kasai.mjs';
import { createLLMProvider } from '../lib/llm/index.mjs';

test('KasaiProvider initializes correctly', () => {
  const provider = new KasaiProvider({ baseUrl: 'http://127.0.0.1:8420', model: 'kasai-local' });
  assert.equal(provider.name, 'kasai');
  assert.equal(provider.baseUrl, 'http://127.0.0.1:8420');
  assert.equal(provider.model, 'kasai-local');
  assert.equal(provider.isConfigured, true);
});

test('createLLMProvider returns KasaiProvider', () => {
  const provider = createLLMProvider({ provider: 'kasai', apiKey: null, model: 'kasai-local', baseUrl: 'http://127.0.0.1:8420' });
  assert.ok(provider instanceof KasaiProvider);
});

test('KasaiProvider complete() maps /api/chat response', async () => {
  const provider = new KasaiProvider({ baseUrl: 'http://127.0.0.1:8420', model: 'kasai-local' });
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8420/api/chat');
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.stream, false);
    assert.match(body.message, /USER:/);
    return {
      ok: true,
      json: async () => ({
        response: 'Kasai says hello',
        model: 'kasai-local',
      }),
    };
  };

  try {
    const result = await provider.complete('system prompt', 'hello');
    assert.equal(result.text, 'Kasai says hello');
    assert.equal(result.model, 'kasai-local');
  } finally {
    global.fetch = originalFetch;
  }
});

test('KasaiProvider ping() uses /health', async () => {
  const provider = new KasaiProvider({ baseUrl: 'http://127.0.0.1:8420' });
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.equal(url, 'http://127.0.0.1:8420/health');
    return { ok: true };
  };
  try {
    const ok = await provider.ping();
    assert.equal(ok, true);
  } finally {
    global.fetch = originalFetch;
  }
});
