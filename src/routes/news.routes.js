import { Router } from "express";
import { perplexityChat } from "../services/perplexity.service.js";
export const router = Router();

router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  const mnOnly = ["1","true","yes"].includes(String(req.query.mn || "").toLowerCase());
  if (!q) return res.status(400).json({ ok: false, error: "Missing q" });
  try {
    const data = await perplexityChat(q, undefined, { mnOnly });
    res.json({ ok: true, ...data });
  } catch (e) {
    console.error("Perplexity error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});
