/**
 * chat-bubble.js — Floating chat bubble with bilingual support
 *
 * A compact chat widget that appears on every page. Language is
 * auto-detected from the URL path (/zh/ → Chinese, else English)
 * and can be toggled manually.
 */

"use strict";

(function () {
  // ── Configuration ────────────────────────────────────────
  var BACKEND_URL = "http://3.214.5.41:8000";
  var MAX_INPUT_LENGTH = 1000;

  // ── i18n strings ─────────────────────────────────────────
  var i18n = {
    en: {
      title: "AI Assistant",
      greeting:
        "👋 Hi! I\u2019m an AI assistant for Runyu Ma\u2019s portfolio. Ask me anything about his background, projects, or experience.",
      placeholder: "Ask me anything\u2026",
      thinking: "Thinking\u2026",
      tooLong: "Message too long (max 1000 chars).",
      rateLimit:
        "\u23F3 Too many messages. Please wait a moment.",
      busy:
        "\uD83D\uDD04 The assistant is busy. Try again shortly.",
      genericError:
        "\u26A0\uFE0F Something went wrong. Please try again.",
      networkError:
        "\u26A0\uFE0F Unable to reach the assistant.",
      toggleLang: "中文",
    },
    zh: {
      title: "AI 助手",
      greeting:
        "👋 你好！我是马润宇个人主页的 AI 助手。欢迎询问有关他的背景、项目或经历的问题。",
      placeholder: "请输入您的问题\u2026",
      thinking: "正在思考\u2026",
      tooLong: "消息过长（最多 1000 字符）。",
      rateLimit: "\u23F3 发送过于频繁，请稍后再试。",
      busy: "\uD83D\uDD04 助手忙碌中，请稍后再试。",
      genericError: "\u26A0\uFE0F 出现问题，请重试。",
      networkError: "\u26A0\uFE0F 无法连接助手。",
      toggleLang: "EN",
    },
  };

  // ── State ────────────────────────────────────────────────
  var lang = window.location.pathname.indexOf("/zh/") !== -1 ? "zh" : "en";
  var isOpen = false;
  var isWaiting = false;
  var messages = []; // {role, text, blocked}

  // ── DOM refs ─────────────────────────────────────────────
  var toggle = document.getElementById("chat-bubble-toggle");
  var panel = document.getElementById("chat-bubble-panel");
  var titleEl = document.getElementById("chat-bubble-title");
  var langBtn = document.getElementById("chat-bubble-lang");
  var closeBtn = document.getElementById("chat-bubble-close");
  var messagesEl = document.getElementById("chat-bubble-messages");
  var form = document.getElementById("chat-bubble-form");
  var input = document.getElementById("chat-bubble-input");
  var sendBtn = document.getElementById("chat-bubble-send");

  // ── Helpers ──────────────────────────────────────────────

  function t(key) {
    return i18n[lang][key] || key;
  }

  function renderMessages() {
    messagesEl.innerHTML = "";
    messages.forEach(function (m) {
      var el = document.createElement("div");
      el.className = "cb-msg cb-msg-" + m.role;
      if (m.blocked) el.classList.add("cb-msg-blocked");
      el.textContent = m.text;
      messagesEl.appendChild(el);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMsg(role, text, extra) {
    messages.push({ role: role, text: text, blocked: extra && extra.blocked });
    renderMessages();
  }

  function removeLastTyping() {
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "typing") {
        messages.splice(i, 1);
        break;
      }
    }
  }

  function setBusy(busy) {
    isWaiting = busy;
    sendBtn.disabled = busy;
    input.disabled = busy;
  }

  function applyLang() {
    titleEl.textContent = t("title");
    langBtn.textContent = t("toggleLang");
    input.placeholder = t("placeholder");
    // Re-render greeting if it's the only message
    if (messages.length === 1 && messages[0].role === "assistant") {
      messages[0].text = t("greeting");
      renderMessages();
    }
  }

  function errorTextForStatus(status) {
    if (status === 429) return t("rateLimit");
    if (status === 503) return t("busy");
    return t("genericError");
  }

  // ── Open / Close ─────────────────────────────────────────

  function openPanel() {
    isOpen = true;
    panel.classList.remove("chat-bubble-hidden");
    toggle.classList.add("chat-bubble-toggle-hidden");
    input.focus();
  }

  function closePanel() {
    isOpen = false;
    panel.classList.add("chat-bubble-hidden");
    toggle.classList.remove("chat-bubble-toggle-hidden");
  }

  // ── Event listeners ──────────────────────────────────────

  toggle.addEventListener("click", openPanel);
  closeBtn.addEventListener("click", closePanel);

  langBtn.addEventListener("click", function () {
    lang = lang === "en" ? "zh" : "en";
    applyLang();
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isWaiting) form.dispatchEvent(new Event("submit"));
    }
  });

  // Auto-resize textarea (1-4 rows)
  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 80) + "px";
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (isWaiting) return;

    var message = input.value.trim();
    if (!message) return;
    if (message.length > MAX_INPUT_LENGTH) {
      addMsg("error", t("tooLong"));
      return;
    }

    addMsg("user", message);
    input.value = "";
    input.style.height = "auto";

    addMsg("typing", t("thinking"));
    setBusy(true);

    try {
      var response = await fetch(BACKEND_URL + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message }),
      });

      removeLastTyping();

      if (!response.ok) {
        addMsg("error", errorTextForStatus(response.status));
        return;
      }

      var data = await response.json();
      addMsg("assistant", data.reply, { blocked: data.blocked });
    } catch (err) {
      removeLastTyping();
      console.error("Chat bubble request failed:", err);
      addMsg("error", t("networkError"));
    } finally {
      setBusy(false);
      input.focus();
    }
  });

  // ── Init ─────────────────────────────────────────────────
  addMsg("assistant", t("greeting"));
  applyLang();
})();
