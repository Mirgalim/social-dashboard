import { memo } from "../utils/cache.js";
import { fetchJSON } from "../utils/fetchJSON.js";

const T = (s) => (s ?? "").toString();

/**
 * Reddit нь зарим орчноос /search.json руу шууд GET хийхэд 403 өгч болдог.
 * 1-р оролдлого: шууд reddit.com (custom UA-тай)
 * 2-р fallback: r.jina.ai mirror-р дамжуулж JSON text татаж parse хийх (read-only)
 */
export async function redditSearch(q, max = 20) {
  if (!q) return [];
  return memo(`rd:${q}:${max}`, 60_000, async () => {
    const base = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${Math.min(max, 50)}`;

    // --- Try #1: direct Reddit JSON with UA
    try {
      const j = await fetchJSON(base, {
        headers: { "User-Agent": "social-search/1.0 (+https://example.com)" },
      });
      return normalize(j);
    } catch (_err) {
      // continue to fallback
    }

    // --- Try #2: mirror via r.jina.ai (returns text)
    try {
      const mirror = `https://r.jina.ai/http://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${Math.min(max, 50)}`;
      const r = await fetch(mirror, { headers: { "User-Agent": "social-search/1.0" } });
      if (!r.ok) throw new Error(`${mirror} -> ${r.status} ${r.statusText}`);
      const text = await r.text();
      const j = JSON.parse(text);
      return normalize(j);
    } catch (err2) {
      // Final: return empty on hard block
      return [];
    }
  });
}

function normalize(j) {
  return (j?.data?.children || []).map((ch) => {
    const d = ch.data || {};
    return {
      platform: "Reddit",
      text: T(d.title),
      date: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
      url: d.permalink ? `https://www.reddit.com${d.permalink}` : d.url_overridden_by_dest || d.url || null,
      likes: Number(d.score || 0),
      comments: Number(d.num_comments || 0),
      shares: 0,
      views: 0,
    };
  });
}
