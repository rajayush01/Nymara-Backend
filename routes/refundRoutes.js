// routes/refundRoutes.js
import express from "express";
import {
  createRefundRequest,
  getMyRefunds,
  getAllRefunds,
  updateRefundStatus,
  processRazorpayRefund,
} from "../controllers/refundController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Customer
router.post("/", protect, createRefundRequest);
router.get("/my-refunds", protect, getMyRefunds);

// Admin
router.get("/", protect, adminOnly, getAllRefunds);
router.put("/:refundId/status", protect, adminOnly, updateRefundStatus);
router.post("/:refundId/process", protect, adminOnly, processRazorpayRefund);

export default router;
