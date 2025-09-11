import fetch from "node-fetch";
import { env } from "../config/env.js";

// Перплексити заримдаа Markdown + эх сурвалжийн линк оруулж ирдэг.
// Энгийн байдлаар URL-уудыг гаргаж авах жижиг util:
function extractUrlsFromText(text = "") {
  const urls = [];
  const re = /(https?:\/\/[^\s)]+)\)?/g;
  let m;
  while ((m = re.exec(text)) !== null) urls.push(m[1]);
  return Array.from(new Set(urls)).slice(0, 10);
}

export async function perplexityNewsSearch(query) {
  if (!env.PPLX_API_KEY) throw new Error("Missing PPLX_API_KEY");
  const url = "https://api.perplexity.ai/chat/completions";

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PPLX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-small-chat",
      messages: [
        { role: "system", content: "You are a concise news assistant. Return a short summary and include sources." },
        { role: "user", content: `Summarize the latest public news about "${query}" in 3-5 bullet points with sources.` }
      ],
      temperature: 0.2,
    }),
  });

  if (!r.ok) throw new Error(`Perplexity API error: ${r.status} ${await r.text()}`);
  const j = await r.json();

  const summary = j.choices?.[0]?.message?.content || "";
  const sources = extractUrlsFromText(summary);

  return { summary, sources, raw: j };
}
