// admin can update gold/diamond pricing and all ornaments will be recalculated
import Pricing from "../models/Pricing.js";
import Ornament from "../models/Ornament.js";

// ✅ Update gold/diamond pricing and recalc all ornaments
export const updatePricing = async (req, res) => {
  try {
    const { goldPricePerGram, diamondPricePerCarat } = req.body;

    if (!goldPricePerGram && !diamondPricePerCarat) {
      return res.status(400).json({ message: "Provide at least one price" });
    }

    let pricing = await Pricing.findOne();
    if (!pricing) {
      pricing = new Pricing({ goldPricePerGram, diamondPricePerCarat });
    } else {
      if (goldPricePerGram) pricing.goldPricePerGram = goldPricePerGram;
      if (diamondPricePerCarat) pricing.diamondPricePerCarat = diamondPricePerCarat;
    }
    await pricing.save();

    // 🔹 Bulk update ornaments
    if (goldPricePerGram) {
      await Ornament.updateMany(
        { category: "Gold" },
        [
          {
            $set: {
              price: {
                $add: [
                  { $multiply: ["$weight", goldPricePerGram] },
                  "$makingCharges",
                ],
              },
            },
          },
        ]
      );
    }

    if (diamondPricePerCarat) {
      await Ornament.updateMany(
        { category: "Diamond" },
        [
          {
            $set: {
              price: {
                $add: [
                  { $multiply: ["$weight", diamondPricePerCarat] },
                  "$makingCharges",
                ],
              },
            },
          },
        ]
      );
    }

    res
      .status(200)
      .json({ message: "Pricing updated and products recalculated", pricing });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update pricing", error: err.message });
  }
};
