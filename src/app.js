import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { router as searchRouter } from "./routes/search.routes.js";
import { env } from "./config/env.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CORS setup (ALLOWLIST) ---
const ALLOWED_ORIGINS = new Set([
  "https://social-dashboard-jade.vercel.app", // таны фронт домэйн
  "http://localhost:5173",                     // локал туршилт
]);

// src/app.js
function corsMiddleware(req, res, next) {
  // НЭЭЛТТЭЙ ЗӨВШӨӨРЛӨӨР (credentials ашиглахгүй тул OK)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}


export function start() {
  const app = express();

  // 1) CORS: ЭХЭНД НЬ
  app.use(corsMiddleware);

  // 2) API routes
  app.use("/api/search", searchRouter);

  // 3) Health
  app.get("/healthz", (_req, res) => res.send("ok"));

  // 4) Static
  app.use(express.static(path.join(__dirname, "..", "public")));

  // 5) 404
  app.use((req, res) => {
    console.warn("404 ->", req.method, req.originalUrl);
    res.status(404).send("Not Found");
  });

  app.listen(env.PORT, () => {
    console.log(`Server running: http://localhost:${env.PORT}`);
    console.log(`Try: http://localhost:${env.PORT}/api/search?q=xacbank`);
  });
}
