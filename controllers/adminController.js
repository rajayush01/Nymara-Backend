import User from "../models/User.js";
import UserDetails from "../models/UserDetails.js";
import UserOrder from "../models/UserOrder.js";
import Ornament from "../models/Ornament.js";
import { currencyRates } from "../config/currencyRates.js"; // ✅ Currency conversion rates

// 🔹 Helper to resolve price for selected currency
const getPriceForCurrency = (ornament, currency = "INR") => {
  let finalPrice, symbol;

  // ✅ If product already has stored prices (multi-currency in DB)
  if (ornament?.prices && ornament.prices.has(currency.toUpperCase())) {
    const priceObj = ornament.prices.get(currency.toUpperCase());
    finalPrice = priceObj.amount;
    symbol = priceObj.symbol;
  } else {
    // ✅ Otherwise fallback → convert INR price using currencyRates config
    const selectedCurrency =
      currencyRates[currency.toUpperCase()] || currencyRates["INR"];
    finalPrice = ornament?.price * selectedCurrency.rate;
    symbol = selectedCurrency.symbol;
  }

  return {
    priceInINR: ornament?.price || 0, // store base INR
    displayPrice: Number(finalPrice?.toFixed(2)) || 0, // formatted currency price
    currency: symbol,
  };
};

// 👤 Get summary of all customers (with order counts)
export const getCustomersSummary = async (req, res) => {
  try {
    // Fetch all non-admin users
    const users = await User.find({ isAdmin: false }).select("uId name email");

    // Fetch details (phone numbers etc.)
    const userDetails = await UserDetails.find({
      userId: { $in: users.map((u) => u._id) },
    }).select("userId phoneNumber");

    // Aggregate order counts for each user
    const orders = await UserOrder.aggregate([
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 },
        },
      },
    ]);

    // Build summary response
    const result = users.map((user) => {
      const detail = userDetails.find(
        (d) => d.userId.toString() === user._id.toString()
      );
      const orderInfo = orders.find(
        (o) => o._id.toString() === user._id.toString()
      );

      return {
        _id: user._id,
        customerId: user.uId,
        name: user.name,
        email: user.email,
        phoneNumber: detail ? detail.phoneNumber : null,
        orderCount: orderInfo ? orderInfo.orderCount : 0,
      };
    });

    res.json({ success: true, customers: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: err.message,
    });
  }
};

// 👤 Get all orders for a specific customer
export const getCustomerOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const { currency = "INR" } = req.query;

    // ⚠️ FIX: In your UserOrder schema it's `products`, not `items`
    const orders = await UserOrder.find({ userId })
      .populate("products.productId", "name price prices images type category subCategory") 
      .select("oId totalAmount products orderDate status paymentStatus");

    const formatted = orders.map((order) => ({
      orderId: order.oId,
      totalAmount: order.totalAmount,
      itemCount: order.products.length,
      status: order.status,
      paymentStatus: order.paymentStatus,
      orderDate: order.orderDate,
      items: order.products.map((p) => {
        const priceInfo = getPriceForCurrency(p.productId, currency);
        return {
          ornamentId: p.productId?._id,
          name: p.productId?.name,
          type: p.productId?.type,
          category: p.productId?.category || [],
          subCategory: p.productId?.subCategory || [],
          ...priceInfo,
          quantity: p.quantity,
          total: priceInfo.displayPrice * p.quantity,
        };
      }),
    }));

    res.json({ success: true, orders: formatted });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer orders",
      error: err.message,
    });
  }
};

// 📦 Get all orders (admin dashboard)
export const getAllOrders = async (req, res) => {
  try {
    const { currency = "INR" } = req.query;

    const orders = await UserOrder.find()
      .populate("userId", "uId name email")
      .populate("products.productId", "sku name type category subCategory price prices")
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map((order) => ({
      orderId: order.oId,
      date: order.orderDate,
      customer: {
        id: order.userId?.uId,
        name: order.userId?.name,
        email: order.userId?.email,
      },
      items: order.products.length,
      amount: order.products.reduce((acc, p) => {
        const priceInfo = getPriceForCurrency(p.productId, currency);
        return acc + priceInfo.displayPrice * p.quantity;
      }, 0),
      status: order.status,
      city: order.deliveryAddress?.city || "Not Provided",
      state: order.deliveryAddress?.state || "Not Provided",
    }));

    res.json({ success: true, orders: formattedOrders });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: err.message,
    });
  }
};

// 📄 Get single order details (admin view)
export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { currency = "INR" } = req.query;

    const order = await UserOrder.findOne({ oId: orderId })
      .populate("userId", "uId name email")
      .populate("products.productId", "sku name type category subCategory price prices")
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const userDetails = await UserDetails.findOne({ userId: order.userId._id });

    const response = {
      orderId: order.oId,
      date: order.orderDate,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      deliveryLink: order.deliveryLink,

      orderItems: order.products.map((p) => {
        const priceInfo = getPriceForCurrency(p.productId, currency);
        return {
          productId: p.productId?._id,
          productSKU: p.productId?.sku,
          productName: p.productId?.name,
          type: p.productId?.type,
          category: p.productId?.category || [],
          subCategory: p.productId?.subCategory || [],
          quantity: p.quantity,
          ...priceInfo,
          total: priceInfo.displayPrice * p.quantity,
        };
      }),

      customer: {
        customerId: order.userId.uId,
        name: order.userId.name,
        email: order.userId.email,
        phone: userDetails?.phoneNumber || "Not Provided",
      },

      shippingAddress: order.deliveryAddress,

      orderSummary: {
        totalItems: order.products.length,
        totalAmount: order.products.reduce((acc, p) => {
          const priceInfo = getPriceForCurrency(p.productId, currency);
          return acc + priceInfo.displayPrice * p.quantity;
        }, 0),
        currency,
      },
    };

    res.json({ success: true, order: response });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: err.message,
    });
  }
};

// 🚚 Update order status (admin)
export const updateOrderStatus = async (req, res) => {
  try {
    const { oId } = req.params;
    const { status, deliveryLink } = req.body;

    const order = await UserOrder.findOne({ oId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (status) order.status = status;
    if (deliveryLink) order.deliveryLink = deliveryLink;

    await order.save();

    res.json({ success: true, message: "Order status updated", order });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 💰 Handle refunds (admin)
export const handleRefund = async (req, res) => {
  try {
    const { oId } = req.params;
    const { refundAmount, refundStatus } = req.body;

    const order = await UserOrder.findOne({ oId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (refundAmount !== undefined) order.refundAmount = refundAmount;
    if (refundStatus) order.refundStatus = refundStatus;

    // ✅ If refund is processed, mark payment as Refunded
    if (refundStatus === "processed") {
      order.paymentStatus = "Refunded";
    }

    await order.save();

    res.json({ success: true, message: "Refund updated", order });
  } catch (error) {
    console.error("❌ Error handling refund:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
