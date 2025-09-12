import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { router as searchRouter } from "./routes/search.routes.js";
import { router as newsRouter } from "./routes/news.routes.js";
import { router as pplxRouter } from "./routes/pplx.js";
import { env } from "./config/env.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function start() {
  const app = express();

  app.use(express.json());
  app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"] }));

  app.use("/api/search", searchRouter);
  app.use("/api/news", newsRouter);   // optional
  app.use("/api/pplx", pplxRouter);

  app.get("/healthz", (_req, res) => res.send("ok"));

  app.use(express.static(path.join(__dirname, "..", "public")));

  app.use((req, res) => res.status(404).send("Not Found"));

  app.listen(env.PORT, () => {
    console.log(`Server running: http://localhost:${env.PORT}`);
  });
}
