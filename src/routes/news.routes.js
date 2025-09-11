// routes/news.routes.js
import { Router } from "express";
import { perplexityNewsSearch } from "../services/perplexity.service.js";

export const router = Router();

router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ ok: false, error: "Missing q" });

  try {
    const data = await perplexityNewsSearch(q);
    res.json({ ok: true, ...data });
  } catch (e) {
    console.error("Perplexity error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});
