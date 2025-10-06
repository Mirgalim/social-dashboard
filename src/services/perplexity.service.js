import { env } from "../config/env.js";
const DEFAULT_MODEL = "sonar";
const PPLX_TIMEOUT_MS = 12_000;
const PPLX_MAX_RETRIES = 2;
const PPLX_BASE_DELAY = 600;

const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const backoff = (a)=>PPLX_BASE_DELAY * Math.pow(2,a-1) + Math.floor(Math.random()*300);

async function callPerplexity({ key, messages, model }) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(new Error(`Perplexity timeout ${PPLX_TIMEOUT_MS}ms`)), PPLX_TIMEOUT_MS);
  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.2, stream: false }),
      signal: ctrl.signal
    });
    if (!r.ok) {
      const txt = await r.text();
      if (String(txt).includes("Invalid model") && model !== DEFAULT_MODEL) {
        return await callPerplexity({ key, messages, model: DEFAULT_MODEL });
      }
      throw new Error(`Perplexity API ${r.status}: ${txt}`);
    }
    const j = await r.json();
    const assistant = j?.choices?.[0]?.message?.content || "";
    const sources = j?.citations || j?.usage?.citations || j?.sources || [];
    return { assistant, sources: Array.isArray(sources) ? sources : [] };
  } finally { clearTimeout(timeout); }
}

/** options.mnOnly=true үед системийн заавар + query-г Монголын контекст руу шахаж өгнө */
export async function perplexityChat(input, model = DEFAULT_MODEL, options = {}) {
  const { mnOnly = false, forceMongolianEntity = "" } = options;
  const key = env.PPLX_API_KEY || "";
  const sys = mnOnly
    ? { role: "system",
        content: "Хариултыг Монгол хэлээр өг. Монголын эх сурвалжуудыг (.mn болон монгол медиа) ишлэ. Байгууллага/товчилсон нэр олон утгатай бол Монголын контекстэд илүү тохирох утгыг сонгож тайлбарла." }
    : null;

  const disambig = forceMongolianEntity
    ? { role: "user", content: `Энэ асуултыг Монголын контекстэд тайлбарла: "${forceMongolianEntity}" байгууллагын тухай (гадаад төстэй нэрүүдийг тооцохгүй). Сүүлийн шинэ мэдээг нэгтгэн тайлбарла, эх сурвалжийн холбоосуудыг жагсаа.` }
    : null;

  let messages;
  if (typeof input === "string") {
    messages = [ ...(sys?[sys]:[]), ...(disambig?[disambig]:[]), { role: "user", content: input } ];
  } else if (Array.isArray(input)) {
    messages = [ ...(sys?[sys]:[]), ...(disambig?[disambig]:[]), ...input ];
  } else {
    messages = [ ...(sys?[sys]:[]), ...(disambig?[disambig]:[]), { role: "user", content: String(input||"") } ];
  }

  if (!key) {
    const assistant = `_(AI disabled — set PPLX_API_KEY)_\n\n**Query:** ${messages[messages.length-1]?.content||""}`;
    return { summary: assistant, assistant, sources: [], messages, urls: [] };
  }

  if (!model || typeof model !== "string" || !model.trim()) model = DEFAULT_MODEL;

  let lastErr=null;
  for(let a=0;a<=PPLX_MAX_RETRIES;a++){
    try {
      const { assistant, sources } = await callPerplexity({ key, messages, model });
      return { summary: assistant, assistant, sources, messages, urls: [] };
    } catch(e){
      lastErr=e; if(a<PPLX_MAX_RETRIES) await sleep(backoff(a+1));
    }
  }
  const assistant = `_(AI error: ${String(lastErr?.message||lastErr)})_`;
  return { summary: assistant, assistant, sources: [], messages, urls: [] };
}
