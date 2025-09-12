import { env } from "../config/env.js";
import { memo } from "../utils/cache.js";
import { fetchJSON } from "../utils/fetchJSON.js";
const T = (s) => (s ?? "").toString();

function hostToPlatform(host) {
  const h = host.replace(/^www\./, "");
  if (h.includes("facebook.com")) return "Facebook";
  if (h.includes("instagram.com")) return "Instagram";
  if (h.includes("tiktok.com")) return "TikTok";
  if (h.includes("linkedin.com")) return "LinkedIn";
  if (h.includes("twitter.com") || h.includes("x.com")) return "Twitter";
  return "Web";
}

export async function cseSearch(q, max = 10) {
  const KEY = env.CSE_API_KEY;
  const CX = env.CSE_CX;
  if (!KEY || !CX || !q) return [];
  return memo(`cse:${q}:${max}`, 60_000, async () => {
    const filter =
      "(site:facebook.com OR site:instagram.com OR site:tiktok.com OR site:linkedin.com OR site:twitter.com OR site:x.com)";
    const qs = new URLSearchParams({
      key: KEY,
      cx: CX,
      q: `${q} ${filter}`,
      num: String(Math.min(max, 10)),
    });
    const j = await fetchJSON(`https://www.googleapis.com/customsearch/v1?${qs}`);
    return (j.items || []).map((it) => {
      const mt = it.pagemap?.metatags?.[0] || {};
      const dt =
        mt["article:published_time"] ||
        mt["og:updated_time"] ||
        mt["og:published_time"] ||
        null;
      const u = new URL(it.link);
      return {
        platform: hostToPlatform(u.hostname),
        text: T(it.title || it.snippet),
        date: dt,
        url: it.link,
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
      };
    });
  });
}
