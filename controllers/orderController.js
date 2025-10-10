import UserOrder from "../models/UserOrder.js";
import Ornament from "../models/Ornament.js";

// 📦 Place new order
export const placeOrder = async (req, res) => {
  try {
    const { products, totalAmount, razorpayOrderId, deliveryAddress } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ success: false, message: "No products in order" });
    }

    // Validate products exist
    for (let p of products) {
      const product = await Ornament.findById(p.productId);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${p.productId}` });
      }
    }

    const order = new UserOrder({
      userId: req.user._id,
      products,
      totalAmount,
      razorpayOrderId,
      deliveryAddress,
    });

    await order.save();

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    console.error("❌ Error placing order:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 💳 Update payment after Razorpay success
export const updatePayment = async (req, res) => {
  try {
    const { oId } = req.params;
    const { razorpayPaymentId, paymentStatus } = req.body;

    const order = await UserOrder.findOne({ oId, userId: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.razorpayPaymentId = razorpayPaymentId;
    order.paymentStatus = paymentStatus || "Paid";

    await order.save();

    res.json({ success: true, message: "Payment updated", order });
  } catch (error) {
    console.error("❌ Error updating payment:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 👤 Get all orders for logged-in user
export const getMyOrders = async (req, res) => {
  try {
    const orders = await UserOrder.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 📄 Get single order by oId
export const getOrderById = async (req, res) => {
  try {
    const { oId } = req.params;
    const order = await UserOrder.findOne({ oId, userId: req.user._id })
      .populate("products.productId", "name coverImage price");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json(order);
  } catch (error) {
    console.error("❌ Error fetching order:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ❌ Cancel order
export const cancelOrder = async (req, res) => {
  try {
    const { oId } = req.params;
    const order = await UserOrder.findOne({ oId, userId: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (["pending", "processing"].includes(order.status)) {
      order.status = "cancelled";
      await order.save();
      return res.json({ success: true, message: "Order cancelled", status: order.status });
    } else {
      return res.status(400).json({ success: false, message: "Order cannot be cancelled at this stage" });
    }
  } catch (error) {
    console.error("❌ Error cancelling order:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 🔄 Request return/refund
export const requestReturn = async (req, res) => {
  try {
    const { oId } = req.params;
    const order = await UserOrder.findOne({ oId, userId: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.status === "delivered") {
      order.status = "returned";
      order.refundStatus = "pending";
      await order.save();
      return res.json({ success: true, message: "Return request submitted", refundStatus: order.refundStatus });
    } else {
      return res.status(400).json({ success: false, message: "Return allowed only after delivery" });
    }
  } catch (error) {
    console.error("❌ Error requesting return:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
