import mongoose from "mongoose";

const trackingLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, 
  sessionId: { type: String }, // for guests / anonymous visitors
  event: {
    type: String,
    enum: ["visit", "add_to_cart", "checkout", "purchase"],
    required: true,
  },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Ornament" },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "UserOrder" },
  metadata: { type: Object }, // extra info (device, referrer, page, etc.)
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("TrackingLog", trackingLogSchema);
