import { Router } from "express";
import { searchController } from "../controllers/search.controller.js";
export const router = Router();
router.get("/", searchController); // GET /api/search?q=...&news=1&mn=1
