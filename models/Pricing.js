import mongoose from "mongoose";

const pricingSchema = new mongoose.Schema(
  {
    goldPricePerGram: { type: Number, required: true, default: 0 },
    diamondPricePerCarat: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Pricing", pricingSchema);

