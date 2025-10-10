import Razorpay from "razorpay";
import crypto from "crypto";
import UserOrder from "../models/UserOrder.js";
import Ornament from "../models/Ornament.js";

// 🔹 Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 📦 1. Create Razorpay order
export const createRazorpayOrder = async (req, res) => {
  try {
    const { products, deliveryAddress, currency = "INR", symbol = "₹" } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ success: false, message: "No products in cart" });
    }

    // 🔹 Calculate total from DB
    let totalAmount = 0;
    for (let p of products) {
      const product = await Ornament.findById(p.productId);
      if (!product) return res.status(404).json({ success: false, message: "Product not found" });

      // Pick variant price
      const variant = product.variants.find(v => v.name === p.variant);
      let priceData;
      if (currency === "INR") {
        priceData = { amount: variant.price, symbol: "₹" };
      } else {
        priceData = product.prices.get(currency) || { amount: variant.price, symbol };
      }

      totalAmount += priceData.amount * p.quantity;
    }

    // 🔹 Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount * 100, // convert to paise
      currency,
      receipt: `rcpt_${Date.now()}`,
    });

    // 🔹 Save pending order in DB
    const order = new UserOrder({
      userId: req.user._id,
      products: products.map(p => ({
        productId: p.productId,
        variant: p.variant,
        quantity: p.quantity,
        price: { amount: totalAmount, currency, symbol },
      })),
      totalAmount: { amount: totalAmount, currency, symbol },
      razorpayOrderId: razorpayOrder.id,
      deliveryAddress,
      paymentStatus: "Pending",
      status: "pending",
    });

    await order.save();

    res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
      currency,
      oId: order.oId,
    });
  } catch (error) {
    console.error("❌ Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 💳 2. Verify payment (Razorpay callback)
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, oId } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    // ✅ Update order as Paid
    const order = await UserOrder.findOne({ oId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.razorpayPaymentId = razorpay_payment_id;
    order.paymentStatus = "Paid";
    order.status = "processing";

    await order.save();

    res.json({ success: true, message: "Payment verified", order });
  } catch (error) {
    console.error("❌ Error verifying payment:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
