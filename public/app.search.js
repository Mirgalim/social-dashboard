// ===== Config =====
const API_BASE = "https://social-dashboard-h1su.onrender.com";
const ALL_PLATFORMS = [
  "YouTube",
  "Reddit",
  "Facebook",
  "Instagram",
  "TikTok",
  "LinkedIn",
  "Twitter",
  "Web",
];
const STATE = {
  all: [],
  filtered: [],
  includedPlatforms: new Set(ALL_PLATFORMS),
  range: "all",
  sortBy: "date_desc",
  lastUpdated: null,
  errors: {},
};
const CHAT = { messages: [] };

// ===== Shortcuts =====
const $ = (id) => document.getElementById(id);

// ===== Theme =====
function initTheme() {
  const root = document.documentElement;
  const btn = $("themeToggle");
  const apply = () => {
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
      btn.classList.remove("pill-on");
      btn.classList.add("pill-off");
    } else {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      btn.classList.remove("pill-off");
      btn.classList.add("pill-on");
    }
  };
  // initial
  if ((localStorage.getItem("theme") || "dark") === "dark") {
    root.classList.add("dark");
    btn.classList.add("pill-on");
  } else {
    btn.classList.add("pill-off");
  }
  btn.addEventListener("click", apply);
}

// ===== Utils =====
function parseDateFlexible(raw) {
  if (!raw && raw !== 0) return null;
  if (typeof raw === "number") return new Date(raw > 1e12 ? raw : raw * 1000);
  const d = new Date(String(raw).trim());
  return isNaN(d) ? null : d;
}
function textShort(s, n = 100) {
  s = s || "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function fmtDate(d) {
  return d ? d.toISOString().slice(0, 10) : "—";
}
function inDateRange(d, range) {
  if (!d) return false;
  const now = new Date(),
    start = new Date(now);
  if (range === "d7") {
    start.setDate(now.getDate() - 7);
    return d >= start && d <= now;
  }
  if (range === "d30") {
    start.setDate(now.getDate() - 30);
    return d >= start && d <= now;
  }
  if (range === "d90") {
    start.setDate(now.getDate() - 90);
    return d >= start && d <= now;
  }
  if (range === "y2024") return d.getFullYear() === 2024;
  return true;
}

// ===== Social logic =====
function applyFilter() {
  STATE.filtered = STATE.all.filter(
    (x) =>
      STATE.includedPlatforms.has(x.platform) &&
      inDateRange(x.date, STATE.range)
  );
}
function computeByPlatform(rows) {
  const by = {};
  for (const r of rows) {
    if (!by[r.platform])
      by[r.platform] = { posts: 0, likes: 0, comments: 0, shares: 0, views: 0 };
    const p = by[r.platform];
    p.posts++;
    p.likes += r.likes;
    p.comments += r.comments;
    p.shares += r.shares;
    p.views += r.views;
  }
  for (const k in by)
    by[k].engagement =
      by[k].likes + by[k].comments + by[k].shares + by[k].views;
  return by;
}

function renderPlatformPills() {
  const wrap = $("platformFilters");
  wrap.innerHTML = "";
  for (const p of ALL_PLATFORMS) {
    const on = STATE.includedPlatforms.has(p);
    const btn = document.createElement("button");
    btn.className = "pill " + (on ? "pill-on" : "pill-off");
    btn.textContent = p;
    btn.onclick = () => {
      if (STATE.includedPlatforms.has(p)) STATE.includedPlatforms.delete(p);
      else STATE.includedPlatforms.add(p);
      updateUI();
    };
    wrap.appendChild(btn);
  }
}
function renderKPIs(rows) {
  const t = rows.reduce(
    (a, r) => {
      a.posts++;
      a.likes += r.likes;
      a.comments += r.comments;
      a.shares += r.shares;
      a.views += r.views;
      return a;
    },
    { posts: 0, likes: 0, comments: 0, shares: 0, views: 0 }
  );
  $("kpiPosts").textContent = t.posts.toLocaleString();
  $("kpiLikes").textContent = t.likes.toLocaleString();
  $("kpiComments").textContent = t.comments.toLocaleString();
  $("kpiShares").textContent = t.shares.toLocaleString();
  $("kpiViews").textContent = t.views.toLocaleString();
}

let engagementChart = null,
  stackedChart = null;
function renderEngagementChart(by) {
  const ctx = $("engagementChart").getContext("2d");
  const labels = Object.keys(by);
  const vals = labels.map((k) => by[k].engagement);
  if (engagementChart) engagementChart.destroy();
  engagementChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Engagement", data: vals }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}
function renderStackedChart(by) {
  const ctx = $("stackedChart").getContext("2d");
  const labels = Object.keys(by);
  const likes = labels.map((k) => by[k].likes);
  const comments = labels.map((k) => by[k].comments);
  const shares = labels.map((k) => by[k].shares);
  const views = labels.map((k) => by[k].views);
  if (stackedChart) stackedChart.destroy();
  stackedChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Likes", data: likes },
        { label: "Comments", data: comments },
        { label: "Shares", data: shares },
        { label: "Views", data: views },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
    },
  });
}

function sortRows(rows, sortBy) {
  const keyed = rows.map((r) => ({
    ...r,
    engagement: r.likes + r.comments + r.shares + r.views,
    _ts: r.date ? r.date?.getTime?.() || 0 : -1, // null date = -1
  }));

  const map = {
    engagement_desc: (a, b) => b.engagement - a.engagement,
    date_desc: (a, b) => b._ts - a._ts, // null-ууд хамгийн сүүлд
    likes_desc: (a, b) => b.likes - a.likes,
    comments_desc: (a, b) => b.comments - a.comments,
    views_desc: (a, b) => b.views - a.views,
  };
  return keyed.sort(map[sortBy] || map.date_desc).slice(0, 50);
}

function renderTopTable(rows) {
  const tbody = $("topTable").querySelector("tbody");
  tbody.innerHTML = "";
  for (const r of sortRows(rows, STATE.sortBy)) {
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-200 dark:border-slate-700";
    tr.innerHTML = `<td class="px-3 py-2">${
      r.platform
    }</td><td class="px-3 py-2">${textShort(
      r.text,
      140
    )}</td><td class="px-3 py-2 text-right">${fmtDate(
      r.date
    )}</td><td class="px-3 py-2 text-right">${r.likes.toLocaleString()}</td><td class="px-3 py-2 text-right">${r.comments.toLocaleString()}</td><td class="px-3 py-2 text-right">${r.shares.toLocaleString()}</td><td class="px-3 py-2 text-right">${r.views.toLocaleString()}</td><td class="px-3 py-2 text-right">${(
      r.likes +
      r.comments +
      r.shares +
      r.views
    ).toLocaleString()}</td><td class="px-3 py-2 text-right">${
      r.url
        ? `<a class="text-blue-600 dark:text-blue-400 hover:underline" href="${r.url}" target="_blank" rel="noopener">Нээх</a>`
        : "—"
    }</td>`;
    tbody.appendChild(tr);
  }
}

function renderStatus() {
  const parts = [];
  if (STATE.lastUpdated)
    parts.push(`Шинэчлэгдсэн: ${STATE.lastUpdated.toLocaleTimeString()}`);
  const errs = Object.entries(STATE.errors).filter(([, v]) => !!v);
  if (errs.length)
    parts.push("⚠️ " + errs.map(([k, v]) => `${k}: ${v}`).join(" | "));
  $("status").textContent = parts.join(" · ");
}

function updateUI() {
  applyFilter();
  const by = computeByPlatform(STATE.filtered);
  renderKPIs(STATE.filtered);
  renderEngagementChart(by);
  renderStackedChart(by);
  renderTopTable(STATE.filtered);
  renderPlatformPills();
  $("range").value = STATE.range;
  $("sortBy").value = STATE.sortBy;
  renderStatus();
}

// ===== Data fetchers =====
async function runSearch() {
  const qv = $("q").value.trim();
  if (!qv) {
    $("status").textContent = "Түлхүүр үгээ оруулна уу";
    return;
  }
  $("status").textContent = "Loading…";

  const url = `${API_BASE}/api/search?q=${encodeURIComponent(qv)}&news=1`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    const j = await r.json();
    const rows = (j.data || []).map((x) => ({
      ...x,
      date: x.date ? parseDateFlexible(x.date) : null,
    }));
    STATE.all = rows;
    STATE.errors = j.errors || {};
    STATE.lastUpdated = new Date();
    updateUI();
    if (j.news) {
      try {
        const html = window.marked.parse(
          j.news.summary || j.news.assistant || ""
        );
        $("newsBox").innerHTML = html;
        const ul = $("newsSources");
        ul.innerHTML = "";
        (j.news.sources || []).forEach((s) => {
          const li = document.createElement("li");
          li.innerHTML = `<a class="hover:underline" href="${s}" target="_blank" rel="noopener">${s}</a>`;
          ul.appendChild(li);
        });
      } catch (_) {
        // алдаа залгиж, UI-г эвдэхгүй
      }
    }
    $("status").textContent = `OK · ${rows.length} items · ${STATE.lastUpdated.toLocaleTimeString()}`;
  } catch (e) {
    console.error("SEARCH ERROR:", e);
    $("status").textContent = `⚠️ ${String(e?.message || e)}`;
  }
}

async function runNews() {
  const qv = $("q").value.trim();
  if (!qv) {
    $("status").textContent = "Түлхүүр үгээ оруулна уу";
    return;
  }
  $("status").textContent = "Fetching news…";

  const url = `${API_BASE}/api/news?q=${encodeURIComponent(qv)}`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "news failed");
    // Markdown-ыг HTML болгон newsBox-д оруулна
    const html = window.marked.parse(j.summary || "");
    $("newsBox").innerHTML = html;
    const ul = $("newsSources");
    ul.innerHTML = "";
    (j.sources || []).forEach((s) => {
      const li = document.createElement("li");
      li.innerHTML = `<a class="hover:underline" href="${s}" target="_blank" rel="noopener">${s}</a>`;
      ul.appendChild(li);
    });
    $("status").textContent = "News ok";
  } catch (e) {
    console.error("NEWS ERROR:", e);
    $("status").textContent = `⚠️ News: ${String(e?.message || e)}`;
  }
}

// ===== Chat UI =====
function renderChatMessage(role, content) {
  const log = $("chatLog");
  const div = document.createElement("div");
  div.className =
    "chat-bubble " + (role === "user" ? "chat-user" : "chat-assistant");
  // Assistant-д markdown рендерлье, user-д энгийн текст
  if (role === "assistant") {
    div.innerHTML = window.marked.parse(content || "");
  } else {
    div.textContent = content || "";
  }
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function renderChatImages(urls = []) {
  const wrap = $("chatImages");
  wrap.innerHTML = "";
  urls
    .filter((u) => /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(u))
    .slice(0, 12)
    .forEach((u) => {
      const a = document.createElement("a");
      a.href = u;
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `<img class="img-thumb" src="${u}" alt="img">`;
      wrap.appendChild(a);
    });
}

async function sendChat() {
  const input = $("chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  // push user
  CHAT.messages.push({ role: "user", content: text });
  renderChatMessage("user", text);

  $("status").textContent = "Chatting…";
  try {
    const r = await fetch(`${API_BASE}/api/pplx/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ messages: CHAT.messages }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "chat failed");
    const content = j.assistant || "";
    CHAT.messages.push({ role: "assistant", content });
    renderChatMessage("assistant", content);
    renderChatImages(j.urls || []);
    $("status").textContent = "Chat ok";
  } catch (e) {
    console.error("CHAT ERROR:", e);
    $("status").textContent = `⚠️ Chat: ${String(e?.message || e)}`;
  }
}

// ===== Tabs =====
function showPane(which) {
  const panes = ["paneSocial", "paneNews", "paneChat"];
  const tabs = ["tabSocial", "tabNews", "tabChat"];
  panes.forEach((id) => {
    $(id).classList.add("hidden");
  });
  tabs.forEach((id) => {
    $(id).classList.remove("pill-on");
    $(id).classList.add("pill-off");
  });
  $(`pane${which}`).classList.remove("hidden");
  $(`tab${which}`).classList.remove("pill-off");
  $(`tab${which}`).classList.add("pill-on");
}

async function runNewsChat() {
  const qv = $("q").value.trim();
  if (!qv) return;

  const box = $("chatBox");
  box.innerHTML += `<div class="text-right"><div class="inline-block bg-blue-600 text-white rounded-xl px-3 py-2 my-1">${qv}</div></div>`;
  box.scrollTop = box.scrollHeight;

  try {
    const r = await fetch(`${API_BASE}/api/news?q=${encodeURIComponent(qv)}`);
    const j = await r.json();

    if (j.ok && j.messages.length) {
      const msg = j.messages[0].content;
      box.innerHTML += `<div class="text-left"><div class="inline-block bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 my-1">${msg}</div></div>`;
    } else {
      box.innerHTML += `<div class="text-left text-red-500 text-sm">⚠️ Error: ${
        j.error || "Unknown"
      }</div>`;
    }
  } catch (e) {
    box.innerHTML += `<div class="text-left text-red-500 text-sm">⚠️ ${e.message}</div>`;
  } finally {
    box.scrollTop = box.scrollHeight;
  }
}
// ===== Init =====
function init() {
  initTheme();

  $("searchBtn").addEventListener("click", runSearch);
  $("q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });
  $("range").addEventListener("change", (e) => {
    STATE.range = e.target.value;
    updateUI();
  });
  $("sortBy").addEventListener("change", (e) => {
    STATE.sortBy = e.target.value;
    updateUI();
  });

  $("chatSend").addEventListener("click", sendChat);
  $("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat();
  });

  $("tabSocial").addEventListener("click", () => showPane("Social"));
  $("tabNews").addEventListener("click", () => showPane("News"));
  $("tabChat").addEventListener("click", () => showPane("Chat"));

  // default
  showPane("Social");
  renderPlatformPills();
  updateUI();
}

document.addEventListener("DOMContentLoaded", init);
