import { start } from "./src/app.js";

// optional: polyfill fetch for Node <18
let needPolyfill = typeof fetch === "undefined";
if (needPolyfill) {
  const { default: fetchFn } = await import("node-fetch");
  globalThis.fetch = fetchFn;
}

start();
