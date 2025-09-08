import { memo } from "../utils/cache.js";
import { fetchJSON } from "../utils/fetchJSON.js";
const T = s => (s ?? "").toString();

export async function redditSearch(q, max = 20) {
  if (!q) return [];
  return memo(`rd:${q}:${max}`, 60_000, async () => {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${Math.min(max, 50)}`;
    const j = await fetchJSON(url, { headers: { "User-Agent": "social-search/1.0" } });
    return (j?.data?.children || []).map(ch => {
      const d = ch.data || {};
      return {
        platform: "Reddit",
        text: T(d.title),
        date: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
        url: d.permalink ? `https://www.reddit.com${d.permalink}` : d.url_overridden_by_dest || d.url || null,
        likes: Number(d.score || 0),
        comments: Number(d.num_comments || 0),
        shares: 0,
        views: 0
      };
    });
  });
}
