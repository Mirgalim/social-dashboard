import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { router as searchRouter } from "./routes/search.routes.js";
import { env } from "./config/env.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function start() {
  const app = express();

  // API routes: ЭХЭНД
  app.use("/api/search", searchRouter);

  // Simple CORS (optional, өөр домэйноос дуудах үед хэрэгтэй)
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // Health
  app.get("/healthz", (_req, res) => res.send("ok"));

  // Static: ДАРАА нь
  app.use(express.static(path.join(__dirname, "..", "public")));

  // 404
  app.use((req, res) => {
    console.warn("404 ->", req.method, req.originalUrl);
    res.status(404).send("Not Found");
  });

  app.listen(env.PORT, () => {
    console.log(`Server running: http://localhost:${env.PORT}`);
    console.log(`Try: http://localhost:${env.PORT}/api/search?q=xacbank`);
  });
}
