// controllers/refundController.js
// refund request creation by user
// admin can view all refund requests and update status
// admin can trigger Razorpay refund after approval
import Refund from "../models/Refund.js";
import UserOrder from "../models/UserOrder.js";
import Razorpay from "razorpay";

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * ✅ Create refund request
 */
export const createRefundRequest = async (req, res) => {
  try {
    const { orderId, items, reason, comments, refundAmount } = req.body;
    const userId = req.user._id; // from auth middleware

    // Validate order exists
    const order = await UserOrder.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Save refund request
    const refund = new Refund({
      userId,
      orderId,
      items,
      reason,
      comments,
      refundAmount,
      paymentMethod: order.paymentMethod,
    });

    await refund.save();
    res.json({ success: true, message: "Refund request submitted", refund });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create refund", error: err.message });
  }
};

/**
 * ✅ Get refunds of a customer
 */
export const getMyRefunds = async (req, res) => {
  try {
    const refunds = await Refund.find({ userId: req.user._id })
      .populate("orderId", "oId totalAmount")
      .populate("items.ornament", "name sku type category images")
      .sort({ createdAt: -1 });

    res.json({ success: true, refunds });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch refunds", error: err.message });
  }
};

/**
 * ✅ Admin: Get all refund requests
 */
export const getAllRefunds = async (req, res) => {
  try {
    const refunds = await Refund.find()
      .populate("userId", "uId name email")
      .populate("orderId", "oId totalAmount paymentStatus")
      .sort({ createdAt: -1 });

    res.json({ success: true, refunds });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch refunds", error: err.message });
  }
};

/**
 * ✅ Admin: Update refund status
 */
export const updateRefundStatus = async (req, res) => {
  try {
    const { refundId } = req.params;
    const { status } = req.body;

    const refund = await Refund.findById(refundId);
    if (!refund) return res.status(404).json({ success: false, message: "Refund not found" });

    refund.status = status;
    if (status === "Processed") refund.processedAt = new Date();

    await refund.save();
    res.json({ success: true, refund });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update refund", error: err.message });
  }
};

/**
 * ✅ Admin: Trigger Razorpay refund (only after approval)
 */
export const processRazorpayRefund = async (req, res) => {
  try {
    const { refundId } = req.params;
    const refund = await Refund.findById(refundId).populate("orderId");

    if (!refund) return res.status(404).json({ success: false, message: "Refund not found" });
    if (refund.status !== "Approved")
      return res.status(400).json({ success: false, message: "Refund not approved yet" });

    // Call Razorpay refund API
    const razorpayRefund = await razorpay.payments.refund(refund.orderId.razorpayPaymentId, {
      amount: refund.refundAmount * 100, // in paise
      speed: "normal",
    });

    refund.status = "Processed";
    refund.processedAt = new Date();
    refund.razorpayRefundId = razorpayRefund.id;

    await refund.save();
    res.json({ success: true, message: "Refund processed", refund });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to process refund", error: err.message });
  }
};
