// app.js
const ALL_PLATFORMS = ["Instagram","YouTube","Facebook","TikTok","Twitter"];
const STATE = {
  all: [],
  filtered: [],
  includedPlatforms: new Set(ALL_PLATFORMS),
  sortBy: "engagement_desc",
  lastUpdated: null,
  errors: {}
};

function parseDateFlexible(s){ if(!s) return null; const d=new Date(s); return isNaN(d)?null:d; }
function textShort(s,n=100){ s=s||""; return s.length>n? s.slice(0,n-1)+"…":s; }
function fmtDate(d){ return d? d.toISOString().slice(0,10):"—"; }

function setLoading(on){ const ld=document.getElementById("loader"); if(ld) ld.style.display=on?"inline-block":"none"; }

function inDateRange(d, range){
  if(!d) return false;
  // optional: add date range select here if needed
  return true;
}
function applyFilter(){
  STATE.filtered = STATE.all.filter(x => STATE.includedPlatforms.has(x.platform) && inDateRange(x.date,"all"));
}
function computeByPlatform(rows){
  const by={};
  for(const r of rows){
    const k=r.platform;
    if(!by[k]) by[k]={posts:0,likes:0,comments:0,shares:0,views:0};
    const p=by[k];
    p.posts+=1; p.likes+=r.likes; p.comments+=r.comments; p.shares+=r.shares; p.views+=r.views;
  }
  for(const k in by) by[k].engagement = by[k].likes + by[k].comments + by[k].shares + by[k].views;
  return by;
}
function renderKPIs(rows){
  const t=rows.reduce((a,r)=>{a.posts++;a.likes+=r.likes;a.comments+=r.comments;a.shares+=r.shares;a.views+=r.views;return a;},{posts:0,likes:0,comments:0,shares:0,views:0});
  k("kpiPosts").textContent=t.posts.toLocaleString();
  k("kpiLikes").textContent=t.likes.toLocaleString();
  k("kpiComments").textContent=t.comments.toLocaleString();
  k("kpiShares").textContent=t.shares.toLocaleString();
  k("kpiViews").textContent=t.views.toLocaleString();
}
let engagementChart=null, stackedChart=null;
function renderEngagementChart(by){
  const ctx=g("engagementChart").getContext("2d");
  const labels=Object.keys(by); const values=labels.map(k=>by[k].engagement);
  if(engagementChart) engagementChart.destroy();
  engagementChart=new Chart(ctx,{type:"bar",data:{labels,datasets:[{label:"Engagement",data:values}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
}
function renderStackedChart(by){
  const ctx=g("stackedChart").getContext("2d");
  const labels=Object.keys(by);
  const likes=labels.map(k=>by[k].likes);
  const comments=labels.map(k=>by[k].comments);
  const shares=labels.map(k=>by[k].shares);
  const views=labels.map(k=>by[k].views);
  if(stackedChart) stackedChart.destroy();
  stackedChart=new Chart(ctx,{type:"bar",data:{labels,datasets:[
    {label:"Likes",data:likes},{label:"Comments",data:comments},{label:"Shares",data:shares},{label:"Views",data:views}
  ]},options:{responsive:true,plugins:{legend:{position:"top"}},scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}}}});
}
function sortRows(rows, sortBy){
  const keyed = rows.map(r=>({...r, engagement:r.likes+r.comments+r.shares+r.views}));
  const map={
    engagement_desc:(a,b)=>b.engagement-a.engagement,
    date_desc:(a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0),
    likes_desc:(a,b)=>b.likes-a.likes,
    comments_desc:(a,b)=>b.comments-a.comments,
    views_desc:(a,b)=>b.views-a.views
  };
  return keyed.sort(map[sortBy]||map.engagement_desc).slice(0,30);
}
function renderTopTable(rows){
  const tbody=q("#topTable tbody"); tbody.innerHTML="";
  for(const r of sortRows(rows, STATE.sortBy)){
    const tr=document.createElement("tr"); tr.className="border-b border-slate-100 dark:border-slate-800";
    tr.innerHTML=`
      <td class="px-3 py-2">${r.platform}</td>
      <td class="px-3 py-2">${textShort(r.text,120)}</td>
      <td class="px-3 py-2 text-right">${fmtDate(r.date)}</td>
      <td class="px-3 py-2 text-right">${r.likes.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.comments.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.shares.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.views.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${(r.likes+r.comments+r.shares+r.views).toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.url?`<a class="text-blue-600 hover:underline" href="${r.url}" target="_blank">Нээх</a>`:"—"}</td>
    `;
    tbody.appendChild(tr);
  }
}
function renderPlatformPills(){
  const wrap=k("platformFilters"); wrap.innerHTML="";
  for(const p of ALL_PLATFORMS){
    const on=STATE.includedPlatforms.has(p);
    const btn=document.createElement("button");
    btn.className="pill "+(on?"pill-on":"pill-off"); btn.textContent=p;
    btn.onclick=()=>{ if(on) STATE.includedPlatforms.delete(p); else STATE.includedPlatforms.add(p); updateUI(); };
    wrap.appendChild(btn);
  }
}
function renderStatus(){
  const el=k("status");
  const parts=[];
  if(STATE.lastUpdated) parts.push(`Шинэчлэгдсэн: ${STATE.lastUpdated.toLocaleTimeString()}`);
  const errs=Object.entries(STATE.errors).filter(([,v])=>!!v);
  if(errs.length) parts.push("⚠️ "+errs.map(([k,v])=>`${k}: ${v}`).join(" | "));
  el.textContent=parts.join(" · ");
}
function updateUI(){
  applyFilter();
  const by=computeByPlatform(STATE.filtered);
  renderKPIs(STATE.filtered);
  renderEngagementChart(by);
  renderStackedChart(by);
  renderTopTable(STATE.filtered);
  renderPlatformPills();
  renderStatus();
}

async function refreshNow(){
  setLoading(true);
  try{
    const yt = v("yt"), tw=v("tw"), ig=v("ig"), tk=v("tk"), fb=v("fb");
    const params = new URLSearchParams();
    if(yt) params.set("yt", yt);
    if(tw) params.set("tw", tw);
    if(ig) params.set("ig", ig);
    if(tk) params.set("tk", tk);
    if(fb) params.set("fb", fb);
    const r = await fetch(`/api/social?${params.toString()}`);
    const j = await r.json();
    const rows = (j.data||[]).map(x => ({ ...x, date: parseDateFlexible(x.date)}));
    STATE.all = rows;
    STATE.errors = j.errors || {};
    STATE.lastUpdated = new Date();
    updateUI();
  }catch(e){
    STATE.errors = { fetch: String(e?.message||e) };
    updateUI();
  }finally{
    setLoading(false);
  }
}

// ---- small DOM helpers ----
const k = id => document.getElementById(id);
const q = sel => document.querySelector(sel);
const g = id => document.getElementById(id);
const v = id => document.getElementById(id).value.trim();

function initTheme(){
  const root=document.documentElement; const btn=k("themeToggle");
  const saved=localStorage.getItem("theme")||"dark";
  if(saved==="dark") root.classList.add("dark"); else root.classList.remove("dark");
  const apply=()=>{
    if(root.classList.contains("dark")){ root.classList.remove("dark"); localStorage.setItem("theme","light"); btn.classList.remove("pill-on"); btn.classList.add("pill-off"); }
    else { root.classList.add("dark"); localStorage.setItem("theme","dark"); btn.classList.remove("pill-off"); btn.classList.add("pill-on"); }
  };
  if(root.classList.contains("dark")) btn.classList.add("pill-on"); else btn.classList.add("pill-off");
  btn.addEventListener("click", apply);
}

function init(){
  initTheme();
  k("refreshBtn").addEventListener("click", refreshNow);
  refreshNow();
}
document.addEventListener("DOMContentLoaded", init);
