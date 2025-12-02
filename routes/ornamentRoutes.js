import express from "express";
import {
  addOrnament,
  getOrnaments,
  updateOrnament,
  deleteOrnament,
  uploadOrnamentImages,
  getOrnamentById,
  getMainProduct,
  getVariantProduct
} from "../controllers/ornamentController.js";

import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { updatePricing, getPricing } from "../controllers/pricingController.js";
import upload from "../cloud/upload.js";
import mongoose from "mongoose";
import Ornament from "../models/Ornament.js";


const router = express.Router();

/* ----------------------------------------
   ✅ PRICING ROUTES — Must be placed FIRST
---------------------------------------- */
router.get("/pricing", protect, adminOnly, getPricing);
router.put("/pricing", protect, adminOnly, updatePricing);

/* ----------------------------------------
   ✅ ORNAMENT CRUD ROUTES
---------------------------------------- */
router.post("/add", protect, adminOnly, upload.any(), addOrnament);

router.get("/", protect, adminOnly, getOrnaments);
router.put("/edit/:id", protect, adminOnly, upload.any(), updateOrnament);
router.delete("/delete/:id", protect, adminOnly, deleteOrnament);
router.get("/:id", protect, adminOnly, getOrnamentById);
router.get("/main/:id", getMainProduct);     // Main product + variants summary
router.get("/variant/:id", getVariantProduct); // Full variant details

router.get("/variants/search", async (req, res) => {
  try {
    let {
      search = "",
      metalType,
      color,
      size,
      page = 1,
      limit = 20,
      sort = "newest",
      currency = "INR",
    } = req.query;

    const curr = currency.toUpperCase();

    const currencyRates = {
      INR: { rate: 1, symbol: "₹" },
      USD: { rate: 0.012, symbol: "$" },
      GBP: { rate: 0.0095, symbol: "£" },
      CAD: { rate: 0.016, symbol: "CA$" },
      EUR: { rate: 0.011, symbol: "€" },
    };

    const rate = currencyRates[curr]?.rate ?? 1;
    const symbol = currencyRates[curr]?.symbol ?? "₹";

    /* --------------------------------------------------
       FILTER: ONLY VARIANTS
    -------------------------------------------------- */
    let filter = { isVariant: true };

    /* SEARCH FILTER */
    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex },
        { description: regex },
        { sku: regex },
        { color: regex },
        { size: regex },
        { "metal.metalType": regex },
      ];
    }

    /* OPTIONAL FILTERS */
    if (metalType) filter["metal.metalType"] = metalType;
    if (color) filter.color = new RegExp(`^${color}$`, "i");
    if (size) filter.size = size;

    /* SORTING */
    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { price: 1 };
    if (sort === "price_desc") sortOption = { price: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };

    /* PAGINATION */
    const skip = (Number(page) - 1) * Number(limit);

    /* FETCH VARIANTS */
    const variants = await Ornament.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Ornament.countDocuments(filter);

    /* PRICE CONVERSION */
    const formatted = variants.map((v) => {
      let price = v.price || 0;
      let making = v.makingCharges || 0;

      // Country-based price override
      if (v.prices?.[curr]) price = v.prices[curr].amount;
      else price = Number((price * rate).toFixed(2));

      if (v.makingChargesByCountry?.[curr])
        making = v.makingChargesByCountry[curr].amount;
      else making = Number((making * rate).toFixed(2));

      return {
        ...v,
        convertedPrice: price,
        convertedMaking: making,
        totalConvertedPrice: price + making,
        currencySymbol: symbol,
      };
    });

    res.json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
      count: formatted.length,
      variants: formatted,
    });
  } catch (err) {
    console.error("❌ Variant Search Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to search variants",
      error: err.message,
    });
  }
});


export default router;
