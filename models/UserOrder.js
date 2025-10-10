import mongoose from "mongoose";

const orderProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ornament",
      required: true,
    },
    variant: {
      type: String,
      enum: ["Yellow Gold", "White Gold", "Rose Gold", "Silver", "Platinum"],
    },
    quantity: { type: Number, required: true, min: 1 },
    price: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true }, // e.g. "INR", "USD"
      symbol: { type: String, required: true },   // e.g. "₹", "$"
    },
  },
  { _id: false }
);

const userOrderSchema = new mongoose.Schema(
  {
    // ✅ Sequential order ID
    oId: { type: String, unique: true },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    products: [orderProductSchema],

    totalAmount: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
      symbol: { type: String, required: true },
    },

    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String, default: null },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },

    deliveryAddress: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },

    deliveryLink: { type: String, default: null },
    billUrl: { type: String, default: null },

    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled", "returned"],
      default: "pending",
    },

    refundAmount: { type: Number, default: 0 },
    refundStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected", "processed"],
      default: "none",
    },

    orderDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// 🔹 Auto-generate sequential order ID
userOrderSchema.pre("save", async function (next) {
  if (this.isNew && !this.oId) {
    const lastOrder = await this.constructor.findOne().sort({ oId: -1 }).lean();
    if (!lastOrder || !lastOrder.oId) {
      this.oId = "OD1001";
    } else {
      const lastNumber = parseInt(lastOrder.oId.replace(/\D/g, ""), 10) || 1000;
      const newNumber = lastNumber + 1;
      this.oId = `OD${newNumber}`;
    }
  }
  next();
});

const UserOrder = mongoose.model("UserOrder", userOrderSchema);
export default UserOrder;
