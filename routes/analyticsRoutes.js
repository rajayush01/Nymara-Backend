import express from "express";
import { getAnalyticsSummary } from "../controllers/analyticsController.js";
import { protect,adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// 👑 Admin analytics route
// Example: GET /api/analytics/summary?range=30
router.get("/summary", protect, adminOnly,getAnalyticsSummary);

export default router;
