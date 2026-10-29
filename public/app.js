/* ============================================================
   Gemini Chat — client app
   Multi-conversation (localStorage), model selector, safe
   markdown rendering, stop/copy/regenerate.
   All AI/user text is escaped BEFORE any formatting is applied.
   ============================================================ */

(() => {
  "use strict";

  // ---------- Constants ----------
  const STORE_KEY = "gemini-chat:conversations:v1";
  const MODEL_KEY = "gemini-chat:model";
  const THEME_KEY = "gemini-chat:theme";
  const MAX_CONVERSATIONS = 20;
  const MAX_HISTORY_TURNS = 20; // must match server cap
  const REQUEST_TIMEOUT_MS = 45000;

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const chatWindow = $("#chat-window");
  const form = $("#chat-form");
  const input = $("#message-input");
  const sendBtn = $("#send-btn");
  const statusDot = $("#status-dot");
  const modelSelect = $("#model-select");
  const convList = $("#conversation-list");
  const emptyState = $("#empty-state");
  const sidebar = $("#sidebar");
  const sidebarBackdrop = $("#sidebar-backdrop");
  const themeToggle = $("#theme-toggle");

  // ---------- State ----------
  let conversations = [];
  let activeId = null;
  let currentModel = "";
  let controller = null; // AbortController của request đang chạy

  // ---------- Helpers ----------
  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function showToast(text) {
    const toast = $("#toast");
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function relativeTime(ts) {
    try {
      return new Intl.RelativeTimeFormat("vi", { numeric: "auto" }).format(
        Math.round((ts - Date.now()) / 86400000),
        "day"
      );
    } catch {
      return "";
    }
  }

  // ---------- Safe markdown renderer ----------
  // Toàn bộ text được escape TRƯỚC, sau đó chỉ format bằng whitelist →
  // không có đường XSS nào: mọi thẻ ngoài whitelist vẫn là text đã escape.
  function renderMarkdown(raw) {
    let text = escapeHtml(raw);
    const blocks = [];

    // 1) Fenced code blocks (```...```) — tách ra trước để nội dung block
    //    không bị các regex sau đụng vào.
    text = text.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, (_m, code) => {
      blocks.push("<pre><code>" + code + "</code></pre>");
      return "\u0001B" + (blocks.length - 1) + "\u0001";
    });

    // 2) Inline code
    text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");

    // 3) Headings (#..### ở đầu dòng)
    text = text
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*)$/gm, "<h1>$1</h1>");

    // 4) Links [text](https://...) — chỉ http(s), attribute đã escape nên an toàn
    text = text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // 5) Bold / italic
    text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

    // 6) Lists: nhóm các dòng liên tiếp bắt đầu bằng "- " / "* " thành <ul>
    text = text.replace(/(?:^[-*] .+(?:\n|$))+/gm, (chunk) => {
      const items = chunk
        .trim()
        .split("\n")
        .map((line) => "<li>" + line.replace(/^[-*] /, "") + "</li>")
        .join("");
      return "<ul>" + items + "</ul>";
    });

    // 7) Restore code blocks, rồi xuống dòng thành <br> cho phần text thường
    text = text.replace(/\u0001B(\d+)\u0001/g, (_m, i) => blocks[Number(i)]);
    text = text
      .split(/\n{2,}/)
      .map((para) =>
        para.includes("<ul>") || para.includes("<pre>") || para.includes("<h")
          ? para.trim()
          : "<p>" + para.replace(/\n/g, "<br>") + "</p>"
      )
      .join("");

    return text;
  }

  // ---------- Persistence ----------
  function loadConversations() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      // Defensive: chỉ nhận đúng shape, tránh data cũ/hỏng làm sập UI
      return parsed
        .filter(
          (c) =>
            c && typeof c === "object" && typeof c.id === "string" &&
            Array.isArray(c.messages)
        )
        .slice(0, MAX_CONVERSATIONS);
    } catch (e) {
      console.warn("Không đọc được hội thoại đã lưu:", e);
      return [];
    }
  }

  function persist() {
    try {
      while (conversations.length > MAX_CONVERSATIONS) {
        conversations.shift(); // bỏ hội thoại cũ nhất
      }
      // Fix: nếu hội thoại đang active bị trim (trường hiếm — active thường
      // là hội thoại mới nhất), trỏ activeId về hội thoại mới nhất còn lại
      // thay vì để id treo → UI rơi vào empty-state giả với list còn dữ liệu.
      if (activeId && !conversations.some((c) => c.id === activeId)) {
        activeId = conversations.length ? conversations[conversations.length - 1].id : null;
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.warn("Không lưu được hội thoại (localStorage?):", e);
    }
  }

  function getActive() {
    return conversations.find((c) => c.id === activeId) || null;
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (themeToggle) themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) { /* ignore */ }
  }

  themeToggle?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  // ---------- Rendering ----------
  function createMessageEl(role, html, extraClass) {
    const wrap = document.createElement("div");
    wrap.className = "msg " + role + (extraClass ? " " + extraClass : "");

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? "You" : "✦";

    const body = document.createElement("div");
    body.className = "msg-body";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = html; // đã escape/render markdown an toàn ở caller

    body.appendChild(bubble);
    wrap.append(avatar, body);
    chatWindow.appendChild(wrap);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return { wrap, bubble, body };
  }

  function addUserMessage(text) {
    createMessageEl("user", escapeHtml(text));
  }

  function addAiMessage(text) {
    const { bubble, wrap } = createMessageEl("ai", renderMarkdown(text));
    bubble.classList.add("markdown");
    attachMsgActions(wrap.querySelector(".msg-body"), text);
    return wrap;
  }

  function attachMsgActions(msgBody, rawText) {
    const actions = document.createElement("div");
    actions.className = "msg-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "icon-btn";
    copyBtn.title = "Copy";
    copyBtn.setAttribute("aria-label", "Copy tin nhắn");
    copyBtn.textContent = "📋";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(rawText);
        showToast("Đã copy");
      } catch {
        showToast("Không copy được");
      }
    });

    actions.appendChild(copyBtn);
    msgBody.appendChild(actions);
  }

  function showTyping() {
    const { wrap } = createMessageEl(
      "ai",
      '<span class="dot"></span><span class="dot"></span><span class="dot"></span>',
      "typing"
    );
    return wrap;
  }

  function renderConversation(conv) {
    chatWindow.innerHTML = "";
    if (!conv || conv.messages.length === 0) {
      chatWindow.appendChild(emptyState);
      emptyState.style.display = "flex";
      return;
    }
    emptyState.style.display = "none";
    for (const m of conv.messages) {
      if (m.role === "user") addUserMessage(m.text);
      else addAiMessage(m.text);
    }
  }

  function renderConversationList() {
    convList.innerHTML = "";
    for (const conv of [...conversations].reverse()) {
      const item = document.createElement("div");
      item.className =
        "conversation-item" + (conv.id === activeId ? " active" : "");
      item.setAttribute("role", "button");
      item.tabIndex = 0;
      item.title = relativeTime(conv.updatedAt || conv.createdAt || Date.now());

      const title = document.createElement("span");
      title.className = "conv-title";
      title.textContent = conv.title || "Hội thoại mới";

      const actions = document.createElement("span");
      actions.className = "conv-actions";

      const renameBtn = document.createElement("button");
      renameBtn.className = "icon-btn";
      renameBtn.title = "Đổi tên";
      renameBtn.textContent = "✏️";
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const name = prompt("Tên hội thoại:", conv.title || "");
        if (name !== null && name.trim()) {
          conv.title = name.trim().slice(0, 60);
          persist();
          renderConversationList();
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "icon-btn";
      deleteBtn.title = "Xóa";
      deleteBtn.textContent = "🗑";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm("Xóa hội thoại này?")) return;
        conversations = conversations.filter((c) => c.id !== conv.id);
        if (activeId === conv.id) {
          activeId = conversations.length
            ? conversations[conversations.length - 1].id
            : null;
        }
        persist();
        renderConversationList();
        renderConversation(getActive());
      });

      actions.append(renameBtn, deleteBtn);
      item.append(title, actions);

      item.addEventListener("click", () => {
        activeId = conv.id;
        persist();
        renderConversationList();
        renderConversation(conv);
        closeSidebar();
      });
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") item.click();
      });

      convList.appendChild(item);
    }
  }

  // ---------- Sidebar (mobile) ----------
  function openSidebar() {
    sidebar.classList.add("open");
    sidebarBackdrop.classList.add("show");
  }
  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("show");
  }
  $("#sidebar-toggle")?.addEventListener("click", openSidebar);
  sidebarBackdrop?.addEventListener("click", closeSidebar);

  // ---------- Status ----------
  function setStatus(state, text) {
    statusDot.className = "status-dot" + (state ? " " + state : "");
    statusDot.innerHTML = "<span></span>";
    statusDot.firstChild.textContent = text;
  }

  // ---------- Busy / stop ----------
  function setBusy(busy) {
    sendBtn.disabled = busy && !controller; // khi busy có thể bấm để stop
    input.disabled = false; // vẫn cho gõ trong lúc chờ
    if (busy) {
      sendBtn.classList.add("stop-mode");
      sendBtn.title = "Dừng tạo phản hồi";
      sendBtn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor"/></svg>';
      setStatus("busy", "Đang xử lý…");
    } else {
      sendBtn.classList.remove("stop-mode");
      sendBtn.title = "Gửi";
      sendBtn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
      setStatus("", "Online");
    }
  }

  // ---------- Model selector ----------
  async function loadModels() {
    try {
      const res = await fetch("/api/models", { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      modelSelect.innerHTML = "";
      for (const m of data.models || []) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.label;
        modelSelect.appendChild(opt);
      }
      const saved = localStorage.getItem(MODEL_KEY);
      const ids = [...modelSelect.options].map((o) => o.value);
      currentModel =
        saved && ids.includes(saved) ? saved : data.default || ids[0] || "";
      modelSelect.value = currentModel;
    } catch (e) {
      console.warn("Không tải được danh sách model:", e);
      modelSelect.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Mặc định";
      modelSelect.appendChild(opt);
      currentModel = "";
    }
  }

  modelSelect?.addEventListener("change", () => {
    currentModel = modelSelect.value;
    try {
      localStorage.setItem(MODEL_KEY, currentModel);
    } catch { /* ignore */ }
  });

  // ---------- Send ----------
  async function send(message, { regenerate = false } = {}) {
    let conv = getActive();
    if (!conv) {
      conv = createConversation();
    }

    if (!regenerate) {
      conv.messages.push({ role: "user", text: message, ts: Date.now() });
      if (conv.messages.filter((m) => m.role === "user").length === 1) {
        conv.title = message.slice(0, 60);
      }
      conv.updatedAt = Date.now();
      persist();
      if (emptyState) emptyState.style.display = "none";
      addUserMessage(message);
    }

    if (!regenerate) {
      input.value = "";
      input.style.height = "auto";
    }

    const history = conv.messages.slice(0, -1).slice(-MAX_HISTORY_TURNS);
    const typing = showTyping();
    controller = new AbortController();
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: conv.messages[conv.messages.length - 1].text,
          history,
          model: currentModel || undefined,
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Máy chủ đang gặp sự cố.");
      const reply = data.reply || "Gemini không trả về nội dung.";
      typing.remove();
      conv.messages.push({ role: "model", text: reply, ts: Date.now() });
      conv.updatedAt = Date.now();
      persist();
      addAiMessage(reply);
      renderConversationList();
    } catch (err) {
      typing.remove();
      if (err.name === "AbortError") {
        setStatus("", "Đã dừng");
        showToast("Đã dừng tạo phản hồi");
      } else {
        const wrap = createMessageEl(
          "ai",
          "⚠️ " + escapeHtml(err.message || "Không thể nhận phản hồi."),
          "error"
        );
        wrap.bubble.classList.add("markdown");
      }
    } finally {
      controller = null;
      setBusy(false);
      input.focus();
    }
  }

  // ---------- New conversation / export / regenerate ----------
  function createConversation() {
    const conv = {
      id: uid(),
      title: "Hội thoại mới",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    conversations.push(conv);
    activeId = conv.id;
    persist();
    renderConversationList();
    renderConversation(conv);
    return conv;
  }

  $("#new-chat-btn").addEventListener("click", () => {
    createConversation();
    closeSidebar();
    input.focus();
  });

  $("#export-btn").addEventListener("click", () => {
    const conv = getActive();
    if (!conv || conv.messages.length === 0) {
      showToast("Hội thoại trống");
      return;
    }
    const lines = ["# " + (conv.title || "Hội thoại"), ""];
    for (const m of conv.messages) {
      lines.push(m.role === "user" ? "## You" : "## Gemini", m.text, "");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (conv.title || "conversation").replace(/[^\w\d-]+/g, "_") + ".md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Đã export .md");
  });

  $("#regenerate-btn").addEventListener("click", () => {
    const conv = getActive();
    if (!conv || controller) return;
    const lastUser = [...conv.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      showToast("Chưa có tin nhắn để tạo lại");
      return;
    }
    // Bỏ các lượt sau tin nhắn user cuối cùng, rồi gửi lại đúng tin đó
    const idx = conv.messages.lastIndexOf(lastUser);
    conv.messages = conv.messages.slice(0, idx + 1);
    persist();
    renderConversation(conv);
    send(lastUser.text, { regenerate: true });
  });

  // ---------- Form events ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (controller) {
      controller.abort(); // nút đang ở chế độ stop
      return;
    }
    const message = input.value.trim();
    if (!message) return;
    send(message);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 128) + "px";
  });

  // ---------- Init ----------
  (function init() {
    let savedTheme = "dark";
    try {
      savedTheme = localStorage.getItem(THEME_KEY) || "dark";
    } catch { /* ignore */ }
    applyTheme(savedTheme);

    conversations = loadConversations();
    activeId = conversations.length ? conversations[conversations.length - 1].id : null;
    renderConversationList();
    renderConversation(getActive());
    loadModels();
    setStatus("", "Online");
    input.focus();
  })();
})();
