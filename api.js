/**
 * api.js — client-side API abstraction layer.
 *
 * IMPORTANT: this file NEVER contains a provider API key. In production the
 * browser only ever talks to YOUR OWN backend (see /server). The backend is
 * the only place that holds the real Anthropic/OpenAI/etc. key and decides
 * which provider to call. This keeps the key off the client and lets you
 * swap providers without touching any frontend code.
 *
 * Endpoints expected from the backend (see server/server.js):
 *   POST /api/chat     { messages, system }        -> { reply }
 *   POST /api/search    { query }                   -> { results: [{title, url, snippet}], available }
 *
 * If no backend is running, calls will fail with a clear, visible error
 * instead of silently pretending to work — see FluentAPI.chat() below.
 */

const FluentAPI = (() => {
  // Change this if your backend runs on a different host/port.
  const BASE_URL = window.FLUENT_BACKEND_URL || "/api";

  async function chat(messages, system) {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, system }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Backend chat request failed (${res.status}). Make sure the server in /server is running and ANTHROPIC_API_KEY is set. ${text}`
      );
    }
    const data = await res.json();
    return data.reply;
  }

  async function search(query) {
    try {
      const res = await fetch(`${BASE_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return { available: false, results: [] };
      return await res.json();
    } catch (e) {
      // Search layer is optional — fail soft, the tutor will just say it
      // can't verify current events rather than crash.
      return { available: false, results: [] };
    }
  }

  return { chat, search, BASE_URL };
})();
