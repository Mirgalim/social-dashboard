import { ytSearch } from "../services/youtube.service.js";
import { redditSearch } from "../services/reddit.service.js";
import { cseSearch } from "../services/cse.service.js";
import { perplexityChat } from "../services/perplexity.service.js";

export async function searchController(req, res) {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ ok: false, error: "Missing q" });

  const includeNews = ["1", "true", "yes"].includes(
    String(req.query.news || "").toLowerCase().trim()
  );

  const tasks = [ytSearch(q, 20), redditSearch(q, 20), cseSearch(q, 10)];
  const labels = ["youtube", "reddit", "cse"];

  if (includeNews) {
    tasks.push(perplexityChat(q));
    labels.push("news");
  }

  const settled = await Promise.allSettled(tasks);
  const data = [];
  const errors = {};
  let news = null;

  settled.forEach((s, i) => {
    const label = labels[i];
    if (s.status === "fulfilled") {
      if (label === "news") news = s.value || null;
      else data.push(...(s.value || []));
    } else {
      errors[label] = String(s.reason?.message || s.reason);
    }
  });

  res.json({ ok: true, count: data.length, data, errors, news });
}
