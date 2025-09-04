
// ========= Helpers =========
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

// ========= Normalization per platform =========
function normalizeAll() {
  const out = [];
  for (const it of (DATA.instagram || [])) {
    out.push({
      platform: "Instagram",
      text: it.caption || "",
      date: parseDateFlexible(it.timestamp),
      url: it.inputUrl || null,
      likes: Number(it.likesCount || 0),
      comments: Number(it.commentsCount || 0),
      shares: 0,
      views: Number(it.videoViewCount || it.videoPlayCount || 0),
    });
  }
  for (const it of (DATA.youtube || [])) {
    const url = it.id ? `https://www.youtube.com/watch?v=${it.id}` : null;
    out.push({
      platform: "YouTube",
      text: it.title || it.description || "",
      date: parseDateFlexible(it.date),
      url,
      likes: Number(it.likeCount || 0),
      comments: Number(it.commentCount || 0),
      shares: 0,
      views: Number(it.viewCount || 0),
    });
  }
  for (const it of (DATA.facebook || [])) {
    out.push({
      platform: "Facebook",
      text: it.text || (it.message || ""),
      date: parseDateFlexible(it.date),
      url: it.url || null,
      likes: Number(it.likeCount || it.reactionCount || 0),
      comments: Number(it.commentCount || 0),
      shares: Number(it.shareCount || 0),
      views: Number(it.viewCount || 0),
    });
  }
  for (const it of (DATA.tiktok || [])) {
    const dateCandidate = it.createTimeISO || it.createTime;
    out.push({
      platform: "TikTok",
      text: it.text || "",
      date: parseDateFlexible(dateCandidate),
      url: it.webVideoUrl || null,
      likes: Number(it.diggCount || 0),
      comments: Number(it.commentCount || 0),
      shares: Number(it.shareCount || 0),
      views: Number(it.playCount || 0),
    });
  }
  for (const it of (DATA.twitter || [])) {
    out.push({
      platform: "Twitter",
      text: it.full_text || it.text || "",
      date: parseDateFlexible(it.created_at),
      url: it.url || null,
      likes: Number(it.favorite_count || it.likeCount || 0),
      comments: Number(it.reply_count || 0),
      shares: Number(it.retweet_count || 0),
      views: Number(it.view_count || 0),
    });
  }
  return out;
}

// ========= State =========
const ALL_PLATFORMS = ["Instagram", "YouTube", "Facebook", "TikTok", "Twitter"];
const STATE = {
  all: [],
  filtered: [],
  includedPlatforms: new Set(ALL_PLATFORMS),
  range: "all",
  sortBy: "engagement_desc"
};

function inDateRange(d, range) {
  if (!d) return false;
  const now = new Date();
  const start = new Date(now);
  if (range === "d7") { start.setDate(now.getDate() - 7); return d >= start && d <= now; }
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
  for (const k in by) {
    by[k].engagement = by[k].likes + by[k].comments + by[k].shares + by[k].views;
  }
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

// ========= KPIs =========
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

// ========= Charts =========
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
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
      scales: { x: { ticks: { autoSkip: false } }, y: { beginAtZero: true } }
    }
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
    data: {
      labels,
      datasets: [
        { label: "Likes", data: likes },
        { label: "Comments", data: comments },
        { label: "Shares", data: shares },
        { label: "Views", data: views }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
    }
  });
}

// ========= Table =========
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
    const dateStr = r.date ? r.date.toISOString().slice(0,10) : "—";
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
      <td class="px-3 py-2 text-right">${(r.engagement).toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${link}</td>
    `;
    tbody.appendChild(tr);
  }
}

// ========= UI & Events =========
function updateUI() {
  applyFilter();
  const by = computeByPlatform(STATE.filtered);
  renderKPIs(STATE.filtered);
  renderEngagementChart(by);
  renderStackedChart(by);
  renderTopTable(STATE.filtered);
  renderPlatformPills(); // refresh pill styles
  // sync selects
  document.getElementById("range").value = STATE.range;
  document.getElementById("sortBy").value = STATE.sortBy;
}

function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme") || "dark";
  if (saved === "dark") root.classList.add("dark"); else root.classList.remove("dark");
  const btn = document.getElementById("themeToggle");
  const apply = () => {
    if (root.classList.contains("dark")) {
      root.classList.remove("dark"); localStorage.setItem("theme","light");
      btn.classList.remove("pill-on"); btn.classList.add("pill-off");
    } else {
      root.classList.add("dark"); localStorage.setItem("theme","dark");
      btn.classList.remove("pill-off"); btn.classList.add("pill-on");
    }
  };
  // initial style
  if (root.classList.contains("dark")) { btn.classList.add("pill-on"); } else { btn.classList.add("pill-off"); }
  btn.addEventListener("click", apply);
}

function init() {
  initTheme();
  STATE.all = normalizeAll();
  STATE.range = (document.getElementById("range").value);
  document.getElementById("range").addEventListener("change", (e) => { STATE.range = e.target.value; updateUI(); });
  document.getElementById("sortBy").addEventListener("change", (e) => { STATE.sortBy = e.target.value; updateUI(); });
  updateUI();
}

document.addEventListener("DOMContentLoaded", init);
