// S.O.N Worldview — Chat Panel
// Wires the consigliere chat UI to /api/chat, dispatches client-side tool
// calls (map control), and renders the conversation log.

export class ChatPanel {
  constructor({ logEl, inputEl, sendEl, clearEl, clientTools = {} }) {
    this.logEl = logEl;
    this.inputEl = inputEl;
    this.sendEl = sendEl;
    this.clearEl = clearEl;
    this.clientTools = clientTools;
    this.history = [];          // {role, content, tool_call_id?, name?}
    this.busy = false;

    sendEl.addEventListener('click', () => this.send());
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(120, inputEl.scrollHeight) + 'px';
    });
    if (clearEl) clearEl.addEventListener('click', () => this.clear());
  }

  clear() {
    this.history = [];
    // Keep the initial greeting if present as first child, wipe the rest
    const children = Array.from(this.logEl.children);
    for (let i = 1; i < children.length; i++) children[i].remove();
  }

  _appendMsg(role, text, opts = {}) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${role}`;
    const who = role === 'assistant' ? 'CONSIGLIERE'
              : role === 'user' ? 'SEAN'
              : role === 'tool' ? `TOOL · ${opts.name || ''}`
              : role.toUpperCase();
    msg.innerHTML = `<div class="who">${who}</div><div class="body"></div>`;
    msg.querySelector('.body').textContent = text;
    this.logEl.appendChild(msg);
    this.logEl.scrollTop = this.logEl.scrollHeight;
    return msg;
  }

  _appendThinking() {
    const el = document.createElement('div');
    el.className = 'chat-thinking';
    el.innerHTML = `thinking <span class="dots"></span>`;
    this.logEl.appendChild(el);
    this.logEl.scrollTop = this.logEl.scrollHeight;
    return el;
  }

  async send() {
    if (this.busy) return;
    const text = (this.inputEl.value || '').trim();
    if (!text) return;
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';
    this._appendMsg('user', text);
    this.history.push({ role: 'user', content: text });

    this.busy = true;
    this.sendEl.disabled = true;
    const thinkingEl = this._appendThinking();

    try {
      // First turn
      let done = false;
      let iterations = 0;
      while (!done && iterations < 6) {
        iterations++;
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: this.history,
            includeTrace: true,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          thinkingEl.remove();
          this._appendMsg('assistant', `[error ${res.status}] ${txt.substring(0, 300)}`);
          break;
        }
        const payload = await res.json();

        // Server already ran its tool loop. Append reply to history.
        if (payload.reply) {
          thinkingEl.remove();
          this._appendMsg('assistant', payload.reply);
          this.history.push({ role: 'assistant', content: payload.reply });
        }

        // Check if the server-returned trace contained client-side tool calls
        // that weren't resolvable on the server side. For now, server handles
        // all tool execution; client tools are dispatched separately when
        // the assistant text contains a structured directive (legacy fallback).
        const clientCalls = this._extractClientToolCalls(payload);
        if (clientCalls.length) {
          for (const call of clientCalls) {
            const fn = this.clientTools[call.name];
            if (!fn) continue;
            try {
              const result = fn(call.args || {});
              this._appendMsg('tool', JSON.stringify(result, null, 2), { name: call.name });
              this.history.push({
                role: 'tool',
                name: call.name,
                content: JSON.stringify(result),
                tool_call_id: call.id || call.name,
              });
            } catch (e) {
              console.warn('[chat] client tool error:', e);
            }
          }
          // After handling client tools, loop to let LLM see results
          continue;
        }

        done = true;
      }
    } catch (e) {
      thinkingEl.remove();
      this._appendMsg('assistant', `[exception] ${String(e).substring(0, 300)}`);
    } finally {
      this.busy = false;
      this.sendEl.disabled = false;
      this.inputEl.focus();
    }
  }

  // Server-side tool loop owns most tool dispatch. For map-control tools we
  // expose a lightweight protocol: if the assistant reply contains one or
  // more fenced ```son-tool\n{json}\n``` blocks, execute them client-side.
  // This keeps the LLM unaware of the client/server tool split.
  _extractClientToolCalls(payload) {
    const out = [];
    const text = payload.reply || '';
    const re = /```son-tool\s*\n([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      try {
        const obj = JSON.parse(m[1]);
        if (obj && obj.name) out.push(obj);
      } catch {}
    }
    // Also check trace for explicit client tool markers
    if (Array.isArray(payload.trace)) {
      for (const step of payload.trace) {
        if (step?.tool_calls) {
          for (const tc of step.tool_calls) {
            const name = tc.function?.name || tc.name;
            if (name && this.clientTools[name]) {
              let args = {};
              try { args = JSON.parse(tc.function?.arguments || tc.arguments || '{}'); } catch {}
              out.push({ id: tc.id, name, args });
            }
          }
        }
      }
    }
    return out;
  }
}

// ─── Consigliere status pill (ONLINE / OFFLINE / DISABLED) ───────────────
// Polls /api/health every 10s. Server pings the configured LLM provider
// and returns { llmReachable: true|false|null }. We flip the chat-title
// class + text so the operator knows at a glance whether LM Studio (or
// whichever provider) is actually reachable.
//
// Init waits for DOM ready so this works regardless of where the module
// is imported from.
function initLMStatusPoller() {
  const titleEl = document.getElementById('chat-title');
  const textEl = document.getElementById('lm-state-text');
  if (!titleEl || !textEl) {
    // Retry once on the next frame — covers edge case where chat.js is
    // imported before the chat panel HTML is parsed.
    requestAnimationFrame(() => {
      const t2 = document.getElementById('chat-title');
      const x2 = document.getElementById('lm-state-text');
      if (t2 && x2) startPoller(t2, x2);
    });
    return;
  }
  startPoller(titleEl, textEl);
}

function startPoller(titleEl, textEl) {
  function apply(state) {
    titleEl.classList.remove('lm-online', 'lm-offline');
    if (state === 'online') {
      titleEl.classList.add('lm-online');
      textEl.textContent = 'ONLINE';
    } else if (state === 'offline') {
      titleEl.classList.add('lm-offline');
      textEl.textContent = 'OFFLINE';
    } else if (state === 'disabled') {
      textEl.textContent = 'DISABLED';
    } else {
      textEl.textContent = 'CHECKING';
    }
  }

  async function tick() {
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      if (!r.ok) { apply('offline'); return; }
      const j = await r.json();
      if (j.llmReachable === true) apply('online');
      else if (j.llmReachable === false) apply('offline');
      else apply('disabled');
    } catch {
      apply('offline');
    }
  }
  tick();
  setInterval(tick, 10000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLMStatusPoller);
} else {
  initLMStatusPoller();
}
