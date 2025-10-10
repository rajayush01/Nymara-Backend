import express from "express";
import {
  placeOrder,
  updatePayment,
  getMyOrders,
  getOrderById,
  cancelOrder,
  requestReturn,
} from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 👤 User routes
router.post("/", protect, placeOrder); // place order
router.put("/:oId/payment", protect, updatePayment); // update payment
router.get("/my", protect, getMyOrders); // get logged-in user's orders
router.get("/:oId", protect, getOrderById); // get single order
router.put("/:oId/cancel", protect, cancelOrder); // cancel order
router.put("/:oId/return", protect, requestReturn); // return/refund

export default router;
