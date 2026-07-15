document.addEventListener("DOMContentLoaded", () => {

  // ——— Login ———
  const loginOverlay = document.getElementById("loginOverlay");
  const loginUsername = document.getElementById("loginUsername");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");

  function handleLogin() {
    const user = loginUsername.value.trim();
    if (user === "admin") {
      loginOverlay.classList.add("hidden");
      loginError.textContent = "";
    } else {
      loginError.textContent = "Kullanıcı adı hatalı.";
    }
  }

  loginBtn.addEventListener("click", handleLogin);
  loginUsername.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleLogin(); }
  });

  const chatMessages = document.getElementById("chatMessages");
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const fileBtn = document.getElementById("fileBtn");
  const fileInput = document.getElementById("fileInput");
  const micBtn = document.getElementById("micBtn");
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.querySelector(".sidebar");
  const navBtns = document.querySelectorAll(".nav-btn");
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");
  const historyClose = document.getElementById("historyClose");
  const typingIndicator = document.getElementById("typingIndicator");

  // ——— Chat state ———
  let chats = [];
  let activeChatId = null;

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function now() {
    return new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }

  function saveChats() {
    localStorage.setItem("chats", JSON.stringify(chats));
    localStorage.setItem("activeChatId", activeChatId);
  }

  function loadChats() {
    const stored = localStorage.getItem("chats");
    chats = stored ? JSON.parse(stored) : [];
    activeChatId = localStorage.getItem("activeChatId") || null;
  }

  function getActiveChat() {
    return chats.find((c) => c.id === activeChatId) || null;
  }

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

  function switchChat(id) {
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;
    activeChatId = chat.id;
    saveChats();
    renderHistory();
    renderMessages(chat);
    typingIndicator.classList.remove("active");
  }

  function renderMessages(chat) {
    chatMessages.querySelectorAll(":scope > .message").forEach((el) => el.remove());
    chat.messages.forEach((msg) => {
      addMessageToDOM(msg.content, msg.sender, msg.time);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function newChat() {
    const id = generateId();
    const chat = {
      id,
      title: "Yeni Sohbet",
      messages: [{ sender: "assistant", content: "Merhaba! Size nasıl yardımcı olabilirim?", time: now() }],
    };
    chats.push(chat);
    activeChatId = id;
    saveChats();
    renderHistory();
    renderMessages(chat);
    historyPanel.classList.remove("open");
    navBtns.forEach((b) => b.classList.remove("active"));
    navBtns[0].classList.add("active");
    typingIndicator.classList.remove("active");
    msgInput.focus();
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
        historyPanel.classList.toggle("open");
      }
    });
  });

  // ——— History panel close ———
  historyClose.addEventListener("click", () => {
    historyPanel.classList.remove("open");
  });

  // ——— Clear history ———
  document.getElementById("historyClearBtn").addEventListener("click", () => {
    chats = [];
    activeChatId = null;
    localStorage.removeItem("chats");
    localStorage.removeItem("activeChatId");
    historyPanel.classList.remove("open");
    newChat();
  });

  // ——— Send message ———
  function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    addMessage(text, "user");
    msgInput.value = "";
    msgInput.focus();

    typingIndicator.classList.add("active");
    chatMessages.scrollTop = chatMessages.scrollHeight;

    fetch("http://localhost:5000/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    })
      .then((res) => res.json())
      .then((data) => {
        typingIndicator.classList.remove("active");
        if (data.error) {
          addMessage("Hata: " + data.error, "assistant");
        } else {
          addMessage(data.reply || "Yanıt alınamadı.", "assistant");
        }
      })
      .catch(() => {
        typingIndicator.classList.remove("active");
        addMessage("Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığını kontrol edin.", "assistant");
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

  function addMessage(text, sender) {
    const chat = getActiveChat();
    if (!chat) return;

    const time = now();
    chat.messages.push({ sender, content: text, time });

    if (sender === "user") {
      const firstUserMsg = chat.messages.find((m) => m.sender === "user");
      if (firstUserMsg) chat.title = firstUserMsg.content;
    }

    saveChats();
    renderHistory();
    addMessageToDOM(text, sender, time);
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

    addMessage(buildFileCard(file.name, file.size), "user");

    const formData = new FormData();
    formData.append("file", file);

    typingIndicator.classList.add("active");
    chatMessages.scrollTop = chatMessages.scrollHeight;

    fetch("http://localhost:5000/upload", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        typingIndicator.classList.remove("active");
        if (data.error) {
          addMessage("Hata: " + data.error, "assistant");
        } else {
          addMessage(data.reply || "Yanıt alınamadı.", "assistant");
        }
      })
      .catch(() => {
        typingIndicator.classList.remove("active");
        addMessage("Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığını kontrol edin.", "assistant");
      });

    fileInput.value = "";
  });

  // ——— Microphone ———
  micBtn.addEventListener("click", () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => { addMessage("Mikrofon erişimi sağlandı.", "assistant"); })
      .catch(() => { addMessage("Mikrofon erişimi reddedildi.", "assistant"); });
  });

  // ——— Initialize ———
  loadChats();
  if (chats.length === 0) {
    newChat();
  } else {
    const chat = getActiveChat() || chats[0];
    if (chat) {
      activeChatId = chat.id;
      saveChats();
      renderHistory();
      renderMessages(chat);
    }
  }
});