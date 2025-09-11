// services/perplexity.service.js
import fetch from "node-fetch";
import { env } from "../config/env.js";

// Текстээс URL-ууд (зураг/сурвалж) ялгах
function extractUrls(text = "") {
  const urls = [];
  const re = /(https?:\/\/[^\s)]+)\)?/g;
  let m;
  while ((m = re.exec(text)) !== null) urls.push(m[1]);
  return Array.from(new Set(urls)).slice(0, 20);
}

// News summary (short)
export async function perplexityNewsSearch(query) {
  if (!env.PPLX_API_KEY) throw new Error("Missing PPLX_API_KEY");
  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PPLX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-small-chat",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a concise news assistant. Return a short summary and include sources." },
        { role: "user", content: `Summarize the latest public news about "${query}" in 3-5 bullet points with sources.` }
      ]
    }),
  });
  if (!r.ok) throw new Error(`Perplexity API error: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const summary = j?.choices?.[0]?.message?.content || "";
  const sources = extractUrls(summary);
  return { summary, sources, raw: j };
}

// Chat (пүрэв—перплекситийн яг chat response-ийг буцаана)
export async function perplexityChat(messages, model = "sonar-small-chat") {
  if (!env.PPLX_API_KEY) throw new Error("Missing PPLX_API_KEY");
  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PPLX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages
    }),
  });
  if (!r.ok) throw new Error(`Perplexity API error: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const assistant = j?.choices?.[0]?.message?.content || "";
  const urls = extractUrls(assistant);
  return { assistant, urls, raw: j };
}
