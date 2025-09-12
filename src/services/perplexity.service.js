import { env } from "../config/env.js";

/**
 * Simple wrapper. If PPLX_API_KEY is missing, return a stub summary.
 * Input can be string (q) or messages array.
 */
export async function perplexityChat(input, model = "sonar-small-chat") {
  const key = env.PPLX_API_KEY || "";
  let messages;

  if (typeof input === "string") {
    messages = [{ role: "user", content: input }];
  } else if (Array.isArray(input)) {
    messages = input;
  } else {
    messages = [{ role: "user", content: String(input || "") }];
  }

  // No key → stub
  if (!key) {
    const summary = `_(AI news/insights disabled — set PPLX_API_KEY to enable.)_\n\n**Query:** ${messages[messages.length - 1]?.content || ""}`;
    return { summary, sources: [], messages, assistant: summary, urls: [] };
  }

  // With key — call Perplexity API (compatible with OpenAI-style)
  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        // you can tweak these:
        temperature: 0.2,
        stream: false
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Perplexity API ${r.status}: ${txt}`);
    }

    const j = await r.json();
    const assistant = j?.choices?.[0]?.message?.content || "";
    // Try to parse "sources" if present in "citations" or "metadata"
    const sources =
      j?.citations ||
      j?.usage?.citations ||
      j?.sources ||
      [];

    return {
      summary: assistant,
      sources: Array.isArray(sources) ? sources : [],
      messages,
      assistant,
      urls: [] // if your model returns images/urls, map them here
    };
  } catch (e) {
    // Graceful fallback on any error
    const assistant = `_(AI news/insights error: ${String(e.message || e)})_`;
    return { summary: assistant, sources: [], messages, assistant, urls: [] };
  }
}
