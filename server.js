/**
 * server.js — minimal backend for the Fluent English Tutor app.
 *
 * Responsibilities:
 *  - Hold the real AI provider API key (never sent to the browser).
 *  - POST /api/chat    -> forwards {messages, system} to the AI provider and
 *                          returns {reply}.
 *  - POST /api/search  -> pluggable "current information" layer. Wire in a
 *                          real search provider here (see comments below).
 *                          Until you do, it returns {available:false} and
 *                          the frontend/system-prompt makes the tutor say so
 *                          honestly instead of inventing news.
 *
 * Swapping providers: everything provider-specific lives in callModel().
 * To use OpenAI, Google, etc. instead of Anthropic, only that function needs
 * to change — routes and the frontend stay the same.
 */

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

/* --------------------------- Provider call --------------------------- */

async function callModel(messages, system) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set on the server. Copy .env.example to .env and add your key."
    );
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system,
      messages, // [{role: 'user'|'assistant', content: '...'}]
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

/* --------------------------------- Routes ------------------------------ */

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, system } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }
    const reply = await callModel(messages, system || "");
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/search", async (req, res) => {
  const { query } = req.body;

  // --- Plug a real search provider here -----------------------------
  // Example using a hypothetical provider:
  //
  //   const r = await fetch(`https://api.yoursearchprovider.com/search?q=${encodeURIComponent(query)}`, {
  //     headers: { Authorization: `Bearer ${process.env.SEARCH_API_KEY}` }
  //   });
  //   const data = await r.json();
  //   return res.json({
  //     available: true,
  //     results: data.results.slice(0, 5).map(r => ({ title: r.title, url: r.url, snippet: r.snippet })),
  //   });
  //
  // If you're calling Claude directly with the Anthropic web_search tool
  // instead of a separate search API, you can instead run that tool call
  // inside callModel() and skip this endpoint entirely.
  // ---------------------------------------------------------------------

  res.json({ available: false, results: [], note: "No search provider configured yet — see server/server.js" });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Fluent backend running on http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn("WARNING: ANTHROPIC_API_KEY is not set — /api/chat will fail until you add it to .env");
  }
});
