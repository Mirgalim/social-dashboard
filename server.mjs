// server.mjs — unified proxy API (no cors, no node-fetch)
import express from "express";
import { XMLParser } from "fast-xml-parser";

// ----- Config -----
const app = express();
const PORT = process.env.PORT || 5173;
app.use(express.static(".")); // index.html, app.js зэргийг энэ хавтсаас

const PIPED_BASE  = process.env.PIPED_BASE  || "https://piped.video";
const LEMNOS_BASE = process.env.LEMNOS_BASE || "https://yt.lemnoslife.com";
const RSSHUB_BASE = process.env.RSSHUB_BASE || "https://rsshub.app";

// ----- Helpers -----
async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${url} -> ${r.status} ${r.statusText}`);
  return r.json();
}
async function fetchText(url, opts = {}) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${url} -> ${r.status} ${r.statusText}`);
  return r.text();
}

// ----- YouTube (Piped → Lemnos fallback) -----
async function ytViaPiped(channelId) {
  const url = `${PIPED_BASE}/api/v1/channel/${encodeURIComponent(channelId)}/videos`;
  const arr = await fetchJSON(url);
  return (arr || []).slice(0, 20).map(v => ({
    platform: "YouTube",
    text: v.title || "",
    date: v.uploaded || v.uploadedDate || v.uploadedTime || v.uploadedText || null,
    url: v.url ? `https://www.youtube.com${v.url}` : null,
    likes: 0,
    comments: 0,
    shares: 0,
    views: Number(v.views || 0),
  }));
}
async function ytViaLemnos(channelId) {
  const ch = await fetchJSON(`${LEMNOS_BASE}/noKey/channels?part=contentDetails&id=${channelId}`);
  const uploads = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];
  const pl = await fetchJSON(`${LEMNOS_BASE}/noKey/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=20`);
  const ids = (pl?.items || []).map(it => it?.contentDetails?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const vids = await fetchJSON(`${LEMNOS_BASE}/noKey/videos?part=snippet,statistics&id=${ids.join(",")}`);
  return (vids?.items || []).map(v => ({
    platform: "YouTube",
    text: v?.snippet?.title || "",
    date: v?.snippet?.publishedAt || null,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    likes: Number(v?.statistics?.likeCount || 0),
    comments: Number(v?.statistics?.commentCount || 0),
    shares: 0,
    views: Number(v?.statistics?.viewCount || 0),
  }));
}
async function fetchYouTube(channelId) {
  try { return await ytViaPiped(channelId); }
  catch (e1) {
    try { return await ytViaLemnos(channelId); }
    catch (e2) { throw new Error(`YouTube failed: ${e1.message} | ${e2.message}`); }
  }
}

// ----- RSS (Twitter/IG/TikTok/FB) -----
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

function rssItemsFromXML(xmlText) {
  const doc = xmlParser.parse(xmlText);
  const items = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  return Array.isArray(items) ? items : [items];
}

async function rssToNormalized(rssUrl, platform) {
  const xml = await fetchText(rssUrl);
  const items = rssItemsFromXML(xml);
  return items.map(it => {
    const title = it.title?.["#text"] || it.title || "";
    const link =
      typeof it.link === "string" ? it.link :
      (Array.isArray(it.link) ? (it.link.find(l => l.href)?.href || it.link[0]?.href || "") :
      (it.link?.href || ""));
    const pub = it.pubDate || it.published || it.updated || null;
    return { platform, text: title, date: pub, url: link, likes: 0, comments: 0, shares: 0, views: 0 };
  });
}

const fetchTwitter   = user => rssToNormalized(`${RSSHUB_BASE}/twitter/user/${encodeURIComponent(user)}`, "Twitter");
const fetchInstagram = user => rssToNormalized(`${RSSHUB_BASE}/instagram/user/${encodeURIComponent(user)}`, "Instagram");
const fetchTikTok    = user => rssToNormalized(`${RSSHUB_BASE}/tiktok/user/${encodeURIComponent(user)}`, "TikTok");
const fetchFacebook  = page => rssToNormalized(`${RSSHUB_BASE}/facebook/page/${encodeURIComponent(page)}`, "Facebook");

// ----- Unified API -----
/**
 * GET /api/social?yt=<UCID>&tw=<user>&ig=<user>&tk=<user>&fb=<page>
 */
app.get("/api/social", async (req, res) => {
  const { yt, tw, ig, tk, fb } = req.query;

  const jobs = {};
  if (yt) jobs.youtube  = fetchYouTube(yt);
  if (tw) jobs.twitter  = fetchTwitter(tw);
  if (ig) jobs.instagram= fetchInstagram(ig);
  if (tk) jobs.tiktok   = fetchTikTok(tk);
  if (fb) jobs.facebook = fetchFacebook(fb);

  const keys = Object.keys(jobs);
  try {
    const settled = await Promise.allSettled(keys.map(k => jobs[k]));
    const data = [];
    const errors = {};
    settled.forEach((s, i) => {
      const name = keys[i];
      if (s.status === "fulfilled") data.push(...(s.value || []));
      else errors[name] = String(s.reason?.message || s.reason);
    });
    res.json({ ok: true, count: data.length, data, errors });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// small health check
app.get("/healthz", (_req, res) => res.send("ok"));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Sample: /api/social?yt=UC_x5XG1OV2P6uZZ5FSM9TQ&tw=elonmusk&ig=instagram&tk=scout2015&fb=Meta`);
});
