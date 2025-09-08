import { ytSearch } from "../services/youtube.service.js";
import { redditSearch } from "../services/reddit.service.js";
import { cseSearch } from "../services/cse.service.js";

export async function searchController(req, res) {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ ok: false, error: "Missing q" });

  const tasks = [ ytSearch(q, 20), redditSearch(q, 20), cseSearch(q, 10) ];
  const labels = ["youtube", "reddit", "cse"];

  const settled = await Promise.allSettled(tasks);
  const data = [];
  const errors = {};
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") data.push(...(s.value || []));
    else errors[labels[i]] = String(s.reason?.message || s.reason);
  });

  res.json({ ok: true, count: data.length, data, errors });
}
