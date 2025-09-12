import { memo } from "../utils/cache.js";
import { fetchJSON } from "../utils/fetchJSON.js";

const T = (s) => (s ?? "").toString();

/**
 * 1-р оролдлого: reddit.com/search.json (custom UA)
 * 2-р fallback: r.jina.ai mirror (read-only, JSON-г текстээр буцаадаг)
 */
export async function redditSearch(q, max = 20) {
  if (!q) return [];
  return memo(`rd:${q}:${max}`, 60_000, async () => {
    const base = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${Math.min(max, 50)}`;

    // Try #1: direct
    try {
      const j = await fetchJSON(base, {
        headers: { "User-Agent": "social-search/1.0 (+https://example.com)" },
      });
      return normalize(j);
    } catch (_) {
      // continue to fallback
    }

    // Try #2: mirror (text → JSON)
    try {
      const mirror = `https://r.jina.ai/http://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${Math.min(max, 50)}`;
      const r = await fetch(mirror, { headers: { "User-Agent": "social-search/1.0" } });
      if (!r.ok) throw new Error(`${mirror} -> ${r.status} ${r.statusText}`);
      const txt = await r.text();
      const j = JSON.parse(txt);
      return normalize(j);
    } catch (err2) {
      // two attempts failed → хоосон буцаая
      return [];
    }
  });
}

function normalize(j) {
  return (j?.data?.children || []).map((ch) => {
    const d = ch.data || {};
    return {
      platform: "Reddit",
      text: T(d.title || d.selftext || ""),
      date: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
      url: d.permalink ? `https://www.reddit.com${d.permalink}` : d.url_overridden_by_dest || d.url || null,
      likes: Number(d.score || 0),
      comments: Number(d.num_comments || 0),
      shares: 0,
      views: 0,
    };
  });
}
