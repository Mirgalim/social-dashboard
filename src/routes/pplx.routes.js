// routes/pplx.routes.js
import { Router } from "express";
import { perplexityChat } from "../services/perplexity.service.js";

export const router = Router();

// POST /api/pplx/chat  { messages: [{role:'user'|'assistant'|'system', content:string}], model?:string }
router.post("/chat", async (req, res) => {
  try {
    // JSON body авах
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const model = typeof body.model === "string" ? body.model : "sonar-small-chat";
    if (!messages.length) return res.status(400).json({ ok: false, error: "Missing messages" });

    const data = await perplexityChat(messages, model);
    return res.json({ ok: true, ...data });
  } catch (e) {
    console.error("Perplexity chat error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
