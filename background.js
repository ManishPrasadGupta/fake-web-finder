let compiledPatterns = null;
let whitelistedPatterns = null;
let blacklistedPatterns = null;

const BLACKLIST_URL = "https://cyber.megpolice.gov.in/lists/blacklist.txt";
const WHITELIST_URL = "https://cyber.megpolice.gov.in/lists/whitelist.txt";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

// Auto-refresh (proactive) using chrome.alarms
const ALARM_NAME = "refreshPatterns";
const REFRESH_PERIOD_MIN = Math.max(1, Math.floor(CACHE_TTL_MS / 60000));

function globToRegex(pattern) {
  return "^" + pattern.trim()
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*") + "$";
}

function getCache(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key] || null));
  });
}

function setCache(key, value) {
  chrome.storage.local.set({ [key]: value });
}

async function fetchPatternListWithCache(url, cacheKey, { force = false } = {}) {
  const now = Date.now();
  if (!force) {
    const cached = await getCache(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS && Array.isArray(cached.patterns)) {
      return cached.patterns;
    }
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  const patterns = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  setCache(cacheKey, { patterns, timestamp: now });
  return patterns;
}

function compile(patterns) {
  return patterns
    .map((p) => {
      try {
        return new RegExp(globToRegex(p), "i");
      } catch (e) {
        console.warn("Invalid pattern skipped:", p);
        return null;
      }
    })
    .filter(Boolean);
}

async function loadPatterns({ force = false } = {}) {

  if (compiledPatterns && !force) return compiledPatterns;
  const [bl, wl] = await Promise.all([
    fetchPatternListWithCache(BLACKLIST_URL, "blacklist_patterns", { force }),
    fetchPatternListWithCache(WHITELIST_URL, "whitelist_patterns", { force }),
  ]);
  blacklistedPatterns = compile(bl);
  whitelistedPatterns = compile(wl);
  compiledPatterns = { blacklistedPatterns, whitelistedPatterns };
  return compiledPatterns;
}

async function forceRefreshPatterns() {
  const patterns = await loadPatterns({ force: true });
  return {
    ok: true,
    counts: {
      blacklisted: patterns.blacklistedPatterns.length,
      whitelisted: patterns.whitelistedPatterns.length,
    },
    updated_at: Date.now(),
  };
}

function scheduleRefreshAlarm() {
  try {
    chrome.alarms.clear(ALARM_NAME, () => {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: REFRESH_PERIOD_MIN });
    });
  } catch (e) {
    console.warn("Failed to schedule alarm:", e);
  }
}

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    forceRefreshPatterns().catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(() => {
  loadPatterns().catch(() => {});
  scheduleRefreshAlarm();
});

chrome.runtime.onStartup?.addListener(() => {
  loadPatterns().catch(() => {});
  scheduleRefreshAlarm();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "isBlacklisted" || msg.type === "isWhitelisted") {
        const patterns = await loadPatterns();
        const regexList = msg.type === "isBlacklisted"
          ? patterns.blacklistedPatterns
          : patterns.whitelistedPatterns;

        const url = msg.text;
        const urlNoProto = url.replace(/^https?:\/\//, "");
        const urlNoWww = urlNoProto.replace(/^www\./, "");
        const domainOnly = urlNoProto.split("/")[0].replace(/^www\./, "");

        const flag =
          regexList.some((regex) => regex.test(url)) ||
          regexList.some((regex) => regex.test(urlNoProto)) ||
          regexList.some((regex) => regex.test(urlNoWww)) ||
          regexList.some((regex) => regex.test(domainOnly));

        sendResponse({ flag });
      } else if (msg.type === "refreshLists") {
        const result = await forceRefreshPatterns();
        sendResponse(result);
      } else if (msg.type === "invalidateCache") {
        compiledPatterns = null;
        whitelistedPatterns = null;
        blacklistedPatterns = null;
        await new Promise((resolve) =>
          chrome.storage.local.remove(["blacklist_patterns", "whitelist_patterns"], resolve)
        );
        sendResponse({ ok: true });
      } else {
        sendResponse({ flag: false });
      }
    } catch (e) {
      console.error("Background error:", e);
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; 
});