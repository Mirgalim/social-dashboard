
// ========= Helpers =========
function parseDateFlexible(raw) {
  if (!raw && raw !== 0) return null;
  if (typeof raw === "number") {
    // epoch seconds?
    if (raw > 1e12) return new Date(raw); // ms
    return new Date(raw * 1000);
  }
  // Strings
  const s = String(raw).trim();
  // Try ISO
  const d = new Date(s);
  if (!isNaN(d)) return d;
  // Heuristics for strings like "Streamed 2 weeks ago" -> treat as null (unknown)
  return null;
}

function textShort(s, n=80) {
  s = s || "";
  return s.length > n ? s.slice(0,n-1) + "…" : s;
}

function sum(arr) { return arr.reduce((a,b)=>a+b,0); }

// ========= Normalization per platform =========
function normalizeAll() {
  const out = [];

  // Instagram
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

  // YouTube
  for (const it of (DATA.youtube || [])) {
    // try craft URL from id
    const url = it.id ? `https://www.youtube.com/watch?v=${it.id}` : null;
    out.push({
      platform: "YouTube",
      text: it.title || it.description || "",
      date: parseDateFlexible(it.date), // may be null if relative text
      url,
      likes: Number(it.likeCount || 0),
      comments: Number(it.commentCount || 0),
      shares: 0,
      views: Number(it.viewCount || 0),
    });
  }

  // Facebook
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

  // TikTok
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

  // Twitter / X
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

// ========= State & UI =========
const STATE = {
  all: [],
  filtered: [],
  range: "all", // all | d7 | d30 | d90 | y2024
};

function applyFilter() {
  const now = new Date();
  const start = new Date(now);
  let predicate = () => true;

  switch (STATE.range) {
    case "d7":
      start.setDate(now.getDate() - 7);
      predicate = (d) => d && d >= start && d <= now;
      break;
    case "d30":
      start.setDate(now.getDate() - 30);
      predicate = (d) => d && d >= start && d <= now;
      break;
    case "d90":
      start.setDate(now.getDate() - 90);
      predicate = (d) => d && d >= start && d <= now;
      break;
    case "y2024":
      predicate = (d) => d && d.getFullYear() === 2024;
      break;
    default:
      predicate = () => true;
  }

  STATE.filtered = STATE.all.filter(x => predicate(x.date));
}

function computeSummaries(rows) {
  const byPlatform = {};
  for (const r of rows) {
    const key = r.platform;
    if (!byPlatform[key]) {
      byPlatform[key] = { posts: 0, likes:0, comments:0, shares:0, views:0 };
    }
    const p = byPlatform[key];
    p.posts += 1;
    p.likes += r.likes;
    p.comments += r.comments;
    p.shares += r.shares;
    p.views += r.views;
  }
  // derive engagement
  for (const k in byPlatform) {
    byPlatform[k].engagement = byPlatform[k].likes + byPlatform[k].comments + byPlatform[k].shares + byPlatform[k].views;
  }
  return byPlatform;
}

function renderCards(byPlatform) {
  const container = document.getElementById("cards");
  container.innerHTML = "";
  const platforms = Object.keys(byPlatform);
  if (platforms.length === 0) {
    container.innerHTML = `<div class="text-gray-500">No data for selected range.</div>`;
    return;
  }
  for (const k of platforms) {
    const v = byPlatform[k];
    const html = `
      <div class="p-4 bg-white/70 dark:bg-slate-800 rounded-2xl shadow">
        <div class="text-sm text-gray-500">${k}</div>
        <div class="mt-1 text-2xl font-semibold">${v.posts.toLocaleString()} пост</div>
        <div class="mt-2 text-xs text-gray-500">Engagement: ${v.engagement.toLocaleString()}</div>
        <div class="mt-1 text-xs text-gray-500">👍 ${v.likes.toLocaleString()} · 💬 ${v.comments.toLocaleString()} · 🔁 ${v.shares.toLocaleString()} · ▶️ ${v.views.toLocaleString()}</div>
      </div>`;
    const el = document.createElement("div");
    el.className = "min-w-[220px]";
    el.innerHTML = html;
    container.appendChild(el);
  }
}

let engagementChart = null;
function renderChart(byPlatform) {
  const ctx = document.getElementById("engagementChart").getContext("2d");
  const labels = Object.keys(byPlatform);
  const values = labels.map(k => byPlatform[k].engagement);

  if (engagementChart) {
    engagementChart.destroy();
  }
  engagementChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Total Engagement",
        data: values
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: { ticks: { autoSkip: false } },
        y: { beginAtZero: true }
      }
    }
  });
}

function renderTopTable(rows) {
  const tbody = document.querySelector("#topTable tbody");
  tbody.innerHTML = "";
  // compute engagement per row
  const ranked = rows.map(r => ({
    ...r,
    engagement: r.likes + r.comments + r.shares + r.views
  })).sort((a,b)=>b.engagement - a.engagement).slice(0, 15);

  for (const r of ranked) {
    const dateStr = r.date ? r.date.toISOString().slice(0,10) : "—";
    const link = r.url ? `<a class="text-blue-600 hover:underline" href="${r.url}" target="_blank" rel="noopener">Open</a>` : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="px-3 py-2">${r.platform}</td>
      <td class="px-3 py-2">${textShort(r.text, 100)}</td>
      <td class="px-3 py-2 text-right">${dateStr}</td>
      <td class="px-3 py-2 text-right">${r.engagement.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${link}</td>
    `;
    tbody.appendChild(tr);
  }
}

function updateUI() {
  applyFilter();
  const byPlatform = computeSummaries(STATE.filtered);
  renderCards(byPlatform);
  renderChart(byPlatform);
  renderTopTable(STATE.filtered);
}

function init() {
  STATE.all = normalizeAll();
  STATE.range = (document.getElementById("range").value);
  document.getElementById("range").addEventListener("change", (e) => {
    STATE.range = e.target.value;
    updateUI();
  });
  updateUI();
}

document.addEventListener("DOMContentLoaded", init);
