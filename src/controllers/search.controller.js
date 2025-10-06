import { ytSearch } from "../services/youtube.service.js";
import { redditSearch } from "../services/reddit.service.js";
import { cseSearch, cseImageSearch } from "../services/cse.service.js";
import { perplexityChat } from "../services/perplexity.service.js";

/* --------------------- Simple sentiment --------------------- */
function analyzeSentiment(text = "") {
  const t = (text || "").toLowerCase();
  const pos = ["good","great","love","win","success","өсөв","өгөөж","сайжир","эрэлт","өсөх","ашиг"];
  const neg = ["bad","hate","fail","risk","problem","буур","алдагдал","эрсдэл","сөрөг","шүүмж"];
  let s = 0; pos.forEach(w=>t.includes(w)&&s++); neg.forEach(w=>t.includes(w)&&s--);
  return s>0?"positive":s<0?"negative":"neutral";
}

/* --------------------- Balancing helpers --------------------- */
const byPlatform = (rows=[]) => rows.reduce((m,r)=>((m[r.platform]??=[]).push(r),m),{});

const interleaveRoundRobin = (groups) => {
  const keys = Object.keys(groups);
  const idx = Object.fromEntries(keys.map(k=>[k,0]));
  const total = keys.reduce((a,k)=>a+groups[k].length,0);
  const out=[];
  while(out.length<total){
    for(const k of keys){
      const g=groups[k], i=idx[k];
      if(i<g.length){ out.push(g[i]); idx[k]++; }
    }
  }
  return out;
};

const rebalancePlatforms = (rows, { total=40, maxShare=0.30, minKeep=2 }={})=>{
  const TOTAL = Math.min(rows.length, total);
  const perCap = Math.max(minKeep, Math.floor(TOTAL * maxShare));
  const grouped = byPlatform(rows);
  for (const k of Object.keys(grouped)) {
    grouped[k].sort((a,b)=>{
      const ea=a.likes+a.comments+a.shares+a.views;
      const eb=b.likes+b.comments+b.shares+b.views;
      const ta=a.date?new Date(a.date).getTime():0;
      const tb=b.date?new Date(b.date).getTime():0;
      return (eb-ea) || (tb-ta);
    });
    if (grouped[k].length > perCap) grouped[k] = grouped[k].slice(0, perCap);
  }
  return interleaveRoundRobin(grouped).slice(0, TOTAL);
};

const capPlatform = (rows, platform, cap) => {
  const out=[]; let c=0;
  for (const r of rows) {
    if (r.platform === platform) {
      if (c < cap) { out.push(r); c++; }
    } else out.push(r);
  }
  return out;
};

const dedupeByUrl = (rows=[]) => {
  const seen = new Set();
  return rows.filter(r=>{
    const k = (r.url || "").trim().toLowerCase();
    if (!k || seen.has(k)) return false; seen.add(k); return true;
  });
};

/* --------------------- Images diversify --------------------- */
const normalizeImageKey = (u)=>{
  try{
    const url=new URL(u);
    const base=(url.pathname.split("/").pop()||"").toLowerCase()
      .replace(/\.(jpg|jpeg|png|webp|gif).*/i,".$1")
      .replace(/[-_](\d{3,4}x\d{3,4}|\d{3,4})\b/g,"");
    return `${url.hostname.replace(/^www\./,"")}/${base}`;
  }catch{return u;}
};
const diversifyImages=(urls=[],limit=12)=>{
  const out=[], seen=new Set(), perDom={};
  for (const u of urls) {
    if (!u) continue;
    if (/(logo|favicon)\b|\.svg($|\?)/i.test(u)) continue;
    let host="misc"; try{ host=new URL(u).hostname.replace(/^www\./,""); }catch{}
    if ((perDom[host]||0) >= 2) continue;
    const key = normalizeImageKey(u); if (seen.has(key)) continue;
    seen.add(key); perDom[host]=(perDom[host]||0)+1; out.push(u);
    if (out.length>=limit) break;
  }
  return out;
};

/* --------------------- MN intent detector --------------------- */
function looksMongolian(q="") {
  const cyr = /[А-Яа-яЁёӨөҮү]/;
  const kw  = /(mongol|mongolia|ulaanbaatar|ulan\s?bator|ub\b|mgl)/i;
  return cyr.test(q) || kw.test(q);
}

/* --------------------- Controller --------------------- */
export async function searchController(req, res) {
  const qRaw=(req.query.q||"").toString().trim();
  if (!qRaw) return res.status(400).json({ ok:false, error:"Missing q" });

  const mnRequested = ["1","true","yes"].includes(String(req.query.mn||"").toLowerCase().trim());
  const mnOnly = mnRequested && looksMongolian(qRaw);

  const needsMCS = /\bmcs\b/i.test(qRaw);
  const q = needsMCS ? `${qRaw} Монголын MCS Групп (MCS Group Mongolia)` : qRaw;

  const noYT = ["1","true","yes"].includes(String(req.query.noYT||"").toLowerCase());

  /* Phase 1: primary fetch */
  const primaryTasks = [
    !noYT ? ytSearch(q, 10, { mnOnly }) : Promise.resolve([]),
    redditSearch(q, mnOnly ? 12 : 24, { mnOnly }),
    cseSearch(q, 60, { mnOnly, diversify: true }),
    cseImageSearch(q, 12, { mnOnly }),
    perplexityChat(qRaw, undefined, {
      mnOnly,
      forceMongolianEntity: needsMCS ? "MCS Групп (MCS Group Mongolia)" : ""
    })
  ];
  const labels = ["youtube","reddit","cse","images","news"];

  const settled1 = await Promise.allSettled(primaryTasks);
  let rows = [];
  const errors = {};
  let news = null;
  let images = [];

  settled1.forEach((s,i)=>{
    const label=labels[i];
    if(s.status==="fulfilled"){
      if(label==="news") news = s.value || null;
      else if(label==="images") images = s.value || [];
      else rows.push(...(s.value || []));
    } else {
      errors[label] = String(s.reason?.message || s.reason);
    }
  });

  rows = dedupeByUrl(rows);

  /* Phase 2: backfill if too few */
  if (rows.length < 20) {
    const backfill = [
      redditSearch(q, 24, { mnOnly:false }),
      cseSearch(q, 40, { mnOnly:false, diversify: true })
    ];
    if (!noYT) backfill.push(ytSearch(q, 8, { mnOnly:false }));

    const s2 = await Promise.allSettled(backfill);
    s2.forEach(s=>{ if(s.status==="fulfilled") rows.push(...(s.value||[])); });
    rows = dedupeByUrl(rows);
  }

  // Shorts-ыг бүр устгахгүй: YouTube shorts ≤2-г л үлдээнэ (2nd safety)
  const isYTShort = (r) =>
    r.platform === "YouTube" &&
    (/(^|\b)shorts?\b/i.test(r.text || "") || /\/shorts\//i.test(r.url || ""));
  const ytShorts = rows.filter(isYTShort).slice(0, 2);
  rows = rows.filter(r => !isYTShort(r)).concat(ytShorts);

  // Sentiment
  rows.forEach(r => r.sentiment = analyzeSentiment(r.text || ""));

  // Хатуу cap: YouTube ≤ 6 мөр
  rows = capPlatform(rows, "YouTube", noYT ? 0 : 6);

  // Ерөнхий баланс: нэг платформ ≤30%, нийт 40 мөр
  let balanced = rebalancePlatforms(rows, { total: 40, maxShare: 0.30, minKeep: 2 });

  // Доод квот – боломжтой бол Web/Reddit/FB/IG тус бүр ≥2
  const needMin=["Web","Reddit","Facebook","Instagram"];
  const count=balanced.reduce((m,r)=>((m[r.platform]=(m[r.platform]||0)+1),m),{});
  const add=[];
  for(const p of needMin){
    const have=count[p]||0;
    if(have<2){
      const extra = rows.filter(r=>r.platform===p && !balanced.includes(r)).slice(0, 2-have);
      add.push(...extra);
    }
  }
  if (add.length) {
    balanced = rebalancePlatforms([...balanced, ...add], { total: 40, maxShare: 0.30, minKeep: 2 });
  }

  // Images – төрөлжүүлж цэвэрлэх
  const imgFromItems = balanced.map(r=>r.image).filter(Boolean);
  const diversifiedImages = diversifyImages(Array.from(new Set([...(images||[]), ...imgFromItems])), 12);

  return res.json({
    ok: true,
    count: balanced.length,
    data: balanced,
    errors,
    news,
    images: diversifiedImages,
    mnOnly,
    mnRequested
  });
}
