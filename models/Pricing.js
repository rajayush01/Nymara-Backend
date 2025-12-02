// models/Pricing.js
import mongoose from "mongoose";

const pricingSchema = new mongoose.Schema(
  {
    // 🟡 Store multiple gold prices by karat
    goldPrices: {
      type: Map,
      of: Number, // e.g. { "14K": 4000, "18K": 5200, "22K": 6000 }
      default: {},
    },

    // 💎 Diamond price per carat
    diamondPricePerCarat: {
      type: Number,
      required: false,
      default: 0,
    },

  gemstonePrices: {
  type: Map,
  of: Number,
  default: {
    Emerald: 0,
    Ruby: 0,
    Sapphire: 0,
    Opal: 0,
    Garnet: 0,
    Topaz: 0,
  },
},

platinumPricePerGram: {
  type: Number,
  default: 0,
},

silver925PricePerGram: {
  type: Number,
  default: 0,
},

goldVermeilPricePerGram: {
  type: Number,
  default: 0,
},




  },
  { timestamps: true }
);

export default mongoose.model("Pricing", pricingSchema);
