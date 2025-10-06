import { Router } from "express";
import { perplexityChat } from "../services/perplexity.service.js";

export const router = Router();
router.post("/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const model = typeof req.body?.model === "string" && req.body.model.trim() ? req.body.model.trim() : undefined;
    const mnOnly = !!req.body?.mnOnly;
    if (!messages.length) return res.status(400).json({ ok: false, error: "Missing messages" });

    const data = await perplexityChat(messages, model, { mnOnly });
    return res.json({ ok: true, ...data });
  } catch (e) {
    console.error("Perplexity chat error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
