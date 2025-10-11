// controllers/pricingController.js
import Pricing from "../models/Pricing.js";
import Ornament from "../models/Ornament.js";

// ✅ Update gold/diamond pricing and recalc all ornaments (INR only)
export const updatePricing = async (req, res) => {
  try {
    const { goldPricePerGram, diamondPricePerCarat } = req.body;

    if (!goldPricePerGram && !diamondPricePerCarat) {
      return res.status(400).json({ message: "Provide at least one price" });
    }

    // 🔹 Get or create pricing
    let pricing = await Pricing.findOne();
    if (!pricing) {
      pricing = new Pricing({ goldPricePerGram, diamondPricePerCarat });
    } else {
      if (goldPricePerGram) pricing.goldPricePerGram = goldPricePerGram;
      if (diamondPricePerCarat) pricing.diamondPricePerCarat = diamondPricePerCarat;
    }
    await pricing.save();

    // 🔹 Recalculate all ornaments — only INR price (not other currencies)
    const bulkOps = [];

    if (goldPricePerGram) {
      const goldOrnaments = await Ornament.find({ categoryType: "Gold" });
      goldOrnaments.forEach((item) => {
        const newPrice = item.weight * goldPricePerGram + item.makingCharges;
        bulkOps.push({
          updateOne: {
            filter: { _id: item._id },
            update: {
              $set: {
                price: newPrice,                  // update INR base price
                originalPrice: newPrice,           // optional
                "prices.INR.amount": newPrice,     // ✅ only update INR inside prices map
              },
            },
          },
        });
      });
    }

    if (diamondPricePerCarat) {
      const diamondOrnaments = await Ornament.find({ categoryType: "Diamond" });
      diamondOrnaments.forEach((item) => {
        const newPrice = item.weight * diamondPricePerCarat + item.makingCharges;
        bulkOps.push({
          updateOne: {
            filter: { _id: item._id },
            update: {
              $set: {
                price: newPrice,
                originalPrice: newPrice,
                "prices.INR.amount": newPrice,     // ✅ update INR only
              },
            },
          },
        });
      });
    }

    // 🔹 Execute all updates at once
    if (bulkOps.length > 0) {
      await Ornament.bulkWrite(bulkOps);
    }

    res.status(200).json({
      message: "Pricing updated and INR prices recalculated",
      pricing,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to update pricing",
      error: err.message,
    });
  }
};
