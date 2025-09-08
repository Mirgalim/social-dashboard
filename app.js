/* ===================== Config ===================== */
/** USER SETTINGS — энд өөрийн сувгууд/хаягуудыг солино */
const CONFIG = {
  youtubeChannelId: "UC_x5XG1OV2P6uZZ5FSM9TQ", // Google Developers (жишээ)
  twitterUser: "elonmusk",
  instagramUser: "instagram",
  tiktokUser: "scout2015", // TikTok demo account (жишээ)
  facebookPage: "Meta"     // FB page username эсвэл ID
};

/** RSSHub public mirror ба RSS → JSON proxy */
const RSSHUB_BASE = "https://rsshub.app";
const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";

/** Авто refresh (клиент тал) */
let REFRESH_EVERY_MS = 60_000;

/* ===================== Helpers ===================== */
function parseDateFlexible(raw) {
  if (!raw && raw !== 0) return null;
  if (typeof raw === "number") {
    if (raw > 1e12) return new Date(raw); // ms
    return new Date(raw * 1000); // sec
  }
  const s = String(raw).trim();
  const d = new Date(s);
  if (!isNaN(d)) return d;
  return null;
}
function textShort(s, n = 100) { s = s || ""; return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function fmtDate(d) { return d ? d.toISOString().slice(0,10) : "—"; }

async function fetchJSON(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

/* ===================== Public data fetchers ===================== */
/** 1) YOUTUBE (LemnosLIFE noKey) — бодит статистиктой */
async function fetchYouTubeNoKey(channelId, signal) {
  // 1) channel -> uploads playlist id
  const ch = await fetchJSON(`https://yt.lemnoslife.com/noKey/channels?part=contentDetails&id=${channelId}`, signal);
  const uploads = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];

  // 2) playlistItems -> get latest 20 video IDs
  const pl = await fetchJSON(`https://yt.lemnoslife.com/noKey/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=20`, signal);
  const ids = (pl?.items || []).map(it => it.contentDetails?.videoId).filter(Boolean);
  if (!ids.length) return [];

  // 3) videos stats
  const vids = await fetchJSON(`https://yt.lemnoslife.com/noKey/videos?part=snippet,statistics&id=${ids.join(",")}`, signal);
  return (vids?.items || []).map(v => ({
    platform: "YouTube",
    text: v.snippet?.title || "",
    date: parseDateFlexible(v.snippet?.publishedAt),
    url: `https://www.youtube.com/watch?v=${v.id}`,
    likes: Number(v.statistics?.likeCount || 0),
    comments: Number(v.statistics?.commentCount || 0),
    shares: 0,
    views: Number(v.statistics?.viewCount || 0)
  }));
}

/** 2) RSSHub → rss2json — X/Twitter, Instagram, TikTok, Facebook Page */
async function fetchViaRSSHub(path, signal) {
  const rss = `${RSSHUB_BASE}${path}`;
  const url = `${RSS2JSON}${encodeURIComponent(rss)}`;
  const j = await fetchJSON(url, signal);
  const items = j?.items || [];
  return items.map(it => ({
    title: it.title || "",
    link: it.link,
    pubDate: it.pubDate || it.pubdate || it.date || null,
    // RSS-д лайк/коммент/үзэлт ихэвчлэн ирдэггүй
  }));
}

async function fetchTwitterRSS(user, signal) {
  const items = await fetchViaRSSHub(`/twitter/user/${encodeURIComponent(user)}`, signal);
  return items.map(it => ({
    platform: "Twitter",
    text: it.title,
    date: parseDateFlexible(it.pubDate),
    url: it.link,
    likes: 0, comments: 0, shares: 0, views: 0
  }));
}

async function fetchInstagramRSS(user, signal) {
  const items = await fetchViaRSSHub(`/instagram/user/${encodeURIComponent(user)}`, signal);
  return items.map(it => ({
    platform: "Instagram",
    text: it.title,
    date: parseDateFlexible(it.pubDate),
    url: it.link,
    likes: 0, comments: 0, shares: 0, views: 0
  }));
}

async function fetchTikTokRSS(user, signal) {
  const items = await fetchViaRSSHub(`/tiktok/user/${encodeURIComponent(user)}`, signal);
  return items.map(it => ({
    platform: "TikTok",
    text: it.title,
    date: parseDateFlexible(it.pubDate),
    url: it.link,
    likes: 0, comments: 0, shares: 0, views: 0
  }));
}

async function fetchFacebookPageRSS(page, signal) {
  const items = await fetchViaRSSHub(`/facebook/page/${encodeURIComponent(page)}`, signal);
  return items.map(it => ({
    platform: "Facebook",
    text: it.title,
    date: parseDateFlexible(it.pubDate),
    url: it.link,
    likes: 0, comments: 0, shares: 0, views: 0
  }));
}

/* ===================== State ===================== */
const ALL_PLATFORMS = ["Instagram", "YouTube", "Facebook", "TikTok", "Twitter"];
const STATE = {
  all: [],
  filtered: [],
  includedPlatforms: new Set(ALL_PLATFORMS),
  range: "all",
  sortBy: "engagement_desc",
  lastUpdated: null,
  errors: {}
};

function inDateRange(d, range) {
  if (!d) return false;
  const now = new Date();
  const start = new Date(now);
  if (range === "d7")  { start.setDate(now.getDate() - 7);  return d >= start && d <= now; }
  if (range === "d30") { start.setDate(now.getDate() - 30); return d >= start && d <= now; }
  if (range === "d90") { start.setDate(now.getDate() - 90); return d >= start && d <= now; }
  if (range === "y2024") { return d.getFullYear() === 2024; }
  return true;
}

function applyFilter() {
  STATE.filtered = STATE.all.filter(x =>
    STATE.includedPlatforms.has(x.platform) && inDateRange(x.date, STATE.range)
  );
}

/* ===================== Aggregations & UI ===================== */
function computeByPlatform(rows) {
  const by = {};
  for (const r of rows) {
    const k = r.platform;
    if (!by[k]) by[k] = { posts: 0, likes: 0, comments: 0, shares: 0, views: 0 };
    const p = by[k];
    p.posts += 1;
    p.likes += r.likes;
    p.comments += r.comments;
    p.shares += r.shares;
    p.views += r.views;
  }
  for (const k in by) by[k].engagement = by[k].likes + by[k].comments + by[k].shares + by[k].views;
  return by;
}

function renderPlatformPills() {
  const wrap = document.getElementById("platformFilters");
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
  const totals = rows.reduce((acc, r) => {
    acc.posts += 1;
    acc.likes += r.likes;
    acc.comments += r.comments;
    acc.shares += r.shares;
    acc.views += r.views;
    return acc;
  }, { posts: 0, likes: 0, comments: 0, shares: 0, views: 0 });
  document.getElementById("kpiPosts").textContent = totals.posts.toLocaleString();
  document.getElementById("kpiLikes").textContent = totals.likes.toLocaleString();
  document.getElementById("kpiComments").textContent = totals.comments.toLocaleString();
  document.getElementById("kpiShares").textContent = totals.shares.toLocaleString();
  document.getElementById("kpiViews").textContent = totals.views.toLocaleString();
}

let engagementChart = null;
let stackedChart = null;

function renderEngagementChart(by) {
  const ctx = document.getElementById("engagementChart").getContext("2d");
  const labels = Object.keys(by);
  const values = labels.map(k => by[k].engagement);
  if (engagementChart) engagementChart.destroy();
  engagementChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Engagement", data: values }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderStackedChart(by) {
  const ctx = document.getElementById("stackedChart").getContext("2d");
  const labels = Object.keys(by);
  const likes = labels.map(k => by[k].likes);
  const comments = labels.map(k => by[k].comments);
  const shares = labels.map(k => by[k].shares);
  const views = labels.map(k => by[k].views);
  if (stackedChart) stackedChart.destroy();
  stackedChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [
      { label: "Likes", data: likes },
      { label: "Comments", data: comments },
      { label: "Shares", data: shares },
      { label: "Views", data: views }
    ]},
    options: { responsive: true, plugins: { legend: { position: "top" } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
  });
}

function sortRows(rows, sortBy) {
  const keyed = rows.map(r => ({ ...r, engagement: r.likes + r.comments + r.shares + r.views }));
  const map = {
    engagement_desc: (a,b)=>b.engagement - a.engagement,
    date_desc: (a,b)=>(b.date?.getTime()||0) - (a.date?.getTime()||0),
    likes_desc: (a,b)=>b.likes - a.likes,
    comments_desc: (a,b)=>b.comments - a.comments,
    views_desc: (a,b)=>b.views - a.views
  };
  return keyed.sort(map[sortBy] || map.engagement_desc).slice(0, 30);
}

function renderTopTable(rows) {
  const tbody = document.querySelector("#topTable tbody");
  tbody.innerHTML = "";
  const ranked = sortRows(rows, STATE.sortBy);
  for (const r of ranked) {
    const dateStr = fmtDate(r.date);
    const link = r.url ? `<a class="text-blue-600 hover:underline" href="${r.url}" target="_blank" rel="noopener">Нээх</a>` : "—";
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-100 dark:border-slate-800";
    tr.innerHTML = `
      <td class="px-3 py-2">${r.platform}</td>
      <td class="px-3 py-2">${textShort(r.text, 120)}</td>
      <td class="px-3 py-2 text-right">${dateStr}</td>
      <td class="px-3 py-2 text-right">${r.likes.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.comments.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.shares.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.views.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${(r.likes + r.comments + r.shares + r.views).toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${link}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderStatus() {
  const el = document.getElementById("status");
  const parts = [];
  if (STATE.lastUpdated) parts.push(`Шинэчлэгдсэн: ${STATE.lastUpdated.toLocaleTimeString()}`);
  const errs = Object.entries(STATE.errors).filter(([,v]) => !!v);
  if (errs.length) parts.push("⚠️ " + errs.map(([k,v])=>`${k}: ${v}`).join(" | "));
  el.textContent = parts.join(" · ");
}

function updateUI() {
  applyFilter();
  const by = computeByPlatform(STATE.filtered);
  renderKPIs(STATE.filtered);
  renderEngagementChart(by);
  renderStackedChart(by);
  renderTopTable(STATE.filtered);
  renderPlatformPills();
  document.getElementById("range").value = STATE.range;
  document.getElementById("sortBy").value = STATE.sortBy;
  renderStatus();
}

function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme") || "dark";
  if (saved === "dark") root.classList.add("dark"); else root.classList.remove("dark");
  const btn = document.getElementById("themeToggle");
  const apply = () => {
    if (root.classList.contains("dark")) { root.classList.remove("dark"); localStorage.setItem("theme","light"); btn.classList.remove("pill-on"); btn.classList.add("pill-off"); }
    else { root.classList.add("dark"); localStorage.setItem("theme","dark"); btn.classList.remove("pill-off"); btn.classList.add("pill-on"); }
  };
  if (root.classList.contains("dark")) btn.classList.add("pill-on"); else btn.classList.add("pill-off");
  btn.addEventListener("click", apply);
}

function setLoading(on) {
  const ld = document.getElementById("loader");
  if (ld) ld.style.display = on ? "inline-block" : "none";
}

/* ===================== Refresh cycle ===================== */
let currentAbort = null;
let refreshTimer = null;

async function refreshNow() {
  try {
    setLoading(true);
    if (currentAbort) currentAbort.abort();
    const ctrl = new AbortController();
    currentAbort = ctrl;

    const [yt, tw, ig, tk, fb] = await Promise.allSettled([
      fetchYouTubeNoKey(CONFIG.youtubeChannelId, ctrl.signal),
      fetchTwitterRSS(CONFIG.twitterUser, ctrl.signal),
      fetchInstagramRSS(CONFIG.instagramUser, ctrl.signal),
      fetchTikTokRSS(CONFIG.tiktokUser, ctrl.signal),
      fetchFacebookPageRSS(CONFIG.facebookPage, ctrl.signal)
    ]);

    const val = s => (s.status === "fulfilled" ? s.value : []);
    STATE.errors = {
      youtube:  yt.status === "rejected" ? yt.reason?.message || String(yt.reason) : null,
      twitter:  tw.status === "rejected" ? tw.reason?.message || String(tw.reason) : null,
      instagram:ig.status === "rejected" ? ig.reason?.message || String(ig.reason) : null,
      tiktok:   tk.status === "rejected" ? tk.reason?.message || String(tk.reason) : null,
      facebook: fb.status === "rejected" ? fb.reason?.message || String(fb.reason) : null
    };

    STATE.all = [...val(yt), ...val(tw), ...val(ig), ...val(tk), ...val(fb)];
    STATE.lastUpdated = new Date();
    updateUI();
  } catch (e) {
    STATE.errors = { ...STATE.errors, fetch: e?.message || String(e) };
    updateUI();
  } finally {
    setLoading(false);
  }
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshNow, REFRESH_EVERY_MS);
}

/* ===================== Init ===================== */
function init() {
  initTheme();
  STATE.range = (document.getElementById("range").value);
  document.getElementById("range").addEventListener("change", (e) => { STATE.range = e.target.value; updateUI(); });
  document.getElementById("sortBy").addEventListener("change", (e) => { STATE.sortBy = e.target.value; updateUI(); });
  document.getElementById("refreshBtn").addEventListener("click", refreshNow);
  document.getElementById("interval").addEventListener("change", (e) => { REFRESH_EVERY_MS = Number(e.target.value); startAutoRefresh(); });

  updateUI();
  refreshNow();
  startAutoRefresh();
}

document.addEventListener("DOMContentLoaded", init);
