import { memo } from "../utils/cache.js";
import { fetchJSON } from "../utils/fetchJSON.js";

const T = (s) => (s ?? "").toString();

/** options.mnOnly=true үед r/mongolia, r/ulaanbaatar гэх мэт subreddits */
export async function redditSearch(q, max = 20, options = {}) {
  const { mnOnly = false } = options;
  if (!q) return [];
  return memo(`rd:${q}:${max}:${mnOnly}`, 60_000, async () => {
    const limit = Math.min(max, 50);
    const subreddits = ["mongolia", "ulaanbaatar", "askmongolia"];
    const baseUrl = mnOnly
      ? `https://www.reddit.com/r/${subreddits.join("+")}/search.json?q=${encodeURIComponent(q)}&sort=new&restrict_sr=on&limit=${limit}`
      : `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${limit}`;

    try {
      const j = await fetchJSON(baseUrl, { headers: { "User-Agent": "social-search/1.0 (+https://example.com)" } });
      return normalize(j);
    } catch (_) {
      try {
        const u = `https://r.jina.ai/http://${baseUrl.replace(/^https?:\/\//, "")}`;
        const r = await fetch(u, { headers: { "User-Agent": "social-search/1.0", "Accept": "application/json,text/plain" }});
        if (!r.ok) throw new Error(`${u} -> ${r.status}`);
        const txt = await r.text();
        return normalize(JSON.parse(txt));
      } catch {
        return [];
      }
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
      image: d.thumbnail && d.thumbnail.startsWith("http") ? d.thumbnail : null,
      likes: Number(d.score || 0),
      comments: Number(d.num_comments || 0),
      shares: 0,
      views: 0
    };
  });
}
