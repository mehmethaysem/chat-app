document.addEventListener("DOMContentLoaded", () => {

  const chatMessages = document.getElementById("chatMessages");
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const fileBtn = document.getElementById("fileBtn");
  const fileInput = document.getElementById("fileInput");
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.querySelector(".sidebar");
  const navBtns = document.querySelectorAll(".nav-btn");
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");
  const historyClose = document.getElementById("historyClose");
  const typingIndicator = document.getElementById("typingIndicator");
  const modelBar = document.querySelector(".model-bar");
  const modelBarBtn = document.getElementById("modelBarBtn");
  const modelBarLabel = document.getElementById("modelBarLabel");
  const modelBarDropdown = document.getElementById("modelBarDropdown");
  const searchPanel = document.getElementById("searchPanel");
  const searchOverlay = document.getElementById("searchOverlay");
  const searchPanelInput = document.getElementById("searchPanelInput");
  const searchPanelResults = document.getElementById("searchPanelResults");
  const searchPanelClose = document.getElementById("searchPanelClose");

  let searchMode = "text";

  const API_BASE = "http://localhost:5555";

  const AVAILABLE_MODELS = [
    { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini" },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "qwen/qwen3-32b", name: "Qwen 3 32B" },
    { id: "deepseek/deepseek-chat-v3", name: "DeepSeek Chat V3" },
  ];
  let selectedModel = localStorage.getItem("selectedModel") || "openai/gpt-4.1-mini";

  let chats = [];
  let activeChatId = null;

  function now() {
    return new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }

  function getActiveChat() {
    return chats.find((c) => c.id === activeChatId) || null;
  }

  // ——— API ———
  async function apiFetch(url, options = {}) {
    const res = await fetch(API_BASE + url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    return res.json();
  }

  // ——— Model ———
  function saveModel() {
    localStorage.setItem("selectedModel", selectedModel);
  }

  function renderModelDropdown() {
    modelBarDropdown.innerHTML = "";
    AVAILABLE_MODELS.forEach((m) => {
      const opt = document.createElement("button");
      opt.className = "model-option" + (m.id === selectedModel ? " selected" : "");
      opt.innerHTML = `<span class="model-option-name">${escapeHtml(m.name)}</span><i class="fas fa-check model-option-check"></i>`;
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        selectModel(m.id);
      });
      modelBarDropdown.appendChild(opt);
    });
  }

  function selectModel(id) {
    if (id === selectedModel) return;
    selectedModel = id;
    saveModel();
    const found = AVAILABLE_MODELS.find((m) => m.id === id);
    modelBarLabel.textContent = found ? found.name : id;
    renderModelDropdown();
    closeModelDropdown();
  }

  function toggleModelDropdown() {
    const open = modelBarDropdown.classList.contains("open");
    if (open) { closeModelDropdown(); } else { openModelDropdown(); }
  }

  function openModelDropdown() {
    modelBarDropdown.classList.add("open");
    modelBar.classList.add("open");
    document.addEventListener("click", closeModelDropdownOutside);
  }

  function closeModelDropdown() {
    modelBarDropdown.classList.remove("open");
    modelBar.classList.remove("open");
    document.removeEventListener("click", closeModelDropdownOutside);
  }

  function closeModelDropdownOutside(e) {
    if (!modelBar.contains(e.target)) {
      closeModelDropdown();
    }
  }

  modelBarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleModelDropdown();
  });

  const initialModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
  modelBarLabel.textContent = initialModel ? initialModel.name : "GPT-4.1 Mini";
  renderModelDropdown();

  // ——— Chat ———
  function renderHistory() {
    historyList.innerHTML = "";
    if (chats.length === 0) {
      historyList.innerHTML = '<div class="history-empty">Henüz sohbet yok</div>';
      return;
    }
    chats.forEach((chat) => {
      const btn = document.createElement("button");
      btn.className = "history-item" + (chat.id === activeChatId ? " active" : "");
      btn.innerHTML = `<i class="fas fa-message history-item-icon"></i><span class="history-item-text">${escapeHtml(chat.title)}</span>`;
      btn.addEventListener("click", () => switchChat(chat.id));
      historyList.appendChild(btn);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  async function switchChat(id) {
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;
    activeChatId = chat.id;
    localStorage.setItem("activeChatId", activeChatId);
    renderHistory();
    clearMessagesDOM();
    typingIndicator.classList.remove("active");

    try {
      const messages = await apiFetch(`/chats/${id}/messages`);
      messages.forEach((msg) => {
        addMessageToDOM(msg.content, msg.role, now());
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch {
      addMessageToDOM("Mesajlar yüklenirken hata oluştu.", "assistant", now());
    }
  }

  function clearMessagesDOM() {
    chatMessages.querySelectorAll(":scope > .message").forEach((el) => el.remove());
  }

  async function newChat() {
    try {
      const chat = await apiFetch("/chats", { method: "POST" });
      chats.push(chat);
      activeChatId = chat.id;
      localStorage.setItem("activeChatId", activeChatId);
      renderHistory();
      clearMessagesDOM();
      historyPanel.classList.remove("open");
      navBtns.forEach((b) => b.classList.remove("active"));
      navBtns[0].classList.add("active");
      typingIndicator.classList.remove("active");
      msgInput.focus();
    } catch {
      addMessageToDOM("Yeni sohbet oluşturulamadı.", "assistant", now());
    }
  }

  async function loadChatsFromServer() {
    try {
      chats = await apiFetch("/chats");
      if (chats.length === 0) {
        await newChat();
        return;
      }
      activeChatId = localStorage.getItem("activeChatId") || null;
      if (!activeChatId || !chats.find((c) => c.id === activeChatId)) {
        activeChatId = chats[0].id;
        localStorage.setItem("activeChatId", activeChatId);
      }
      renderHistory();
      await switchChat(activeChatId);
    } catch {
      addMessageToDOM("Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığını kontrol edin.", "assistant", now());
    }
  }

  // ——— Sidebar toggle (mobile) ———
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  // ——— Nav buttons ———
  navBtns.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      navBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (index === 0) {
        newChat();
      } else if (index === 1) {
        openSearchPanel();
      } else if (index === 2) {
        historyPanel.classList.toggle("open");
      }
    });
  });

  historyClose.addEventListener("click", () => {
    historyPanel.classList.remove("open");
  });

  document.getElementById("historyClearBtn").addEventListener("click", async () => {
    try {
      await apiFetch("/chats", { method: "DELETE" });
    } catch {}
    chats = [];
    activeChatId = null;
    localStorage.removeItem("activeChatId");
    historyPanel.classList.remove("open");
    newChat();
  });

  // ——— Search Panel ———
  let searchTimeout = null;

  function openSearchPanel() {
    searchPanel.classList.add("open");
    searchOverlay.classList.add("open");
    searchPanelInput.value = "";
    searchPanelResults.innerHTML = "";
    updateSearchModeButtons();
    setTimeout(() => searchPanelInput.focus(), 100);
  }

  function closeSearchPanel() {
    searchPanel.classList.remove("open");
    searchOverlay.classList.remove("open");
    searchPanelInput.value = "";
    searchPanelResults.innerHTML = "";
    navBtns.forEach((b) => b.classList.remove("active"));
  }

  function updateSearchModeButtons() {
    document.querySelectorAll(".search-mode-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === searchMode);
    });
  }

  document.querySelectorAll(".search-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.mode === searchMode) return;
      searchMode = btn.dataset.mode;
      updateSearchModeButtons();
      searchPanelResults.innerHTML = "";
      const val = searchPanelInput.value.trim();
      if (val) {
        renderSearchResults(val);
      }
    });
  });

  async function renderSearchResults(query) {
    if (searchMode === "semantic") {
      await renderSemanticSearchResults(query);
      return;
    }

    const lower = query.toLowerCase().trim();
    searchPanelResults.innerHTML = "";

    if (!lower) {
      searchPanelResults.innerHTML = '<div class="search-result-empty">Type to search conversations...</div>';
      return;
    }

    try {
      const results = await apiFetch(`/chats/search?q=${encodeURIComponent(lower)}`);

      if (results.length === 0) {
        searchPanelResults.innerHTML = '<div class="search-result-empty">No conversations found.</div>';
        return;
      }

      results.forEach(({ id, title, matches }) => {
        const item = document.createElement("button");
        item.className = "search-result-item";
        let preview = "";
        if (matches.length > 0) {
          const firstMatch = matches[0];
          preview = escapeHtml(firstMatch.content.substring(0, 80)) + (firstMatch.content.length > 80 ? "..." : "");
        }
        item.innerHTML = `
          <div class="search-result-title"><i class="fas fa-message"></i>${escapeHtml(title)}</div>
          ${preview ? `<div class="search-result-preview">${preview}</div>` : ""}
        `;
        item.addEventListener("click", () => {
          switchChat(id);
          closeSearchPanel();
        });
        searchPanelResults.appendChild(item);
      });
    } catch {
      searchPanelResults.innerHTML = '<div class="search-result-empty">Arama sırasında hata oluştu.</div>';
    }
  }

  async function renderSemanticSearchResults(query) {
    searchPanelResults.innerHTML = "";

    if (!query.trim()) {
      searchPanelResults.innerHTML = '<div class="search-result-empty">Type to search semantically...</div>';
      return;
    }

    try {
      const results = await apiFetch(`/chats/search/semantic?q=${encodeURIComponent(query.trim())}`);

      if (results.length === 0) {
        searchPanelResults.innerHTML = '<div class="search-result-empty">No semantic matches found.</div>';
        return;
      }

      results.forEach(({ id, chat_id, role, content, similarity, created_at }) => {
        const item = document.createElement("button");
        item.className = "search-result-item semantic";
        const roleLabel = role === "user" ? "User" : "Assistant";
        const roleIcon = role === "user" ? "fa-user" : "fa-robot";
        const similarityPct = Math.round(similarity * 100);
        const similarityClass = similarityPct >= 80 ? "high" : similarityPct >= 60 ? "mid" : "low";

        item.innerHTML = `
          <div class="sr-semantic-top">
            <span class="sr-role-badge ${role}"><i class="fas ${roleIcon}"></i>${roleLabel}</span>
            <span class="sr-similarity ${similarityClass}">${similarityPct}%</span>
          </div>
          <div class="sr-content">${escapeHtml(content.substring(0, 200))}${content.length > 200 ? "..." : ""}</div>
          <div class="sr-meta">${created_at ? new Date(created_at).toLocaleString("tr-TR") : ""}</div>
        `;
        item.addEventListener("click", () => {
          switchChat(chat_id);
          closeSearchPanel();
        });
        searchPanelResults.appendChild(item);
      });
    } catch {
      searchPanelResults.innerHTML = '<div class="search-result-empty">Semantic search failed.</div>';
    }
  }

  searchPanelInput.addEventListener("input", (e) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderSearchResults(e.target.value), 300);
  });

  searchPanelInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSearchPanel();
  });

  searchPanelClose.addEventListener("click", closeSearchPanel);
  searchOverlay.addEventListener("click", closeSearchPanel);

  // ——— Send message ———
  function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    const chat = getActiveChat();
    if (!chat) return;

    const time = now();
    addMessageToDOM(text, "user", time);
    msgInput.value = "";
    msgInput.focus();

    typingIndicator.classList.add("active");
    chatMessages.scrollTop = chatMessages.scrollHeight;

    fetch(`${API_BASE}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat.id, message: text, model: selectedModel }),
    })
      .then((res) => res.json())
      .then((data) => {
        typingIndicator.classList.remove("active");
        if (data.error) {
          addMessageToDOM("Hata: " + data.error, "assistant", now());
        } else {
          addMessageToDOM(data.reply || "Yanıt alınamadı.", "assistant", now());
          if (data.chat_title) {
            chat.title = data.chat_title;
            renderHistory();
          }
        }
      })
      .catch(() => {
        typingIndicator.classList.remove("active");
        addMessageToDOM("Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığını kontrol edin.", "assistant", now());
      });
  }

  function addMessageToDOM(text, sender, time) {
    const div = document.createElement("div");
    div.className = `message ${sender}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerHTML = sender === "user" ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = text;

    div.appendChild(avatar);
    div.appendChild(bubble);

    if (time) {
      const timeEl = document.createElement("div");
      timeEl.className = "message-time";
      timeEl.textContent = time;
      div.appendChild(timeEl);
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  sendBtn.addEventListener("click", sendMessage);

  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  function getFileIcon(name) {
    const ext = name.split(".").pop().toLowerCase();
    const icons = {
      pdf: "fa-file-pdf",
      doc: "fa-file-word", docx: "fa-file-word",
      xls: "fa-file-excel", xlsx: "fa-file-excel",
      png: "fa-file-image", jpg: "fa-file-image", jpeg: "fa-file-image", gif: "fa-file-image", svg: "fa-file-image", webp: "fa-file-image",
      zip: "fa-file-zipper", rar: "fa-file-zipper", "7z": "fa-file-zipper",
      mp3: "fa-file-audio", wav: "fa-file-audio",
      mp4: "fa-file-video", mov: "fa-file-video",
      txt: "fa-file-lines",
    };
    return icons[ext] || "fa-file";
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function buildFileCard(name, size) {
    const icon = getFileIcon(name);
    return `<div class="file-card"><i class="fas ${icon} file-card-icon"></i><div class="file-card-info"><span class="file-card-name">${escapeHtml(name)}</span><span class="file-card-size">${formatFileSize(size)}</span></div></div>`;
  }

  // ——— File upload ———
  fileBtn.addEventListener("click", () => { fileInput.click(); });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const chat = getActiveChat();
    if (!chat) return;

    addMessageToDOM(buildFileCard(file.name, file.size), "user", now());

    const formData = new FormData();
    formData.append("file", file);

    typingIndicator.classList.add("active");
    chatMessages.scrollTop = chatMessages.scrollHeight;

    fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        typingIndicator.classList.remove("active");
        if (data.error) {
          addMessageToDOM("Hata: " + data.error, "assistant", now());
        } else {
          addMessageToDOM(data.reply || "Yanıt alınamadı.", "assistant", now());
        }
      })
      .catch(() => {
        typingIndicator.classList.remove("active");
        addMessageToDOM("Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığını kontrol edin.", "assistant", now());
      });

    fileInput.value = "";
  });

  // ——— Initialize ———
  loadChatsFromServer();
});