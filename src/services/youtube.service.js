import { env } from "../config/env.js";
import { memo } from "../utils/cache.js";
import { fetchJSON } from "../utils/fetchJSON.js";

const T = (s) => (s ?? "").toString();

/** URLSearchParams-ийг цэвэр угсарна (undefined/null/"" → алгасна) */
function buildParams(obj = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  return p;
}

async function searchAndFetch({ q, key, mnOnly, max, extraParams = {} }) {
  const params = buildParams({
    part: "snippet",
    q,
    type: "video",
    order: mnOnly ? "relevance" : "date",
    maxResults: Math.min(max, 50),
    key,
    safeSearch: "moderate",
    ...(mnOnly ? { regionCode: "MN", relevanceLanguage: "mn" } : {}),
    ...extraParams,
  });

  const s = await fetchJSON(`https://www.googleapis.com/youtube/v3/search?${params}`);
  const ids = (s.items || []).map((it) => it.id?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const vParams = buildParams({
    part: "snippet,statistics",
    id: ids.join(","),
    key,
  });
  const v = await fetchJSON(`https://www.googleapis.com/youtube/v3/videos?${vParams}`);

  return (Array.isArray(v?.items) ? v.items : []).map((x) => ({
    platform: "YouTube",
    text: T(x?.snippet?.title),
    date: x?.snippet?.publishedAt || null,
    url: `https://www.youtube.com/watch?v=${x?.id}`,
    image: x?.snippet?.thumbnails?.medium?.url || null,
    likes: Number(x?.statistics?.likeCount ?? 0),
    comments: Number(x?.statistics?.commentCount ?? 0),
    shares: 0,
    views: Number(x?.statistics?.viewCount ?? 0),
  }));
}

/**
 * YouTube search (flood-safe):
 *  1) Shorts-гүй хайлт
 *  2) Хэт цөөн бол fallback (шүүлтгүй)
 *  3) Shorts ≤ 2, давхардал цэвэрлээд max хүртэл таслана
 */
export async function ytSearch(q, max = 20, options = {}) {
  const { mnOnly = false } = options;
  const KEY = env.YT_API_KEY;

  if (!q) return [];
  if (!KEY) {
    // Чимээгүй хоосон буцаахгүй; controller-д ил тод алдаа үлдээнэ
    throw new Error("YT_API_KEY is missing");
  }

  return memo(`yt:${q}:${max}:${mnOnly}`, 60_000, async () => {
    // Pass 1: shorts-гүй
    const q1 = `${q} -shorts -"shorts" -#shorts -"#shortvideo"`;
    let rows = await searchAndFetch({ q: q1, key: KEY, mnOnly, max });

    // Pass 2: цөөхөн бол шүүлтгүй fallback
    if (rows.length < Math.min(4, max)) {
      const extra = await searchAndFetch({ q, key: KEY, mnOnly, max });
      rows = rows.concat(extra);
    }

    // Shorts ≤ 2
    const isShort = (r) =>
      /(^|\b)shorts?\b/i.test(r.text || "") || /\/shorts\//i.test(r.url || "");

    const normal = rows.filter((r) => !isShort(r));
    const shorts = rows.filter(isShort).slice(0, 2);
    const combined = [...normal, ...shorts];

    // Dedupe by URL + cut to max
    const seen = new Set();
    const out = [];
    for (const r of combined) {
      const k = (r.url || "").toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(r);
      if (out.length >= max) break;
    }
    return out;
  });
}
