import { memo } from "../utils/cache.js";
import { fetchJSON } from "../utils/fetchJSON.js";

const T = (s) => (s ?? "").toString();

/**
 * Reddit 403 mitigation:
 * 1) direct reddit.com/search.json (custom UA)
 * 2) r.jina.ai mirror (www)
 * 3) r.jina.ai mirror (old.reddit)
 * 4) r.jina.ai mirror (api.reddit)
 */
export async function redditSearch(q, max = 20) {
  if (!q) return [];
  return memo(`rd:${q}:${max}`, 60_000, async () => {
    const limit = Math.min(max, 50);
    const base = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${limit}`;

    // Try #1: direct
    try {
      const j = await fetchJSON(base, {
        headers: { "User-Agent": "social-search/1.0 (+https://example.com)" }
      });
      return normalize(j);
    } catch (_) { /* continue */ }

    // helper
    const tryMirror = async (u) => {
      const r = await fetch(u, {
        headers: {
          "User-Agent": "social-search/1.0",
          "Accept": "application/json,text/plain"
        }
      });
      if (!r.ok) throw new Error(`${u} -> ${r.status} ${r.statusText}`);
      const txt = await r.text();
      return JSON.parse(txt);
    };

    // Try #2: www mirror
    try {
      const j = await tryMirror(`https://r.jina.ai/http://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${limit}`);
      return normalize(j);
    } catch (_) { /* continue */ }

    // Try #3: old.reddit
    try {
      const j = await tryMirror(`https://r.jina.ai/http://old.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${limit}`);
      return normalize(j);
    } catch (_) { /* continue */ }

    // Try #4: api.reddit
    try {
      const j = await tryMirror(`https://r.jina.ai/http://api.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${limit}`);
      return normalize(j);
    } catch (_) {
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
      views: 0
    };
  });
}
