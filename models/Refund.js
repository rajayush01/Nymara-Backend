// models/Refund.js
import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    rId: { type: String, unique: true }, // custom refund ID like RFD-001

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "UserOrder", required: true },

    items: [
      {
        ornament: { type: mongoose.Schema.Types.ObjectId, ref: "Ornament", required: true },
        quantity: { type: Number, required: true },
      },
    ],

    reason: { type: String, required: true },
    comments: { type: String },
    evidence: [{ type: String }], // uploaded image URLs

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Processed"],
      default: "Pending",
    },

    refundAmount: { type: Number, required: true },
    paymentMethod: { type: String }, // "Razorpay", "Card", etc.
    razorpayRefundId: { type: String }, // reference if processed

    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

// Auto-generate refund ID
refundSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  const count = await mongoose.model("Refund").countDocuments();
  this.rId = `RFD-${String(count + 1).padStart(4, "0")}`;
  next();
});

export default mongoose.model("Refund", refundSchema);
