import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { router as searchRouter } from "./routes/search.routes.js";
import { router as newsRouter } from "./routes/news.routes.js";
import { router as pplxRouter } from "./routes/pplx.routes.js";   // <<< NEW
import { env } from "./config/env.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function start() {
  const app = express();

  // CORS
  app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"] }));

  // Routes
  app.use("/api/search", searchRouter);
  app.use("/api/news", newsRouter);
  app.use("/api/pplx", pplxRouter);     // <<< NEW

  // Health
  app.get("/healthz", (_req, res) => res.send("ok"));

  // Static
  app.use(express.static(path.join(__dirname, "..", "public")));

  // 404
  app.use((req, res) => res.status(404).send("Not Found"));

  app.listen(env.PORT, () => {
    console.log(`Server running: http://localhost:${env.PORT}`);
  });
}
