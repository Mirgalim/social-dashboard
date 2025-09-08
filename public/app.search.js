// app.js — хайлтын UI
const ALL_PLATFORMS = ["YouTube","Reddit","Facebook","Instagram","TikTok","LinkedIn","Twitter","Web"];
const STATE = {
  all: [],
  filtered: [],
  includedPlatforms: new Set(ALL_PLATFORMS),
  range: "all",
  sortBy: "date_desc",
  lastUpdated: null,
  errors: {}
};

const $ = (id) => document.getElementById(id);
const q = (sel) => document.querySelector(sel);

function parseDateFlexible(raw){
  if (!raw && raw !== 0) return null;
  if (typeof raw === "number") return new Date(raw > 1e12 ? raw : raw * 1000);
  const d = new Date(String(raw).trim());
  return isNaN(d) ? null : d;
}
function textShort(s, n=100){ s = s || ""; return s.length > n ? s.slice(0, n-1) + "…" : s; }
function fmtDate(d){ return d ? d.toISOString().slice(0,10) : "—"; }

function inDateRange(d, range){
  if (!d) return false;
  const now = new Date(), start = new Date(now);
  if (range === "d7")  { start.setDate(now.getDate()-7);  return d >= start && d <= now; }
  if (range === "d30") { start.setDate(now.getDate()-30); return d >= start && d <= now; }
  if (range === "d90") { start.setDate(now.getDate()-90); return d >= start && d <= now; }
  if (range === "y2024") return d.getFullYear() === 2024;
  return true;
}
function applyFilter(){
  STATE.filtered = STATE.all.filter(x => STATE.includedPlatforms.has(x.platform) && inDateRange(x.date, STATE.range));
}
function computeByPlatform(rows){
  const by = {};
  for (const r of rows){
    if (!by[r.platform]) by[r.platform] = { posts:0, likes:0, comments:0, shares:0, views:0 };
    const p = by[r.platform];
    p.posts++; p.likes+=r.likes; p.comments+=r.comments; p.shares+=r.shares; p.views+=r.views;
  }
  for (const k in by) by[k].engagement = by[k].likes + by[k].comments + by[k].shares + by[k].views;
  return by;
}

function renderPlatformPills(){
  const wrap = $("platformFilters"); wrap.innerHTML = "";
  for (const p of ALL_PLATFORMS){
    const on = STATE.includedPlatforms.has(p);
    const btn = document.createElement("button");
    btn.className = "px-3 py-1.5 rounded-full border text-sm " + (on ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300");
    btn.textContent = p;
    btn.onclick = () => { 
      if (STATE.includedPlatforms.has(p)) STATE.includedPlatforms.delete(p);
      else STATE.includedPlatforms.add(p);
      updateUI();
    };
    wrap.appendChild(btn);
  }
}

function renderKPIs(rows){
  const t = rows.reduce((a,r)=>{ a.posts++; a.likes+=r.likes; a.comments+=r.comments; a.shares+=r.shares; a.views+=r.views; return a; }, {posts:0,likes:0,comments:0,shares:0,views:0});
  $("kpiPosts").textContent = t.posts.toLocaleString();
  $("kpiLikes").textContent = t.likes.toLocaleString();
  $("kpiComments").textContent = t.comments.toLocaleString();
  $("kpiShares").textContent = t.shares.toLocaleString();
  $("kpiViews").textContent = t.views.toLocaleString();
}

let engagementChart=null, stackedChart=null;
function renderEngagementChart(by){
  const ctx = $("engagementChart").getContext("2d");
  const labels = Object.keys(by);
  const vals = labels.map(k => by[k].engagement);
  if (engagementChart) engagementChart.destroy();
  engagementChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Engagement", data: vals }] },
    options: { responsive: true, plugins: { legend: { display:false } }, scales: { y: { beginAtZero: true } } }
  });
}
function renderStackedChart(by){
  const ctx = $("stackedChart").getContext("2d");
  const labels = Object.keys(by);
  const likes = labels.map(k => by[k].likes);
  const comments = labels.map(k => by[k].comments);
  const shares = labels.map(k => by[k].shares);
  const views = labels.map(k => by[k].views);
  if (stackedChart) stackedChart.destroy();
  stackedChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [
      { label:"Likes", data: likes },
      { label:"Comments", data: comments },
      { label:"Shares", data: shares },
      { label:"Views", data: views }
    ]},
    options: { responsive: true, plugins: { legend: { position: "top" } }, scales: { x:{ stacked:true }, y:{ stacked:true, beginAtZero:true } } }
  });
}

function sortRows(rows, sortBy){
  const keyed = rows.map(r => ({ ...r, engagement: r.likes + r.comments + r.shares + r.views }));
  const map = {
    engagement_desc: (a,b)=>b.engagement-a.engagement,
    date_desc: (a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0),
    likes_desc: (a,b)=>b.likes-a.likes,
    comments_desc: (a,b)=>b.comments-a.comments,
    views_desc: (a,b)=>b.views-a.views
  };
  return keyed.sort(map[sortBy] || map.date_desc).slice(0, 50);
}
function renderTopTable(rows){
  const tbody = q("#topTable tbody"); tbody.innerHTML = "";
  for (const r of sortRows(rows, STATE.sortBy)){
    const tr = document.createElement("tr"); tr.className = "border-b border-slate-200";
    tr.innerHTML = `
      <td class="px-3 py-2">${r.platform}</td>
      <td class="px-3 py-2">${textShort(r.text, 140)}</td>
      <td class="px-3 py-2 text-right">${fmtDate(r.date)}</td>
      <td class="px-3 py-2 text-right">${r.likes.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.comments.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.shares.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.views.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${(r.likes+r.comments+r.shares+r.views).toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.url ? `<a class="text-blue-600 hover:underline" href="${r.url}" target="_blank" rel="noopener">Нээх</a>` : "—"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderStatus(){
  const parts = [];
  if (STATE.lastUpdated) parts.push(`Шинэчлэгдсэн: ${STATE.lastUpdated.toLocaleTimeString()}`);
  const errs = Object.entries(STATE.errors).filter(([,v])=>!!v);
  if (errs.length) parts.push("⚠️ "+errs.map(([k,v])=>`${k}: ${v}`).join(" | "));
  $("status").textContent = parts.join(" · ");
}

function updateUI(){
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

async function runSearch(){
  const qv = $("q").value.trim();
  if (!qv) { $("status").textContent = "Түлхүүр үгээ оруулна уу"; return; }
  $("status").textContent = "Loading…";
  try{
    const r = await fetch(`/api/search?q=${encodeURIComponent(qv)}`);
    const j = await r.json();
    const rows = (j.data || []).map(x => ({ ...x, date: x.date ? parseDateFlexible(x.date) : null }));
    STATE.all = rows;
    STATE.errors = j.errors || {};
    STATE.lastUpdated = new Date();
    updateUI();
  } catch (e) {
    STATE.errors = { fetch: String(e?.message || e) };
    updateUI();
  } finally {
    // noop
  }
}

function init(){
  $("searchBtn").addEventListener("click", runSearch);
  $("q").addEventListener("keydown", (e)=>{ if (e.key === "Enter") runSearch(); });
  $("range").addEventListener("change", (e)=>{ STATE.range = e.target.value; updateUI(); });
  $("sortBy").addEventListener("change", (e)=>{ STATE.sortBy = e.target.value; updateUI(); });
  updateUI();
}
document.addEventListener("DOMContentLoaded", init);
