var currentUrl = window.location.href;

function whenReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

function ensureContainer(tag) {

  if (tag === "head") return document.head || document.getElementsByTagName("head")[0] || document.documentElement;
  if (tag === "body") return document.body || document.getElementsByTagName("body")[0] || document.documentElement;
  return document.documentElement;
}

function safeAppend(parent, child, label) {
  const target = parent || document.body || document.documentElement;
  if (!(target && "appendChild" in target)) {
    console.warn("safeAppend: parent invalid; fallback to documentElement", label);
    return document.documentElement.appendChild(child);
  }
  if (!(child instanceof Node)) {
    console.error("safeAppend: child is NOT a Node", label, { child });
    return null;
  }
  try {
    return target.appendChild(child);
  } catch (e) {
    console.error("safeAppend error:", label, e);
    try {
      return document.documentElement.appendChild(child);
    } catch (e2) {
      console.error("safeAppend fallback failed:", label, e2);
      return null;
    }
  }
}

function safeRemove(node, label) {
  try {
    node?.remove();
  } catch (e) {
    try {
      node?.parentNode?.removeChild(node);
    } catch (e2) {
      console.warn("safeRemove failed", label, e, e2);
    }
  }
}

// ====== Local Whitelist Logic ======
function getLocalWhitelist() {
  return JSON.parse(localStorage.getItem("localWhitelist") || "[]");
}
function addToLocalWhitelist(url) {
  const whitelist = getLocalWhitelist();
  if (!whitelist.includes(url)) {
    whitelist.push(url);
    localStorage.setItem("localWhitelist", JSON.stringify(whitelist));
  }
}
function removeFromLocalWhitelist(url) {
  const whitelist = getLocalWhitelist().filter((u) => u !== url);
  localStorage.setItem("localWhitelist", JSON.stringify(whitelist));
}
function isLocallyWhitelisted(url) {
  const whitelist = getLocalWhitelist();
  // checking with and without protocol
  const urlNoProto = url.replace(/^https?:\/\//, "");
  return (
    whitelist.includes(url) ||
    whitelist.includes(urlNoProto) ||
    whitelist.includes("https://" + urlNoProto) ||
    whitelist.includes("http://" + urlNoProto)
  );
}

// ====== UI Elements ======
const alertElm = document.createElement("div");
alertElm.title = "⚠️ This is a malicious site.";
alertElm.textContent = "⚠️"; 

const safeElm = document.createElement("div");
safeElm.textContent = "\u2705";

// CSS Keyframes and Styling
const style = document.createElement("style");
style.textContent = `
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.pulsing {
  animation: pulse 0.6s ease-in-out infinite;
  animation-delay: 0s;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  animation-play-state: paused;
}

.warning-popup {
  position: fixed;
  bottom: 90px;
  right: 24px;
  background-color: #fff3cd;
  color: #856404;
  padding: 16px;
  border: 1px solid #ffeeba;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  max-width: 280px;
  z-index: 2147483647 !important; 
  font-family: sans-serif;
}

.warning-popup button {
  margin-top: 10px;
  background-color: #d32f2f;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.safe-popup {
  position: fixed;
  bottom: 90px;
  right: 24px;
  background-color: rgb(213, 255, 205);
  color: rgb(4, 133, 62);
  padding: 16px;
  border: 1px solid rgb(194, 255, 186);
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  max-width: 280px;
  z-index: 2147483647 !important;
  font-family: sans-serif;
}

.safe-popup button {
  margin-top: 10px;
  background-color: rgb(167, 211, 47);
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}

@keyframes megpol-fade-in {
  0% { opacity: 0; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1); }
}

.megpol-modal {
  animation: megpol-fade-in 0.55s cubic-bezier(.4,2,.6,1);
}
`;

// Style the alert element
Object.assign(alertElm.style, {
  position: "fixed",
  bottom: "24px",
  right: "24px",
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  backgroundColor: "#D32F2F",
  color: "#FFFFFF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "28px",
  lineHeight: "1",
  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.3)",
  zIndex: 9999,
  cursor: "pointer",
  transition: "transform 0.3s ease, background-color 0.3s ease",
});

// Style the safe element
Object.assign(safeElm.style, {
  position: "fixed",
  bottom: "24px",
  right: "24px",
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  backgroundColor: "#b6d1b5",
  color: "#101218",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "28px",
  lineHeight: "1",
  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.3)",
  zIndex: 9999,
  cursor: "pointer",
  transition: "transform 0.3s ease, background-color 0.3s ease",
});

// Hover effect
alertElm.addEventListener("mouseover", () => {
  alertElm.style.backgroundColor = "#B71C1C";
});
alertElm.addEventListener("mouseout", () => {
  alertElm.style.backgroundColor = "#D32F2F";
});

// Pulse every 3 seconds
alertElm.classList.add("pulsing");
setInterval(() => {
  alertElm.style.animationPlayState = "running";
  setTimeout(() => {
    alertElm.style.animationPlayState = "paused";
  }, 700);
}, 2000);

// Click handler for warning icon -> compact popup
alertElm.addEventListener("click", () => {
  if (document.getElementById("warning-popup")) return;
  showWarningPopup();
});

// Click handler to show a modal for safe indicator (like showCustomAlert)
safeElm.addEventListener("click", () => {
  if (document.getElementById("custom-safe-overlay")) return;
  showCustomSafe("This site is marked safe/whitelisted. You can continue browsing.");
});

// Checking for local whitelist first, then global lists
function showSafeIndicator() {
  const body = ensureContainer("body");
  if (!document.body?.contains(safeElm)) safeAppend(body, safeElm, "safeElm mount");
  if (document.body?.contains(alertElm)) safeRemove(alertElm, "remove alertElm");
}
function showBlockedIndicator() {
  const body = ensureContainer("body");
  if (!document.body?.contains(alertElm)) safeAppend(body, alertElm, "alertElm mount");
  if (document.body?.contains(safeElm)) safeRemove(safeElm, "remove safeElm");
}

//unsafe popup
function showWarningPopup() {
  if (document.getElementById("warning-popup")) return;
  const popup = document.createElement("div");
  popup.className = "warning-popup glass-card";
  popup.id = "warning-popup";
  popup.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;">
      <span style="font-size:2.2rem;filter:drop-shadow(0 2px 8px #ff5959a6);">⚠️</span>
      <div>
        <div style="font-weight:700;font-size:1.22rem;">Dangerous or Malicious Site</div>
        <div style="margin-top:2px;">This site may attempt to trick you or steal your data. <br><b>Stay Safe!</b></div>
      </div>
    </div>
    <div style="display:flex;gap:12px;justify-content:flex-end;">
      <button class="popup-btn" id="leave-btn">Leave Site</button>
      <button class="popup-btn" id="ignore-btn">Ignore</button>
    </div>
  `;
  safeAppend(ensureContainer("body"), popup, "warning-popup");

  document.getElementById("leave-btn").onclick = () => {
    popup.style.opacity = 0;
    setTimeout(() => {
      safeRemove(popup, "warning-popup close");
      window.location.href = "https://www.google.com";
    }, 350);
  };
  document.getElementById("ignore-btn").onclick = () => {
    popup.style.opacity = 0;
    setTimeout(() => safeRemove(popup, "warning-popup ignore"), 350);
  };
}

function checkUrlStatus(url) {
  if (isLocallyWhitelisted(url)) {
    showSafeIndicator();
    return;
  }
  chrome.runtime.sendMessage({ type: "isBlacklisted", text: url }, (resp) => {
    const isBlacklisted = resp?.flag || false;
    if (isBlacklisted) {
      chrome.runtime.sendMessage({ type: "isWhitelisted", text: url }, (resp2) => {
        const isGloballyWhitelisted = resp2?.flag || false;
        if (isGloballyWhitelisted) {
          showSafeIndicator();
        } else {
          showBlockedIndicator();
          showCustomAlert(
            "Would you like to continue?",
            () => {}, 
            () => {} 
          );
        }
      });
    } else {
      chrome.runtime.sendMessage({ type: "isWhitelisted", text: url }, (resp2) => {
        const isGloballyWhitelisted = resp2?.flag || false;
        if (isGloballyWhitelisted) {
          showSafeIndicator();
        }
      });
    }
  });
}

// Helper for cross button
function createCrossButton(isDark, onClick) {
  const crossBtn = document.createElement("button");
  crossBtn.innerHTML = "&#10006;";
  crossBtn.title = "Close";
  crossBtn.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    background: transparent;
    border: none;
    color: ${isDark ? "#f1f1f1" : "#212121"};
    font-size: 22px;
    cursor: pointer;
    z-index: 10;
    padding: 0;
    line-height: 1;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  `;
  crossBtn.onmouseover = () => {
    crossBtn.style.color = isDark ? "#ff5252" : "#d32f2f";
  };
  crossBtn.onmouseout = () => {
    crossBtn.style.color = isDark ? "#f1f1f1" : "#212121";
  };
  crossBtn.onclick = onClick;
  return crossBtn;
}

// Custom Alert with Unblock button
function showCustomAlert(message, onConfirm, onUnblock) {
  if (document.getElementById("custom-alert-overlay") || document.getElementById("modal-shadow-container")) return;
  const modalHtml = `
    <div class="megpol-modal megpol-animate">
      <div class="megpol-title">
        Warning: This site has been blacklisted by Meghalaya Police.
      </div>
      <p class="megpol-subtitle">${message || ""}</p>
      <div class="megpol-status" id="modal-status"></div>
      <div class="megpol-btn-row">
        <button id="more-info-btn" class="megpol-btn megpol-btn-blue">More Info</button>
        <button id="confirm-btn" class="megpol-btn megpol-btn-green">Allow This Time</button>
        <button id="unblock-btn" class="megpol-btn megpol-btn-orange">Unblock</button>
        <button id="remove-unblock-btn" class="megpol-btn megpol-btn-orange" style="display:none;">Remove Unblock</button>
        <button id="close-btn" class="megpol-close-btn">&#10006;</button>
      </div>
    </div>
  `;
  const modalStyle = `
    :host { all: initial; }
    @keyframes megpol-fade-in {
      0% { opacity: 0; transform: scale(0.92); }
      100% { opacity: 1; transform: scale(1); }
    }
    .megpol-modal {
      font-family: 'Segoe UI', 'Roboto', Arial, sans-serif !important;
      font-size: 1.15rem !important;
      background: rgba(255,255,255,0.92);
      color: #212121 !important;
      padding: 32px 40px 22px 40px;
      border-radius: 16px;
      box-sizing: border-box;
      box-shadow: 0 8px 40px 0 rgba(255,68,68,0.18);
      text-align: center;
      max-width: 520px;
      width: 95vw;
      position: relative;
      animation: megpol-fade-in 0.55s cubic-bezier(.4,2,.6,1);
    }
    .megpol-title {
      font-size: 1.6rem !important;
      font-weight: 700 !important;
      margin-bottom: 10px;
      color: #212121 !important;
    }
    .megpol-link {
      color: #1976d2 !important;
      text-decoration: underline !important;
      font-weight: 600 !important;
      font-size: 1.1rem !important;
    }
    .megpol-subtitle {
      font-size: 1.08rem !important;
      font-weight: 400 !important;
      margin-bottom: 12px;
      color: #212121 !important;
    }
    .megpol-status {
      font-size: 0.98rem !important;
      margin-top: 12px;
      color: #333 !important;
      text-align: center;
    }
    .megpol-btn-row {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 10px;
    }
    .megpol-btn {
      padding: 9px 18px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600 !important;
      font-size: 1.02rem !important;
      transition: filter 0.2s;
      outline: none;
    }
    .megpol-btn-blue { background: #1976d2 !important; color: #fff !important; }
    .megpol-btn-green { background: #43e97b !important; color: #fff !important; }
    .megpol-btn-orange { background: #ff9800 !important; color: #fff !important; }
    .megpol-btn:hover { filter: brightness(0.92); }
    .megpol-close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      background: transparent;
      border: none;
      color: #212121 !important;
      font-size: 1.6rem !important;
      cursor: pointer;
      font-weight: 700 !important;
      line-height: 1;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }
    .megpol-close-btn:hover { color: #d32f2f !important; }
  `;
  const container = createModalWithShadow(modalHtml, modalStyle);
  safeAppend(ensureContainer("body"), container, "custom-alert shadow");
  const shadow = container.shadowRoot;

  // More Info -> redirect to Meg Police
  shadow.getElementById("more-info-btn").onclick = () => {
    window.location.href = "https://megpolice.gov.in/";
  };

  // Toggle Unblock/Remove-Unblock based on local allowlist
  const unblockBtn = shadow.getElementById("unblock-btn");
  const removeUnblockBtn = shadow.getElementById("remove-unblock-btn");
  if (isLocallyWhitelisted(currentUrl)) {
    unblockBtn.style.display = "none";
    removeUnblockBtn.style.display = "inline-block";
  } else {
    unblockBtn.style.display = "inline-block";
    removeUnblockBtn.style.display = "none";
  }

  shadow.getElementById("confirm-btn").onclick = () => {
    onConfirm?.();
    safeRemove(container, "custom-alert close");
  };

  // Unblock -> add to local allowlist
  unblockBtn.onclick = () => {
    addToLocalWhitelist(currentUrl);
    const status = shadow.getElementById("modal-status");
    if (status) status.textContent = "This site has been unblocked locally.";
    showSafeIndicator();
    unblockBtn.style.display = "none";
    removeUnblockBtn.style.display = "inline-block";
    // Show the safe modal after unblocking
    safeRemove(container, "custom-alert close");
    showCustomSafe("This site is marked safe/whitelisted. You can continue browsing.");
  };

  // Remove Unblock -> remove from local allowlist
  removeUnblockBtn.onclick = () => {
    removeFromLocalWhitelist(currentUrl);
    const status = shadow.getElementById("modal-status");
    if (status) status.textContent = "Local unblock removed.";
    checkUrlStatus(currentUrl); 
    unblockBtn.style.display = "inline-block";
    removeUnblockBtn.style.display = "none";
  };

  shadow.getElementById("close-btn").onclick = () => {
    safeRemove(container, "custom-alert cross");
  };
}

function showCustomSafe(message) {
  if (document.getElementById("custom-safe-overlay") || document.getElementById("modal-shadow-container")) return;
  const modalHtml = `
    <div class="megpol-modal megpol-animate">
      <div class="megpol-title" style="color:#1b5e20;">
        <span style="font-size:1.8rem;filter:drop-shadow(0 2px 8px #4caf50a8);">\u2705</span>
        Site Verified Safe
      </div>
      <p class="megpol-subtitle" style="color:#256029;">Verified by Meg Cyber Police.<br>${message || ""}</p>
      <div class="megpol-status" id="modal-status"></div>
      <div class="megpol-btn-row">
        <button id="more-info-btn" class="megpol-btn megpol-btn-blue">More Info</button>
        <button id="remove-unblock-btn" class="megpol-btn megpol-btn-orange" style="display:none;">Remove Unblock</button>
        <button id="close-btn" class="megpol-close-btn">&#10006;</button>
      </div>
    </div>
  `;
  const modalStyle = `
    :host { all: initial; }
    @keyframes megpol-fade-in {
      0% { opacity: 0; transform: scale(0.92); }
      100% { opacity: 1; transform: scale(1); }
    }
    .megpol-modal {
      font-family: 'Segoe UI', 'Roboto', Arial, sans-serif !important;
      font-size: 1.15rem !important;
      background: rgba(255,255,255,0.92);
      color: #1b5e20 !important;
      padding: 32px 40px 22px 40px;
      border-radius: 16px;
      box-sizing: border-box;
      box-shadow: 0 8px 40px 0 rgba(76,175,80,0.18);
      text-align: center;
      max-width: 520px;
      width: 95vw;
      position: relative;
      animation: megpol-fade-in 0.55s cubic-bezier(.4,2,.6,1);
    }
    .megpol-title {
      font-size: 1.6rem !important;
      font-weight: 700 !important;
      margin-bottom: 10px;
      color: #1b5e20 !important;
    }
    .megpol-subtitle {
      font-size: 1.08rem !important;
      font-weight: 400 !important;
      margin-bottom: 12px;
      color: #256029 !important;
    }
    .megpol-status {
      font-size: 0.98rem !important;
      margin-top: 12px;
      color: #333 !important;
      text-align: center;
    }
    .megpol-btn-row {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 10px;
    }
    .megpol-btn {
      padding: 9px 18px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600 !important;
      font-size: 1.02rem !important;
      transition: filter 0.2s;
      outline: none;
    }
    .megpol-btn-blue { background: #1976d2 !important; color: #fff !important; }
    .megpol-btn-orange { background: #ff9800 !important; color: #fff !important; }
    .megpol-btn:hover { filter: brightness(0.92); }
    .megpol-close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      background: transparent;
      border: none;
      color: #1b5e20 !important;
      font-size: 1.6rem !important;
      cursor: pointer;
      font-weight: 700 !important;
      line-height: 1;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }
    .megpol-close-btn:hover { color: #d32f2f !important; }
  `;
  const container = createModalWithShadow(modalHtml, modalStyle);
  safeAppend(ensureContainer("body"), container, "custom-safe shadow");
  const shadow = container.shadowRoot;

  // More Info -> redirect to Meg Police
  shadow.getElementById("more-info-btn").onclick = () => {
    window.location.href = "https://megpolice.gov.in/";
  };

  // Show "Remove Unblock" only if locally allowed
  const removeUnblockBtn = shadow.getElementById("remove-unblock-btn");
  if (isLocallyWhitelisted(currentUrl)) {
    removeUnblockBtn.style.display = "inline-block";
  } else {
    removeUnblockBtn.style.display = "none";
  }

  // Remove Unblock -> remove from local allowlist and re-check
  removeUnblockBtn.onclick = () => {
    removeFromLocalWhitelist(currentUrl);
    const status = shadow.getElementById("modal-status");
    if (status) status.textContent = "Local unblock removed.";
    safeRemove(container, "custom-safe removed-unblock");
    checkUrlStatus(currentUrl);
  };

  shadow.getElementById("close-btn").onclick = () => {
    safeRemove(container, "custom-safe cross");
  };
}

// Create and attach a modal with shadow DOM
function createModalWithShadow(html, styleText) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "100vw";
  container.style.height = "100vh";
  container.style.zIndex = "2147483647";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.background = "rgba(30,34,40,0.30)";
  container.style.animation = "fadeInUp 0.7s";
  container.id = "modal-shadow-container";

  const shadow = container.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styleText;
  shadow.appendChild(style);

  const modal = document.createElement("div");
  modal.innerHTML = html;
  shadow.appendChild(modal);

  return container;
}

// Mount style and run after DOM is ready
whenReady(() => {
  safeAppend(ensureContainer("head"), style, "global <style> injection");
  checkUrlStatus(currentUrl);
});