// controllers/pricingController.js
import Pricing from "../models/Pricing.js";
import Ornament from "../models/Ornament.js";

// =======================
// 🟡 UPDATE PRICING
// =======================
export const updatePricing = async (req, res) => {
  try {
const { 
  goldPrices, 
  diamondPricePerCarat, 
  gemstonePrices,
  platinumPricePerGram,
  silver925PricePerGram,
  goldVermeilPricePerGram
} = req.body;



    if (!goldPrices && !diamondPricePerCarat && !gemstonePrices) {
  return res.status(400).json({ message: "Provide at least one price field" });
}


    // Load or create pricing
    let pricing = await Pricing.findOne();
   if (!pricing) {
  pricing = new Pricing({
    goldPrices: goldPrices || {},
    diamondPricePerCarat: diamondPricePerCarat || 0,
    gemstonePrices: gemstonePrices || {},

    platinumPricePerGram: platinumPricePerGram || 0,
    silver925PricePerGram: silver925PricePerGram || 0,
    goldVermeilPricePerGram: goldVermeilPricePerGram || 0,
  });
}
 else {
      if (goldPrices) pricing.goldPrices = goldPrices;
      if (diamondPricePerCarat) pricing.diamondPricePerCarat = diamondPricePerCarat;
      if (gemstonePrices) pricing.gemstonePrices = gemstonePrices;
       if (platinumPricePerGram !== undefined)
    pricing.platinumPricePerGram = platinumPricePerGram;

  if (silver925PricePerGram !== undefined)
    pricing.silver925PricePerGram = silver925PricePerGram;

  if (goldVermeilPricePerGram !== undefined)
    pricing.goldVermeilPricePerGram = goldVermeilPricePerGram;
     
    }
    await pricing.save();

    const bulkOps = [];

    // 🟡 FIXED GOLD PRICE RECALCULATION
    if (goldPrices) {
      const goldOrnaments = await Ornament.find({ categoryType: "Gold" });

      goldOrnaments.forEach((item) => {
        const metal = item.metal || {};

        // Extract purity from 18K / 22K / etc
        const purityMatch =
          metal.purity?.toUpperCase().match(/(\d+K)/) ||
          metal.metalType?.toUpperCase().match(/(\d+K)/);

        const purity = purityMatch ? purityMatch[1] : null;

        const goldRate = purity ? Number(goldPrices[purity] || 0) : 0;

        if (!goldRate) {
          console.warn(
            `⚠️ No matching gold rate for ${item.name} (${purity || "unknown purity"})`
          );
          return;
        }

        const weight = Number(metal.weight || 0);
        const newPrice = weight * goldRate;

        bulkOps.push({
          updateOne: {
            filter: { _id: item._id },
            update: {
              $set: {
                price: newPrice,
                originalPrice: newPrice,
                "prices.INR.amount": newPrice,
              },
            },
          },
        });
      });
    }

    // 🟣 NEW: FIXED PLATINUM / SILVER / VERMEIL RECALCULATION
if (req.body.platinumPricePerGram || req.body.silver925PricePerGram || req.body.goldVermeilPricePerGram) {

  const metalOrnaments = await Ornament.find({
    categoryType: "Gold",  // they are still metal category
    "metal.metalType": { $in: ["Platinum", "925 Sterling Silver", "Gold Vermeil"] }
  });

  metalOrnaments.forEach((item) => {
    const metal = item.metal || {};
    let pricePerGram = 0;

    const type = metal.metalType;

    if (type === "Platinum") {
      pricePerGram = Number(req.body.platinumPricePerGram || pricing.platinumPricePerGram || 0);
    }

    if (type === "925 Sterling Silver") {
      pricePerGram = Number(req.body.silver925PricePerGram || pricing.silver925PricePerGram || 0);
    }

    if (type === "Gold Vermeil") {
      // Option 1: Override
      if (req.body.goldVermeilPricePerGram || pricing.goldVermeilPricePerGram > 0) {
        pricePerGram = Number(req.body.goldVermeilPricePerGram || pricing.goldVermeilPricePerGram);
      } else {
        // Option 2: Auto-calc
        const silver = pricing.silver925PricePerGram || 0;
        const gold18 = pricing.goldPrices.get("18K") || 0;
        pricePerGram = silver + gold18 * 0.05;
      }
    }

    const newPrice = Number(metal.weight || 0) * pricePerGram;

    bulkOps.push({
      updateOne: {
        filter: { _id: item._id },
        update: {
          $set: {
            price: newPrice,
            originalPrice: newPrice,
            "prices.INR.amount": newPrice,
          },
        },
      },
    });
  });
}


    // 💎 FIXED DIAMOND PRICE RECALCULATION
    if (diamondPricePerCarat) {
      const diamondOrnaments = await Ornament.find({ categoryType: "Diamond" });

      diamondOrnaments.forEach((item) => {
        const metal = item.metal || {};
        const weight = Number(metal.weight || 0);

        const newPrice = weight * Number(diamondPricePerCarat);

        bulkOps.push({
          updateOne: {
            filter: { _id: item._id },
            update: {
              $set: {
                price: newPrice,
                originalPrice: newPrice,
                "prices.INR.amount": newPrice,
              },
            },
          },
        });
      });
    }

  
    // 🟢 FIXED GEMSTONE PRICE RECALCULATION
if (gemstonePrices) {
  const gemOrnaments = await Ornament.find({ categoryType: "Gemstone" });

  gemOrnaments.forEach((item) => {
    const stones = item.gemstoneDetails || [];
    let totalGemCost = 0;

    stones.forEach((stone) => {
      const stoneType =
        stone.stoneType ||
        stone.type ||
        stone.gemstoneType ||
        stone.name ||
        null;

      if (!stoneType) return;

      // Handle Map or plain object
      let rate = 0;

      if (pricing.gemstonePrices instanceof Map) {
        rate = Number(pricing.gemstonePrices.get(stoneType) || 0);
      } else {
        rate = Number(pricing.gemstonePrices?.[stoneType] || 0);
      }

      const carat = Number(stone.carat || stone.weight || 0);
      const count = Number(stone.count || 1);

      totalGemCost += rate * carat * count;
    });

    bulkOps.push({
      updateOne: {
        filter: { _id: item._id },
        update: {
          $set: {
            price: totalGemCost,
            originalPrice: totalGemCost,
            "prices.INR.amount": totalGemCost,
          },
        },
      },
    });
  });
}

// 🟣 FIXED COMPOSITE PRODUCT RECALCULATION
if (goldPrices || diamondPricePerCarat || gemstonePrices) {
  const compositeOrnaments = await Ornament.find({ categoryType: "Composite" });

  compositeOrnaments.forEach((item) => {
    let goldCost = 0;
    let diamondCost = 0;
    let gemstoneCost = 0;

    /* ---------------- GOLD ---------------- */
    if (goldPrices) {
      const metal = item.metal || {};
      const purityMatch =
        metal.purity?.toUpperCase().match(/(\d+K)/) ||
        metal.metalType?.toUpperCase().match(/(\d+K)/);

      const purity = purityMatch ? purityMatch[1] : null;
      const rate = purity ? Number(goldPrices[purity] || 0) : 0;

      goldCost = Number(metal.weight || 0) * rate;
    }

    /* ---------------- DIAMOND ---------------- */
    if (diamondPricePerCarat) {
      const d = item.diamondDetails || {};
      diamondCost =
        Number(d.carat || 0) *
        Number(d.count || 0) *
        Number(diamondPricePerCarat || 0);

      (item.sideDiamondDetails || []).forEach((s) => {
        diamondCost +=
          Number(s.carat || 0) *
          Number(s.count || 0) *
          Number(diamondPricePerCarat || 0);
      });
    }

    /* ---------------- GEMSTONES ---------------- */
    if (gemstonePrices) {
      (item.stones || []).forEach((stone) => {
        const stoneType = stone.type || stone.stoneType || "";
        const rate =
          gemstonePrices[stoneType] ||
          gemstonePrices[stone.type] ||
          0;

        gemstoneCost +=
          Number(stone.weight || 0) *
          Number(stone.count || 1) *
          Number(rate || 0);
      });
    }

    const newPrice = goldCost + diamondCost + gemstoneCost;

    bulkOps.push({
      updateOne: {
        filter: { _id: item._id },
        update: {
          $set: {
            price: newPrice,
            originalPrice: newPrice,
            "prices.INR.amount": newPrice,
          },
        },
      },
    });
  });
}




    // Perform bulk update
    if (bulkOps.length > 0) {
      await Ornament.bulkWrite(bulkOps);
    }

    return res.status(200).json({
      success: true,
      message: "Pricing updated successfully using correct purity logic",
      pricing,
    });

  } catch (err) {
    console.error("❌ Pricing update error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update pricing",
      error: err.message,
    });
  }
};

// =======================
// 🟢 GET PRICING
// =======================
export const getPricing = async (req, res) => {
  try {
    const pricing = await Pricing.findOne();

    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: "No pricing data found",
      });
    }

    res.status(200).json({
      success: true,
      pricing,
    });
  } catch (err) {
    console.error("❌ getPricing error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pricing",
      error: err.message,
    });
  }
};
