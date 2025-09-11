import { env } from "../config/env.js";

// Perplexity Chat — full assistant response
export async function perplexityChat(query) {
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
        { role: "system", content: "You are a helpful assistant that summarizes public news with sources." },
        { role: "user", content: query }
      ],
      temperature: 0.3,
    }),
  });

  if (!r.ok) throw new Error(`Perplexity API error: ${r.status} ${await r.text()}`);
  const j = await r.json();

  return {
    messages: j.choices?.[0]?.message ? [ j.choices[0].message ] : [],
    raw: j,
  };
}
