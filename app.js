/* =========================================================================
   Fluent — English AI Tutor
   app.js — all client logic. Talks to the backend only through api.js.
   ========================================================================= */

const STORAGE_KEY = "fluent_state_v1";

/* ----------------------------- Modes -------------------------------- */
const MODES = {
  free: {
    title: "Free Conversation",
    desc: "Talk about anything, at your own pace",
    emoji: "💬",
    brief: "General conversation partner. Discuss daily life, study, work, economy, technology, business, culture, travel, sport, films, and current opinions/issues. Keep it natural, ask follow-up questions, and don't end the conversation quickly when the user shares an opinion — discuss it with them.",
  },
  ielts: {
    title: "IELTS Speaking",
    desc: "A full mock speaking test with a band estimate at the end",
    emoji: "🎓",
    brief: "Run a realistic IELTS Speaking mock test. Move through Part 1 (short personal questions, 4-5 questions), Part 2 (give a cue card topic, let the user talk for ~2 minutes after 1 minute of prep, don't interrupt), and Part 3 (deeper discussion questions related to the Part 2 topic). Vary the questions each time — don't reuse an obviously predictable set, and adapt difficulty based on answers. Whenever you move to a new part, include a tag like [[IELTS_PART]]2[[/IELTS_PART]] (just the number) at the very start of your message, invisible marker only.",
  },
  debate: {
    title: "Debate",
    desc: "Pick a side and defend your point of view",
    emoji: "⚖️",
    brief: "Choose (or let the user choose) a debatable topic and argue a position, respectfully disagreeing with the user so they have to defend their view with reasons and evidence. Push back constructively, don't just agree.",
  },
  news: {
    title: "News Discussion",
    desc: "Talk through current events (uses web search when available)",
    emoji: "📰",
    brief: "Discuss current events and news topics. Never invent a headline, statistic, or claim about something recent — if you are not certain a SEARCH_RESULTS block was provided for this turn, say plainly that you'd need a web search to confirm anything time-sensitive, and discuss the general topic/background instead. When search results ARE provided below, cite the source name so the user can look it up.",
  },
  interview: {
    title: "Job Interview",
    desc: "Practice answering (and asking) interview questions in English",
    emoji: "💼",
    brief: "Act as a hiring manager conducting a realistic job interview in English. Ask common and role-specific interview questions, follow up on vague answers, and occasionally give the user a chance to ask questions back.",
  },
  daily: {
    title: "Daily English",
    desc: "Practical, everyday situations and small talk",
    emoji: "☕",
    brief: "Practice everyday, practical English: ordering food, small talk, appointments, shopping, directions, phone calls. Roleplay short realistic scenes when useful.",
  },
  vocab: {
    title: "Vocabulary Practice",
    desc: "Build and review vocabulary suited to your level",
    emoji: "📚",
    brief: "Focus the conversation on vocabulary building. When the user uses a very basic word that could be upgraded for their level (especially IELTS-relevant), suggest 1-2 natural alternatives and briefly explain the difference in nuance. Don't force upgrades on words that are already the right choice.",
  },
  grammar: {
    title: "Grammar Practice",
    desc: "Targeted explanations and short exercises",
    emoji: "🧩",
    brief: "Focus on grammar. Explain rules simply (in Arabic if the user asks for an Arabic explanation), and give 2-3 short practice exercises based on mistakes the user has actually made, not random textbook drills.",
  },
};

const MODE_ORDER = ["free", "ielts", "debate", "news", "interview", "daily", "vocab", "grammar"];

/* ----------------------------- State -------------------------------- */
function loadState() {
  const defaults = {
    theme: "light",
    level: "auto",
    correctionMode: "immediate",
    currentMode: "free",
    sessions: 0,
    sessionStarted: false,
    vocab: [],          // { word, note, addedAt }
    mistakes: {},        // { "Grammar:subject-verb agreement": { count, type, examples: [] } }
    ieltsScores: [],     // { date, overall, breakdown, tips }
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return Object.assign(defaults, JSON.parse(raw));
  } catch (e) {
    return defaults;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let conversation = [];   // { role: 'user'|'assistant', content: string }  — current session only
let ieltsPart = 1;
let lastSpokenText = "";
let recognition = null;
let recognizing = false;

/* ------------------------------- DOM --------------------------------- */
const $ = (id) => document.getElementById(id);
const chatLog = $("chatLog");
const chatScroll = $("chatScroll");
const composerForm = $("composerForm");
const composerInput = $("composerInput");
const micBtn = $("micBtn");
const micStatus = $("micStatus");
const replayBtn = $("replayBtn");
const rateSlider = $("rateSlider");
const sidebar = $("sidebar");
const panel = $("panel");
const sidebarToggle = $("sidebarToggle");
const panelToggle = $("panelToggle");
const modeList = $("modeList");
const levelSelect = $("levelSelect");
const correctionToggle = $("correctionModeToggle");
const themeToggle = $("themeToggle");
const themeLabel = $("themeLabel");
const resetDataBtn = $("resetDataBtn");
const currentModeTitle = $("currentModeTitle");
const currentModeDesc = $("currentModeDesc");
const ieltsBar = $("ieltsBar");
const ieltsPartLabel = $("ieltsPartLabel");
const endIeltsBtn = $("endIeltsBtn");
const toast = $("toast");
const statSessions = $("statSessions");
const statVocab = $("statVocab");
const statMistakes = $("statMistakes");

/* ============================ Rendering ============================== */

function renderModes() {
  modeList.innerHTML = "";
  MODE_ORDER.forEach((key) => {
    const m = MODES[key];
    const btn = document.createElement("button");
    btn.className = "mode-item" + (key === state.currentMode ? " active" : "");
    btn.innerHTML = `<span class="m-emoji">${m.emoji}</span><span>${m.title}</span>`;
    btn.addEventListener("click", () => switchMode(key));
    modeList.appendChild(btn);
  });
}

function renderTopbar() {
  const m = MODES[state.currentMode];
  currentModeTitle.textContent = m.title;
  currentModeDesc.textContent = m.desc;
  ieltsBar.hidden = state.currentMode !== "ielts";
  if (state.currentMode === "ielts") ieltsPartLabel.textContent = `Part ${ieltsPart}`;
}

function renderStats() {
  statSessions.textContent = state.sessions;
  statVocab.textContent = state.vocab.length;
  statMistakes.textContent = Object.keys(state.mistakes).length;
}

function renderVocabPanel() {
  const list = $("vocabList");
  if (!state.vocab.length) {
    list.innerHTML = `<div class="empty-hint">No words saved yet. Look for "Add to vocabulary" suggestions during chat.</div>`;
    return;
  }
  list.innerHTML = state.vocab
    .slice()
    .reverse()
    .map(
      (v) => `<div class="card"><div class="card-title">${escapeHtml(v.word)}</div><div class="card-sub">${escapeHtml(v.note || "")}</div></div>`
    )
    .join("");
}

function renderMistakesPanel() {
  const list = $("mistakesList");
  const entries = Object.entries(state.mistakes).sort((a, b) => b[1].count - a[1].count);
  if (!entries.length) {
    list.innerHTML = `<div class="empty-hint">Nothing tracked yet — keep chatting and repeated errors will show up here.</div>`;
    return;
  }
  list.innerHTML = entries
    .map(([key, v]) => {
      const example = v.examples[v.examples.length - 1] || {};
      return `<div class="card">
        <span class="count-badge">${v.count}×</span>
        <div class="card-title">${escapeHtml(v.type)}</div>
        ${example.original ? `<div class="card-sub">"${escapeHtml(example.original)}" → ${escapeHtml(example.fix || "")}</div>` : ""}
      </div>`;
    })
    .join("");
}

function renderReportPanel(report) {
  const empty = $("reportEmpty");
  const content = $("reportContent");
  if (!report) {
    empty.style.display = "block";
    content.innerHTML = "";
    return;
  }
  empty.style.display = "none";
  const b = report.breakdown || {};
  content.innerHTML = `
    <div class="band-overall">
      <div class="b-big">${escapeHtml(String(report.overall ?? "—"))}</div>
      <div class="b-note">Estimated overall band — not an official score</div>
    </div>
    <div class="band-grid">
      <div class="band-cell"><div class="b-score">${escapeHtml(String(b.fluency ?? "—"))}</div><div class="b-label">Fluency &amp; Coherence</div></div>
      <div class="band-cell"><div class="b-score">${escapeHtml(String(b.lexical ?? "—"))}</div><div class="b-label">Lexical Resource</div></div>
      <div class="band-cell"><div class="b-score">${escapeHtml(String(b.grammar ?? "—"))}</div><div class="b-label">Grammatical Range</div></div>
      <div class="band-cell"><div class="b-score">${escapeHtml(String(b.pronunciation ?? "—"))}</div><div class="b-label">Pronunciation</div></div>
    </div>
    <div class="card"><div class="card-title">Why this estimate</div><div class="card-sub">${escapeHtml(report.explanation || "")}</div></div>
    <div class="card" style="margin-top:8px"><div class="card-title">How to move up a band</div><div class="card-sub">${escapeHtml(report.tips || "")}</div></div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function scrollToBottom() {
  chatScroll.scrollTop = chatScroll.scrollHeight;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

/* --------------------------- Chat bubbles ----------------------------- */

function appendMessage(role, text) {
  if (!text) return;
  const wrap = document.createElement("div");
  wrap.className = `msg ${role === "user" ? "user" : "bot"}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  chatLog.appendChild(wrap);
  scrollToBottom();
}

function appendSystemNote(text) {
  const el = document.createElement("div");
  el.className = "system-note";
  el.textContent = text;
  chatLog.appendChild(el);
  scrollToBottom();
}

function appendCorrectionCard(c) {
  const el = document.createElement("div");
  el.className = "correction-card";
  el.innerHTML = `
    <span class="c-tag">${escapeHtml(c.type || "Correction")}</span>
    <div class="c-orig">${escapeHtml(c.original || "")}</div>
    <div class="c-fix">→ ${escapeHtml(c.fix || "")}</div>
    ${c.explanation ? `<div class="c-why">${escapeHtml(c.explanation)}</div>` : ""}
  `;
  chatLog.appendChild(el);
  scrollToBottom();

  if (c.type && c.original) {
    const key = c.type + ":" + c.original.slice(0, 40);
    const bucket = state.mistakes[c.type] || { count: 0, type: c.type, examples: [] };
    bucket.count += 1;
    bucket.examples.push({ original: c.original, fix: c.fix });
    if (bucket.examples.length > 5) bucket.examples.shift();
    state.mistakes[c.type] = bucket;
    saveState();
    renderMistakesPanel();
    renderStats();
  }
}

function appendVocabSuggest(v) {
  const el = document.createElement("div");
  el.className = "vocab-suggest";
  const btnId = "vocabbtn-" + Math.random().toString(36).slice(2, 8);
  el.innerHTML = `<span><strong>${escapeHtml(v.word)}</strong> — ${escapeHtml(v.note || "")}</span><button class="vocab-add-btn" id="${btnId}">+ Add to vocabulary</button>`;
  chatLog.appendChild(el);
  scrollToBottom();
  $(btnId).addEventListener("click", () => {
    addVocab(v.word, v.note);
    $(btnId).textContent = "Added ✓";
    $(btnId).disabled = true;
  });
}

function addVocab(word, note) {
  if (state.vocab.some((v) => v.word.toLowerCase() === word.toLowerCase())) {
    showToast("Already in your vocabulary list");
    return;
  }
  state.vocab.push({ word, note, addedAt: Date.now() });
  saveState();
  renderVocabPanel();
  renderStats();
  showToast(`Added "${word}" to vocabulary`);
}

let typingEl = null;
function showTyping() {
  typingEl = document.createElement("div");
  typingEl.className = "msg bot";
  typingEl.innerHTML = `<div class="bubble typing-dots"><span></span><span></span><span></span></div>`;
  chatLog.appendChild(typingEl);
  scrollToBottom();
}
function hideTyping() {
  if (typingEl) {
    typingEl.remove();
    typingEl = null;
  }
}

/* ===================== Structured tag parsing ========================= */
/* The model is asked (via the system prompt) to wrap structured data in
   simple [[TAG]]...json...[[/TAG]] markers. We strip them from the visible
   text and parse them into UI elements. Kept deliberately simple (no real
   XML/JSON schema validation) since this is a teaching demo, not a
   production parser. */

function extractTag(text, tag) {
  const re = new RegExp(`\\[\\[${tag}\\]\\]([\\s\\S]*?)\\[\\[\\/${tag}\\]\\]`, "g");
  const found = [];
  let m;
  let stripped = text;
  while ((m = re.exec(text)) !== null) {
    found.push(m[1].trim());
  }
  stripped = stripped.replace(re, "").trim();
  return { found, stripped };
}

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function processAssistantReply(raw) {
  let text = raw;

  // IELTS part marker: [[IELTS_PART]]2[[/IELTS_PART]]
  let r = extractTag(text, "IELTS_PART");
  text = r.stripped;
  if (r.found.length) {
    const n = parseInt(r.found[r.found.length - 1], 10);
    if (!isNaN(n)) {
      ieltsPart = n;
      ieltsPartLabel.textContent = `Part ${n}`;
    }
  }

  // Correction block(s): [[CORRECTION]]{...}[[/CORRECTION]]
  r = extractTag(text, "CORRECTION");
  text = r.stripped;
  const corrections = r.found.map(tryParseJSON).filter(Boolean);

  // Vocabulary suggestion(s): [[VOCAB]]{...}[[/VOCAB]]
  r = extractTag(text, "VOCAB");
  text = r.stripped;
  const vocabSuggestions = r.found.map(tryParseJSON).filter(Boolean);

  // IELTS / session report: [[IELTS_REPORT]]{...}[[/IELTS_REPORT]]
  r = extractTag(text, "IELTS_REPORT");
  text = r.stripped;
  const report = r.found.map(tryParseJSON).filter(Boolean)[0] || null;

  // Level estimate (auto mode): [[LEVEL_ESTIMATE]]B1[[/LEVEL_ESTIMATE]]
  r = extractTag(text, "LEVEL_ESTIMATE");
  text = r.stripped;
  const levelEstimate = r.found[r.found.length - 1] || null;

  return { text: text.trim(), corrections, vocabSuggestions, report, levelEstimate };
}

/* ============================ System prompt ============================ */

function buildSystemPrompt() {
  const mode = MODES[state.currentMode];
  const level = state.level === "auto" ? "auto-detect the level from the user's English and mention it only via the [[LEVEL_ESTIMATE]] tag, do not lecture the user about it" : state.level;

  return `You are "Fluent", a warm, encouraging, highly qualified English tutor. You combine several roles in one: conversation partner, IELTS Speaking/Writing expert, grammar corrector, vocabulary coach, debate partner, and news-discussion assistant.

CURRENT MODE: ${mode.title}. ${mode.brief}

LEARNER LEVEL: ${level}. Adjust vocabulary, sentence complexity, and pace to this level. Don't use advanced words without reason.

CORE RULES:
- Sound like a real person, not a scripted bot with memorized questions. Follow the thread of what the user says.
- Ask natural follow-up questions instead of ending the conversation quickly, especially when the user shares an opinion.
- Remember and use context from earlier in this session.
- Don't interrupt or redirect a user who is in the middle of a longer answer (e.g. IELTS Part 2) unless they ask you to.
- Don't correct everything — that's annoying. Focus on errors that are real mistakes and especially ones the user repeats. Don't "fix" things that are simply a different, equally valid style.
- Never invent news, statistics, or claims about recent/current events. If nothing relevant was provided to you as search context for this turn, say plainly you would need a web search to confirm anything time-sensitive.
- Encourage the user to keep using English rather than translating everything for them. Use Arabic only when the user explicitly asks for an Arabic explanation or clearly needs it to understand.
- If assessing IELTS speaking, use the official public IELTS band descriptors as your reference, but always make clear the score is an estimate, not an official result.

CORRECTION MODE: ${state.correctionMode === "immediate" ? "Correct mistakes as they happen, right after the relevant message." : "Do NOT correct mistakes turn by turn. Let the user speak freely. Corrections will be requested together at the end of the session."}
${state.correctionMode === "immediate" ? `When the user's last message contains a genuine error worth flagging, include ONE compact block like this immediately (only when there IS a real error — omit entirely otherwise):
[[CORRECTION]]{"original":"<exact original phrase>","fix":"<corrected phrase>","type":"Grammar|Vocabulary|Word choice|Preposition|Article|Tense|Sentence structure|Naturalness","explanation":"<one simple sentence>"}[[/CORRECTION]]` : ""}

VOCABULARY COACHING: when the user uses a very basic word that could be upgraded for their level (especially toward IELTS-appropriate vocabulary), you may include:
[[VOCAB]]{"word":"<the stronger word or phrase>","note":"<short note on nuance / when to use it>"}[[/VOCAB]]
Don't force this on every message — only when it's genuinely useful, and never turn every word into something artificially difficult.

IELTS SCORING: only when the user asks to finish/end an IELTS speaking session, respond with encouragement plus exactly one block:
[[IELTS_REPORT]]{"overall":6.5,"breakdown":{"fluency":6,"lexical":7,"grammar":6,"pronunciation":6},"explanation":"<why, referencing specific things they said>","tips":"<concrete steps to move up one band>"}[[/IELTS_REPORT]]

Never show these bracket tags' raw contents to the user as prose — they are parsed by the app, so keep your normal reply text separate and natural.`;
}

/* ============================ Sending flow ============================= */

async function sendUserMessage(text) {
  text = text.trim();
  if (!text) return;

  if (!state.sessionStarted) {
    state.sessionStarted = true;
    state.sessions += 1;
    saveState();
    renderStats();
  }

  appendMessage("user", text);
  conversation.push({ role: "user", content: text });
  composerInput.value = "";
  autoGrowInput();

  showTyping();
  sendBtnDisabled(true);

  try {
    let searchContext = "";
    if (state.currentMode === "news") {
      const s = await FluentAPI.search(text);
      if (s.available && s.results && s.results.length) {
        searchContext =
          "\n\nSEARCH_RESULTS (for this turn only, use if relevant, cite the source name):\n" +
          s.results.map((r, i) => `${i + 1}. ${r.title} — ${r.snippet} (${r.url})`).join("\n");
      } else {
        searchContext = "\n\nSEARCH_RESULTS: none available this turn — do not claim to know current news.";
      }
    }

    const system = buildSystemPrompt() + searchContext;
    const reply = await FluentAPI.chat(conversation, system);
    hideTyping();

    const parsed = processAssistantReply(reply);
    if (parsed.text) {
      appendMessage("bot", parsed.text);
      conversation.push({ role: "assistant", content: reply });
      speak(parsed.text);
    }
    parsed.corrections.forEach(appendCorrectionCard);
    parsed.vocabSuggestions.forEach(appendVocabSuggest);
    if (parsed.report) {
      state.ieltsScores.push({ date: Date.now(), ...parsed.report });
      saveState();
      renderReportPanel(parsed.report);
      openPanelTab("report");
    }
    if (parsed.levelEstimate) {
      currentModeDesc.textContent = `${MODES[state.currentMode].desc} · est. level ${parsed.levelEstimate}`;
    }
  } catch (err) {
    hideTyping();
    appendSystemNote("⚠️ " + err.message);
  } finally {
    sendBtnDisabled(false);
  }
}

function sendBtnDisabled(disabled) {
  $("sendBtn").disabled = disabled;
  micBtn.disabled = disabled;
}

/* ============================== Mode switch ============================ */

function switchMode(key) {
  state.currentMode = key;
  state.sessionStarted = false;
  conversation = [];
  ieltsPart = 1;
  saveState();
  renderModes();
  renderTopbar();
  chatLog.innerHTML = "";
  renderReportPanel(null);
  appendSystemNote(`Switched to ${MODES[key].title}. ${MODES[key].desc}.`);
  if (key === "ielts") {
    appendSystemNote("Say “I'm ready” (or anything) to begin the mock test. Use “Finish & get my band scores” when you're done.");
  }
  if (window.innerWidth <= 760) sidebar.classList.remove("open");
}

/* ================================ IELTS end ============================= */

endIeltsBtn.addEventListener("click", () => {
  sendUserMessage("Please end the IELTS speaking session now and give me my band scores and feedback.");
});

/* =============================== Speech (input) ========================= */

function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    micBtn.disabled = true;
    micBtn.title = "Voice input is not supported in this browser";
    return;
  }
  recognition = new SR();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onstart = () => {
    recognizing = true;
    micBtn.classList.add("recording");
    micStatus.textContent = "🎙 Listening… speak in English";
  };
  recognition.onerror = (e) => {
    micStatus.textContent = e.error === "not-allowed" ? "Microphone access was blocked." : "Voice recognition error — try again.";
  };
  recognition.onend = () => {
    recognizing = false;
    micBtn.classList.remove("recording");
    setTimeout(() => (micStatus.textContent = ""), 1500);
  };
  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    composerInput.value = transcript;
    autoGrowInput();
  };
}

micBtn.addEventListener("click", () => {
  if (!recognition) return;
  if (recognizing) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (e) {
      /* already started */
    }
  }
});

/* =============================== Speech (output) ========================= */

function speak(text) {
  lastSpokenText = text;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = parseFloat(rateSlider.value) || 0.9;
  window.speechSynthesis.speak(utter);
}

replayBtn.addEventListener("click", () => {
  if (!lastSpokenText) {
    showToast("Nothing to replay yet");
    return;
  }
  speak(lastSpokenText);
});

/* =============================== Composer ============================== */

composerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendUserMessage(composerInput.value);
});

composerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendUserMessage(composerInput.value);
  }
});

composerInput.addEventListener("input", autoGrowInput);
function autoGrowInput() {
  composerInput.style.height = "auto";
  composerInput.style.height = Math.min(composerInput.scrollHeight, 120) + "px";
}

/* ============================ Panel / sidebar UI ========================= */

function openPanelTab(tab) {
  document.querySelectorAll(".panel-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  document.querySelectorAll(".panel-view").forEach((v) => v.classList.toggle("active", v.id === "view-" + tab));
  if (window.innerWidth <= 1080) panel.classList.add("open");
}

document.querySelectorAll(".panel-tab").forEach((btn) => {
  btn.addEventListener("click", () => openPanelTab(btn.dataset.tab));
});

sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
panelToggle.addEventListener("click", () => panel.classList.toggle("open"));

correctionToggle.querySelectorAll(".toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    correctionToggle.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.correctionMode = btn.dataset.mode;
    saveState();
  });
});

levelSelect.addEventListener("change", () => {
  state.level = levelSelect.value;
  saveState();
});

themeToggle.addEventListener("click", () => {
  state.theme = state.theme === "light" ? "dark" : "light";
  applyTheme();
  saveState();
});

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  themeLabel.textContent = state.theme === "light" ? "Dark mode" : "Light mode";
}

resetDataBtn.addEventListener("click", () => {
  if (confirm("This clears all locally saved vocabulary, mistake tracking, and IELTS history from this browser. Continue?")) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

/* ================================= Init ================================= */

function init() {
  applyTheme();
  levelSelect.value = state.level;
  correctionToggle.querySelectorAll(".toggle-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.correctionMode));
  renderModes();
  renderTopbar();
  renderStats();
  renderVocabPanel();
  renderMistakesPanel();
  renderReportPanel(state.ieltsScores.length ? state.ieltsScores[state.ieltsScores.length - 1] : null);
  setupSpeechRecognition();
  appendSystemNote(`Welcome back. You're in ${MODES[state.currentMode].title} mode — say hello to get started, or switch modes from the sidebar.`);
}

init();
