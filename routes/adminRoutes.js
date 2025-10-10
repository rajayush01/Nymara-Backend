import express from "express";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { getCustomersSummary, getCustomerOrders,getAllOrders, getOrderDetails,updateOrderStatus,handleRefund}from "../controllers/adminController.js";

const router = express.Router();

// Customers summary
router.get("/customers", protect, adminOnly, getCustomersSummary);

// Orders of specific customer
router.get("/customers/:userId/orders", protect, adminOnly, getCustomerOrders);

// ✅ Admin: Get all orders summary
router.get("/", protect, adminOnly, getAllOrders);

// ✅ Admin: Get details of single order
router.get("/:orderId", protect, adminOnly, getOrderDetails);

router.put("/:oId/status", protect, adminOnly,updateOrderStatus)

router.put("/:oId/refund", protect, adminOnly,handleRefund);

export const adminRoutes = router;
