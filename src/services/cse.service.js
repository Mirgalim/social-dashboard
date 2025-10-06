import { env } from "../config/env.js";
import { memo } from "../utils/cache.js";
import { fetchJSON } from "../utils/fetchJSON.js";

const T = (s) => (s ?? "").toString();

function hostToPlatform(host) {
  const h = String(host || "").replace(/^www\./, "");
  if (h.includes("facebook.com")) return "Facebook";
  if (h.includes("instagram.com")) return "Instagram";
  if (h.includes("tiktok.com")) return "TikTok";
  if (h.includes("linkedin.com")) return "LinkedIn";
  if (h.includes("twitter.com") || h.includes("x.com")) return "Twitter";
  return "Web";
}

const SOCIAL_SITES = [
  "site:x.com",
  "site:twitter.com",
  "site:mobile.twitter.com",
  "site:facebook.com",
  "site:m.facebook.com",
  "site:mbasic.facebook.com",
  "site:instagram.com",
  "site:linkedin.com",
  "site:tiktok.com",
];

/** Ерөнхий CSE; pagination + dominant domain diversify */
export async function cseSearch(q, max = 20, options = {}) {
  const { mnOnly = false, diversify = true } = options;
  if (!q) return [];
  const KEY = env.CSE_API_KEY;
  const CX = env.CSE_CX;
  if (!KEY || !CX) throw new Error("CSE missing API key or CX");

  return memo(`cse2:${q}:${max}:${mnOnly}:${diversify}`, 60_000, async () => {
    const NEG = "-site:youtube.com -site:youtu.be -site:music.youtube.com";
    // MN bias-г хэл дээр бус, geo дээр тавина (илүү их үр дүн авчрахын тулд lr-ыг алгасав)
    const baseQ = `${q} ${NEG}`;
    const bias = mnOnly
      ? ` (${SOCIAL_SITES.join(" OR ")} OR site:.mn)`
      : ` (${SOCIAL_SITES.join(" OR ")})`;
    const q1 = `${baseQ} ${bias}`;

    async function fetchPage(qstr, start, remain) {
      const qs = new URLSearchParams({
        key: KEY,
        cx: CX,
        q: qstr,
        num: String(Math.min(10, remain)),
        start: String(start),
        safe: "active",
        gl: mnOnly ? "mn" : "",
        cr: mnOnly ? "countryMN" : "",
      });
      const j = await fetchJSON(`https://www.googleapis.com/customsearch/v1?${qs}`);
      return j.items || [];
    }

    const items = [];
    let start = 1;
    const pages = Math.max(1, Math.ceil(max / 10));
    for (let p = 0; p < pages && items.length < max; p++) {
      const page = await fetchPage(q1, start, max - items.length);
      items.push(...page);
      if (!page.length) break;
      start += 10;
    }

    // Давамгай домэйн (e.g. bank.mn) 60%+ бол -site:домэйн нэмж дахин татна
    if (diversify && items.length < max && items.length > 0) {
      const counts = {};
      for (const it of items) {
        try {
          const h = new URL(it.link).hostname.replace(/^www\./, "");
          counts[h] = (counts[h] || 0) + 1;
        } catch {}
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] / Math.max(1, items.length) >= 0.6) {
        const q2 = `${q1} -site:${top[0]}`;
        let s2 = 1;
        while (items.length < max) {
          const page = await fetchPage(q2, s2, max - items.length);
          items.push(...page);
          if (!page.length) break;
          s2 += 10;
        }
      }
    }

    // Map -> normalized rows
    const mapped = (items || []).map((it) => {
      const mt = it.pagemap?.metatags?.[0] || {};
      const dt =
        mt["article:published_time"] ||
        mt["og:updated_time"] ||
        mt["og:published_time"] ||
        null;
      const image =
        it.pagemap?.cse_image?.[0]?.src ||
        mt["og:image"] ||
        it.pagemap?.thumbnail?.[0]?.src ||
        null;

      let host = "";
      try {
        host = new URL(it.link).hostname;
      } catch {}

      return {
        platform: hostToPlatform(host),
        text: T(it.title || it.snippet),
        date: dt,
        url: it.link,
        image,
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
      };
    });

    // Dedup by URL
    const seen = new Set();
    const uniq = [];
    for (const r of mapped) {
      const k = (r.url || "").trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      uniq.push(r);
      if (uniq.length >= max) break;
    }
    return uniq;
  });
}

/** Public images — CSE image search (өнгөц цэвэрлэгээтэй) */
export async function cseImageSearch(q, max = 6, options = {}) {
  const { mnOnly = false } = options;
  if (!q) return [];
  const KEY = env.CSE_API_KEY;
  const CX = env.CSE_CX;
  if (!KEY || !CX) return [];

  return memo(`cseimg2:${q}:${max}:${mnOnly}`, 60_000, async () => {
    const noise = "-logo -favicon -svg";
    const qFinal = `${q} ${noise}`;

    const qs = new URLSearchParams({
      key: KEY,
      cx: CX,
      searchType: "image",
      q: qFinal,
      num: String(Math.min(max, 10)),
      safe: "active",
      imgSize: "large",
      imgType: "photo",
      gl: mnOnly ? "mn" : "",
    });
    const j = await fetchJSON(`https://www.googleapis.com/customsearch/v1?${qs}`);

    const BAD = /(logo|favicon)\b|\.svg($|\?)/i;
    return (j.items || [])
      .map((it) => it.link)
      .filter((u) => typeof u === "string" && u && !BAD.test(u));
  });
}
