import { env } from "../config/env.js";
import { memo } from "../utils/cache.js";
import { fetchJSON } from "../utils/fetchJSON.js";
const T = s => (s ?? "").toString();

export async function ytSearch(q, max = 20) {
  const KEY = env.YT_API_KEY;
  if (!KEY || !q) return [];
  return memo(`yt:${q}:${max}`, 60_000, async () => {
    const qs = new URLSearchParams({
      part: "snippet",
      q, type: "video", order: "date",
      maxResults: String(Math.min(max, 50)),
      key: KEY
    });
    const s = await fetchJSON(`https://www.googleapis.com/youtube/v3/search?${qs}`);
    const ids = (s.items || []).map(it => it.id?.videoId).filter(Boolean);
    if (!ids.length) return [];
    const v = await fetchJSON(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids.join(",")}&key=${KEY}`
    );
    return (v.items || []).map(x => ({
      platform: "YouTube",
      text: T(x.snippet?.title),
      date: x.snippet?.publishedAt || null,
      url: `https://www.youtube.com/watch?v=${x.id}`,
      likes: Number(x.statistics?.likeCount || 0),
      comments: Number(x.statistics?.commentCount || 0),
      shares: 0,
      views: Number(x.statistics?.viewCount || 0)
    }));
  });
}
