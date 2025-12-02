// controllers/ornamentController.js

import Ornament from "../models/Ornament.js";
import upload from "../cloud/upload.js";
import util from "util";
import mongoose from "mongoose";
import { isValidObjectId } from "mongoose";
import Pricing from "../models/Pricing.js";

const safeObjectId = (id) => {
  if (!id) return null;

  if (id === "null" || id === "undefined" || id === "") return null;

  if (/^[0-9a-fA-F]{24}$/.test(id)) return id;

  return null;
};



function convertPricing(item, curr, selectedCurrency) {
  let price = item.price || 0;
  let making = item.makingCharges || 0;
  let symbol = selectedCurrency.symbol;

  // Country-specific price
  if (item.prices?.[curr]) {
    price = Number(item.prices[curr].amount);
    symbol = item.prices[curr].symbol;
  } else {
    price = Number((price * selectedCurrency.rate).toFixed(2));
  }

  // Country-specific making charge
  if (item.makingChargesByCountry?.[curr]) {
    making = Number(item.makingChargesByCountry[curr].amount);
  } else {
    making = Number((making * selectedCurrency.rate).toFixed(2));
  }

  const total = Number((price + making).toFixed(2));
  const original =
    Number(item.originalPrice) > 0
      ? Number(item.originalPrice)
      : Number(price);

  const discount =
    item.discount || Math.round(((original - price) / original) * 100) || 0;

  return {
    ...item,
    currency: symbol,
    displayPrice: price,
    convertedMakingCharge: making,
    totalConvertedPrice: total,
    originalPrice: original,
    discount,
  };
}


// Upload middleware
export const uploadOrnamentImages = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "images", maxCount: 20 },
  { name: "videoFile", maxCount: 1 },
  { name: "model3D", maxCount: 1 }
]);

/* -----------------------------------------
   SAFE JSON PARSER
------------------------------------------ */
const safeJSON = (value, fallback) => {
  try {
    if (!value) return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};

/* ===========================================================================
   ⭐ FULLY FIXED — ADD ORNAMENT CONTROLLER
=========================================================================== */
export const addOrnament = async (req, res) => {
  try {
    console.log("\n==============================");
    console.log("📥 NEW PRODUCT REQUEST");
    console.log("==============================");
    console.log("📌 BODY:", req.body);
    console.log("📌 RAW FILES:", util.inspect(req.files, { depth: null }));

    /* --------------------------------------------------------
       FIX: Convert req.files array → grouped object
       (Cloudinary sometimes breaks field mapping)
    --------------------------------------------------------- */
    if (Array.isArray(req.files)) {
      const grouped = {};
      req.files.forEach((f) => {
        if (!grouped[f.fieldname]) grouped[f.fieldname] = [];
        grouped[f.fieldname].push(f);
      });
      req.files = grouped;
    }

    console.log("📁 FILES (ORGANIZED):", util.inspect(req.files, { depth: null }));

    /* -----------------------------------------
       Extract media (after fix)
    ------------------------------------------ */
    const coverImage = req.files?.coverImage?.[0]?.path || null;
    const images = req.files?.images?.map((i) => i.path) || [];
    const model3D = req.files?.model3D?.[0]?.path || null;
    const videoUrl = req.files?.videoFile?.[0]?.path || null;

    console.log("📸 MAIN MEDIA:", { coverImage, images, model3D, videoUrl });

    /* -----------------------------------------
       Parse all dynamic fields
    ------------------------------------------ */
    const isVariant = req.body.isVariant === "true" || req.body.isVariant === true;

    const metal = safeJSON(req.body.metal, {});
    // FIX: Accept both stones[] and gemstoneDetails[]
    const stones = safeJSON(req.body.stones, []);

    const normalizedGemstones = (stones || [])
      .filter(st => st.stoneType || st.type || st.gemstoneType || st.name) // ⭐ FIX
      .map((st) => ({
        stoneType:
          st.stoneType ||
          st.type ||
          st.gemstoneType ||
          st.name ||
          "",
        carat: Number(st.carat || 0),
        count: Number(st.count || 1),
        color: st.color || "",
        clarity: st.clarity || "",
        cut: st.cut || "",
        pricePerCarat: null,
        useAuto: true
      }));


    const prices = safeJSON(req.body.prices, {});
    const makingChargesByCountry = safeJSON(req.body.makingChargesByCountry, {});
    const diamondDetails = safeJSON(req.body.diamondDetails, {});
    const sideDiamondDetails = safeJSON(req.body.sideDiamondDetails, {});

    const pricing = await Pricing.findOne();

    // ⭐ FIX: Normalize diamondDetails
    const normalizedDiamond = {
      carat: Number(diamondDetails.carat || 0),
      count: Number(diamondDetails.count || 0),
      color: diamondDetails.color || "",
      clarity: diamondDetails.clarity || "",
      cut: diamondDetails.cut || "",
      pricePerCarat: Number(diamondDetails.pricePerCarat || pricing?.diamondPricePerCarat || 0),
      useAuto: diamondDetails.useAuto !== false,
    };

    // ⭐ FIX: Normalize sideDiamondDetails
    const normalizedSideDiamonds = (Array.isArray(sideDiamondDetails) ? sideDiamondDetails : []).map(sd => ({
      carat: Number(sd.carat || 0),
      count: Number(sd.count || 0),
      color: sd.color || "",
      clarity: sd.clarity || "",
      cut: sd.cut || "",
      pricePerCarat: Number(sd.pricePerCarat || pricing?.diamondPricePerCarat || 0),
      useAuto: sd.useAuto !== false,
    }));



    // // 1️⃣ GOLD PRICE
    // let goldRate = 0;


    // const metalData = metal || {};


    // // ⭐ FIX: Safe purity extraction
    // const extractPurity = (value) => {
    //   if (!value) return null;
    //   const match = value.toUpperCase().match(/(\d+K)/);
    //   return match ? match[1] : null;
    // };

    // const purity =
    //   extractPurity(metalData.purity) || extractPurity(metalData.metalType);


    // // Find rate
    // if (purity && pricing?.goldPrices instanceof Map) {
    //   goldRate = Number(pricing.goldPrices.get(purity) || 0);
    // } else if (purity && pricing?.goldPrices) {
    //   // in case mongoose converts Map to plain object (rare cases)
    //   goldRate = Number(pricing.goldPrices[purity] || 0);
    // }


    // const goldTotal = Number(metalData.weight || 0) * goldRate;

    // 1️⃣ METAL PRICE (GOLD / PLATINUM / SILVER / VERMEIL)
    let metalRate = 0;
    const metalData = metal || {};

    // Extract purity for 14K / 18K / 22K
    const extractPurity = (value) => {
      if (!value) return null;
      const match = value.toUpperCase().match(/(\d+K)/);
      return match ? match[1] : null;
    };

    const purity =
      extractPurity(metalData.purity) || extractPurity(metalData.metalType);

    // ---------------- GOLD (14K / 18K / 22K) ----------------
    if (purity) {
      if (pricing.goldPrices instanceof Map) {
        metalRate = Number(pricing.goldPrices.get(purity) || 0);
      } else {
        metalRate = Number(pricing.goldPrices?.[purity] || 0);
      }
    }

    // ---------------- PLATINUM ----------------
    else if (metalData.metalType === "Platinum") {
      metalRate = Number(pricing.platinumPricePerGram || 0);
    }

    // ---------------- 925 STERLING SILVER ----------------
    else if (metalData.metalType === "925 Sterling Silver") {
      metalRate = Number(pricing.silver925PricePerGram || 0);
    }

    // ---------------- GOLD VERMEIL ----------------
    else if (metalData.metalType === "Gold Vermeil") {
      if (pricing.goldVermeilPricePerGram > 0) {
        metalRate = Number(pricing.goldVermeilPricePerGram);
      } else {
        // auto formula
        const silver = pricing.silver925PricePerGram || 0;
        const gold18 = pricing.goldPrices.get("18K") || 0;
        metalRate = silver + gold18 * 0.05;
      }
    }

    // final metal cost
    const goldTotal = Number(metalData.weight || 0) * metalRate;



    // ⭐ Use normalized objects for price calculation

    // NEW: Manual diamond totals from client
    const manualMainDiamondTotal = Number(req.body.mainDiamondTotal || 0);
    const manualSideDiamondTotal = Number(req.body.sideDiamondTotal || 0);

    const main = normalizedDiamond;

    // compute auto main total
    const autoMainTotal =
      Number(main.carat || 0) *
      Number(main.count || 0) *
      Number(main.pricePerCarat || pricing?.diamondPricePerCarat || 0);

    // compute auto side total
    const autoSideTotal = normalizedSideDiamonds.reduce((sum, sd) => {
      const ppc = Number(sd.pricePerCarat || pricing?.diamondPricePerCarat || 0);
      return sum + Number(sd.carat || 0) * Number(sd.count || 0) * ppc;
    }, 0);

    // Use manual totals if provided (> 0), otherwise use auto totals
    const mainTotal = manualMainDiamondTotal > 0 ? manualMainDiamondTotal : autoMainTotal;
    const sideTotal = manualSideDiamondTotal > 0 ? manualSideDiamondTotal : autoSideTotal;




    // 4️⃣ STONES
    // 4️⃣ GEMSTONES (AUTO PRICE USING NORMALIZED GEMSTONES)
    let gemstonesTotal = 0;

    normalizedGemstones.forEach((st) => {
      const stoneType = st.stoneType;
      const carat = Number(st.carat || 0);
      const count = Number(st.count || 1);

      let rate = 0;

      if (pricing?.gemstonePrices instanceof Map) {
        rate = Number(pricing.gemstonePrices.get(stoneType) || 0);
      } else {
        rate = Number(pricing?.gemstonePrices?.[stoneType] || 0);
      }

      gemstonesTotal += rate * carat * count;
    });



    // 5️⃣ MAKING CHARGES
    const making = Number(req.body.makingCharges || 0);


    // 6️⃣ FINAL PRICE
    const autoPrice =
      goldTotal +
      mainTotal +
      sideTotal +
      gemstonesTotal +
      making;


    console.log("DEBUG Backend Pricing:");
    console.log("Purity:", purity);
    console.log("GoldRate:", metalRate);
    console.log("GoldTotal:", goldTotal);
    console.log("MainDiamondTotal:", mainTotal);
    console.log("SideDiamonds:", sideTotal);
    console.log("Stones:", gemstonesTotal);
    console.log("Making:", making);
    console.log("FINAL AUTO PRICE:", autoPrice);

    let originalPrice = Number(req.body.originalPrice || 0);

    // If frontend did not send original price, or sent wrong one
    if (!originalPrice || originalPrice < autoPrice) {
      originalPrice = autoPrice;
    }

    // Auto-calc discount
    let discount = 0;
    if (originalPrice > 0) {
      discount = Math.round(((originalPrice - autoPrice) / originalPrice) * 100);
    }


    /* -----------------------------------------
       Create product
    ------------------------------------------ */
    const product = await Ornament.create({
      name: req.body.name,
      description: req.body.description || "",

      categoryType: req.body.categoryType,
      category: req.body.category,
      subCategory: req.body.subCategory || null,

      gender: req.body.gender,

      isVariant,
      parentProduct: isVariant ? req.body.parentProduct : null,
      variantLabel: req.body.variantLabel || "",

      metal,
      gemstoneDetails: normalizedGemstones,

      diamondDetails: normalizedDiamond,
      sideDiamondDetails: normalizedSideDiamonds,

      mainDiamondTotal: mainTotal,
      sideDiamondTotal: sideTotal,


      price: autoPrice,
      originalPrice: originalPrice,
      discount: discount,



      makingCharges: Number(req.body.makingCharges) || 0,
      prices,
      makingChargesByCountry,

      coverImage,
      images,
      model3D,
      videoUrl,

      stock: Number(req.body.stock) || 1,
      isFeatured: req.body.isFeatured === "true" || req.body.isFeatured === true,

      color: req.body.color || "",
      size: req.body.size || "",
    });

    console.log("🟢 PRODUCT CREATED:", product);

    return res.status(201).json({
      success: true,
      message: isVariant ? "Variant product created" : "Base product created",
      product,
    });

  } catch (err) {
    console.error("❌ ADD PRODUCT ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: err.message,
    });
  }
};





// ✅ Get All Ornaments (with filters)
// export const getOrnaments = async (req, res) => {
//   try {
//     const {
//       gender,
//       category,
//       subCategory,
//       type,
//       minPrice,
//       maxPrice,
//       search,
//       sort,
//       page = 1,
//       limit = 10,
//       currency = "INR",
//       includeVariants = false,
//     } = req.query;



//     const curr = currency.toUpperCase();
//     const skip = (Number(page) - 1) * Number(limit);

//     /* =====================================================
//        1. BUILD FILTER
//     ====================================================== */
//     let filter = {};

//     if (gender) filter.gender = gender;

//     if (category) {
//       filter.category = {
//         $in: Array.isArray(category)
//           ? category
//           : category.split(",").map((c) => c.trim()),
//       };
//     }

//     if (subCategory) {
//       filter.subCategory = {
//         $in: Array.isArray(subCategory)
//           ? subCategory
//           : subCategory.split(",").map((s) => s.trim()),
//       };
//     }

//     if (type) filter.type = type;

//     // 🔥 Price filter must fallback to INR if foreign currency doesn't exist
//     if (minPrice || maxPrice) {
//       filter.$or = [
//         { [`prices.${curr}.amount`]: {} },
//         { [`prices.INR.amount`]: {} }, // fallback for products missing foreign currency
//       ];

//       if (minPrice) {
//         filter.$or[0][`prices.${curr}.amount`].$gte = Number(minPrice);
//         filter.$or[1][`prices.INR.amount`].$gte = Number(minPrice);
//       }

//       if (maxPrice) {
//         filter.$or[0][`prices.${curr}.amount`].$lte = Number(maxPrice);
//         filter.$or[1][`prices.INR.amount`].$lte = Number(maxPrice);
//       }
//     }

//     if (search) {
//       filter.$or = [
//         { name: { $regex: search, $options: "i" } },
//         { description: { $regex: search, $options: "i" } },
//       ];
//     }

//     // Hide variants unless explicitly asked
//     if (!includeVariants || includeVariants === "false") {
//       filter.isVariant = false;
//     }

//     /* =====================================================
//        2. SORTING (fallback to INR if foreign mapping missing)
//     ====================================================== */
//     let sortOption = { createdAt: -1 };

//     if (sort === "price_asc") {
//       sortOption = {
//         [`prices.${curr}.amount`]: 1,
//         "prices.INR.amount": 1, // fallback
//       };
//     }

//     if (sort === "price_desc") {
//       sortOption = {
//         [`prices.${curr}.amount`]: -1,
//         "prices.INR.amount": -1, // fallback
//       };
//     }

//     if (sort === "newest") sortOption = { createdAt: -1 };
//     if (sort === "oldest") sortOption = { createdAt: 1 };

//     /* =====================================================
//        3. FETCH MAIN PRODUCTS
//     ====================================================== */
//     const ornaments = await Ornament.find(filter)
//       .sort(sortOption)
//       .skip(skip)
//       .limit(Number(limit))
//       .lean();

//     const total = await Ornament.countDocuments(filter);

//     /* =====================================================
//        4. COLLECT VARIANT IDs
//     ====================================================== */
//     const allVariantIds = ornaments
//       .filter((o) => !o.isVariant)
//       .flatMap((o) => Object.values(o.variants || {}));

//     const allVariants = await Ornament.find({
//       _id: { $in: allVariantIds },
//     }).lean();

//     const variantMap = {};
//     allVariants.forEach((v) => (variantMap[v._id] = v));

//     /* =====================================================
//        5. TRANSFORM RESULTS
//     ====================================================== */
//     const transformed = ornaments.map((orn) => {
//       /* -----------------------------
//          BASE PRODUCT
//       ------------------------------ */
//       if (!orn.isVariant) {
//         const variantIds = Object.values(orn.variants || {});
//         const productVariants = variantIds
//           .map((id) => variantMap[id])
//           .filter(Boolean);

//         let startingPrice = null;
//         let currencySymbol = currency === "INR" ? "₹" : null;

//         productVariants.forEach((v) => {
//           let price;

//           if (v.prices?.[curr]) {
//             price = v.prices[curr].amount;
//             currencySymbol = v.prices[curr].symbol;
//           } else {
//             price = v.prices?.INR?.amount || v.price;
//           }

//           if (startingPrice === null || price < startingPrice) {
//             startingPrice = price;
//           }
//         });

//         return {
//           ...orn,
//           isVariant: false,
//           variantCount: productVariants.length,
//           startingPrice,
//           currencySymbol,
//           displayPrice: startingPrice,
//           displayCoverImage: orn.coverImage,
//           displayImages: orn.images || [],
//         };
//       }

//       /* -----------------------------
//          VARIANT PRODUCT
//       ------------------------------ */
//       let price;
//       let currencySymbol = "₹";

//       if (orn.prices?.[curr]) {
//         price = orn.prices[curr].amount;
//         currencySymbol = orn.prices[curr].symbol;
//       } else {
//         price = orn.prices?.INR?.amount || orn.price;
//       }

//       const originalPrice = orn.originalPrice || price;
//       const discount = Math.round(((originalPrice - price) / originalPrice) * 100);

//       return {
//         ...orn,
//         isVariant: true,
//         displayPrice: price,
//         originalPrice,
//         discount: Number.isFinite(discount) ? discount : 0,
//         currencySymbol,
//         displayCoverImage: orn.coverImage,
//         displayImages: orn.images || [],
//       };
//     });

//     /* =====================================================
//        6. SEND RESPONSE
//     ====================================================== */
//     return res.json({
//       success: true,
//       page: Number(page),
//       limit: Number(limit),
//       total,
//       totalPages: Math.ceil(total / limit),
//       count: transformed.length,
//       ornaments: transformed,
//     });
//   } catch (err) {
//     console.error("❌ Get Ornaments Error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch ornaments",
//       error: err.message,
//     });
//   }
// };

// ✅ Get All Ornaments (with filters)
// export const getOrnaments = async (req, res) => {
//   try {
//     const {
//       gender,
//       category,
//       subCategory,
//       type,
//       minPrice,
//       maxPrice,
//       search,
//       sort,
//       page = 1,
//       limit = 10,
//       currency = "INR",
//       includeVariants = false,
//     } = req.query;

//     const curr = currency.toUpperCase();
//     const skip = (Number(page) - 1) * Number(limit);

//     /* =====================================================
//        1. BUILD FILTER
//     ====================================================== */
//     let filter = {};

//     if (gender) filter.gender = gender;

//     if (category) {
//       filter.category = {
//         $in: Array.isArray(category)
//           ? category
//           : category.split(",").map((c) => c.trim()),
//       };
//     }

//     if (subCategory) {
//       filter.subCategory = {
//         $in: Array.isArray(subCategory)
//           ? subCategory
//           : subCategory.split(",").map((s) => s.trim()),
//       };
//     }

//     if (type) filter.type = type;

//     if (minPrice || maxPrice) {
//       filter.$or = [
//         { [`prices.${curr}.amount`]: {} },
//         { [`prices.INR.amount`]: {} },
//       ];

//       if (minPrice) {
//         filter.$or[0][`prices.${curr}.amount`].$gte = Number(minPrice);
//         filter.$or[1][`prices.INR.amount`].$gte = Number(minPrice);
//       }
//       if (maxPrice) {
//         filter.$or[0][`prices.${curr}.amount`].$lte = Number(maxPrice);
//         filter.$or[1][`prices.INR.amount`].$lte = Number(maxPrice);
//       }
//     }

//     if (search) {
//       filter.$or = [
//         { name: { $regex: search, $options: "i" } },
//         { description: { $regex: search, $options: "i" } },
//       ];
//     }

//     if (!includeVariants || includeVariants === "false") {
//       filter.isVariant = false;
//     }

//     /* =====================================================
//        2. SORTING — ⭐ MOVED UP (IMPORTANT FIX)
//     ====================================================== */
//     let sortOption = { createdAt: -1 };

//     if (sort === "price_asc") {
//       sortOption = {
//         [`prices.${curr}.amount`]: 1,
//         "prices.INR.amount": 1,
//       };
//     }

//     if (sort === "price_desc") {
//       sortOption = {
//         [`prices.${curr}.amount`]: -1,
//         "prices.INR.amount": -1,
//       };
//     }

//     if (sort === "newest") sortOption = { createdAt: -1 };
//     if (sort === "oldest") sortOption = { createdAt: 1 };

//     /* =====================================================
//        3. FETCH MAIN PRODUCTS
//     ====================================================== */
//     const ornaments = await Ornament.find(filter)
//       .sort(sortOption)   // ✔ now sortOption is defined above
//       .skip(skip)
//       .limit(Number(limit))
//       .lean();
       

//     // -----------------------
// // NEW PRICING ENGINE
// // -----------------------
// const pricing = await Pricing.findOne().lean();

// const extractPurity = (val) => {
//   if (!val) return null;
//   const m = String(val).toUpperCase().match(/(\d+K)/);
//   return m ? m[1] : null;
// };

// const computeTotals = (item) => {
//   const metal = item.metal || {};
//   const weight = Number(metal.weight || 0);

//   const purity =
//     extractPurity(metal.purity) ||
//     extractPurity(metal.metalType) ||
//     null;

//   let metalINR = 0;

//   // 1️⃣ GOLD — 14K / 18K / 22K
//   if (purity) {
//     const gp =
//       pricing.goldPrices?.get?.(purity) ??
//       pricing.goldPrices?.[purity];
//     metalINR = weight * Number(gp || 0);
//   }

//   // 2️⃣ PLATINUM
//   else if (metal.metalType === "Platinum") {
//     metalINR = weight * Number(pricing.platinumPricePerGram || 0);
//   }

//   // 3️⃣ SILVER
//   else if (metal.metalType === "925 Sterling Silver") {
//     metalINR = weight * Number(pricing.silver925PricePerGram || 0);
//   }

//   // 4️⃣ GOLD VERMEIL
//   else if (metal.metalType === "Gold Vermeil") {
//     if (pricing.goldVermeilPricePerGram > 0) {
//       metalINR = weight * Number(pricing.goldVermeilPricePerGram);
//     } else {
//       const silver = Number(pricing.silver925PricePerGram || 0);
//       const gold18 = Number(
//         (pricing.goldPrices?.get?.("18K") ??
//           pricing.goldPrices?.["18K"]) || 0
//       );
//       metalINR = weight * (silver + gold18 * 0.05);
//     }
//   }

//   // DIAMONDS
//   const mainDiamond = Number(item.mainDiamondTotal || 0);
//   const sideDiamond = Number(item.sideDiamondTotal || 0);

//   // GEMSTONES
//   let gemstonesINR = 0;
//   (item.gemstoneDetails || []).forEach((st) => {
//     const type = st.stoneType || "";
//     const rate = pricing?.gemstonePrices?.[type] || 0;
//     gemstonesINR += rate * Number(st.carat || 0) * Number(st.count || 1);
//   });

//   const basePrice = metalINR + mainDiamond + sideDiamond + gemstonesINR;

//   return { metalINR, mainDiamond, sideDiamond, gemstonesINR, basePrice };
// };

    

//     const total = await Ornament.countDocuments(filter);

//     /* =====================================================
//        4. COLLECT VARIANT IDs
//     ====================================================== */
//     const allVariantIds = ornaments
//       .filter((o) => !o.isVariant)
//       .flatMap((o) => Object.values(o.variants || {}));

//     const allVariants = await Ornament.find({
//       _id: { $in: allVariantIds },
//     }).lean();

//     const variantMap = {};
//     allVariants.forEach((v) => (variantMap[v._id] = v));

//     /* =====================================================
//        5. TRANSFORM RESULTS
//     ====================================================== */
//     const transformed = ornaments.map((orn) => {
//       if (!orn.isVariant) {
//         const variantIds = Object.values(orn.variants || {});
//         const productVariants = variantIds
//           .map((id) => variantMap[id])
//           .filter(Boolean);

//         let startingPrice = null;
//         let currencySymbol = currency === "INR" ? "₹" : null;

//         productVariants.forEach((v) => {
//          const totals = computeTotals(v);
// const rate = currencyRates[curr].rate;

// const convertedBase = totals.basePrice * rate;
// const convertedMaking = Number(v.makingCharges || 0) * rate;

// const price = convertedBase + convertedMaking;
// const currencySymbol = currencyRates[curr].symbol;


//           if (startingPrice === null || price < startingPrice) {
//             startingPrice = price;
//           }
//         });

//         return {
//           ...orn,
//           isVariant: false,
//           variantCount: productVariants.length,
//           startingPrice,
//           currencySymbol,
//           displayPrice: startingPrice,
//           displayCoverImage: orn.coverImage,
//           displayImages: orn.images || [],
//         };
//       }

//       let price;
//       let currencySymbol = "₹";

//       if (orn.prices?.[curr]) {
//         price = orn.prices[curr].amount;
//         currencySymbol = orn.prices[curr].symbol;
//       } else {
//         price = orn.prices?.INR?.amount || orn.price;
//       }

//       const originalPrice = orn.originalPrice || price;
//       const discount = Math.round(((originalPrice - price) / originalPrice) * 100);

//       return {
//         ...orn,
//         isVariant: true,
//         displayPrice: price,
//         originalPrice,
//         discount: Number.isFinite(discount) ? discount : 0,
//         currencySymbol,
//         displayCoverImage: orn.coverImage,
//         displayImages: orn.images || [],
//       };
//     });

//     /* =====================================================
//        6. SEND RESPONSE
//     ====================================================== */
//     return res.json({
//       success: true,
//       page: Number(page),
//       limit: Number(limit),
//       total,
//       totalPages: Math.ceil(total / limit),
//       count: transformed.length,
//       ornaments: transformed,
//     });
//   } catch (err) {
//     console.error("❌ Get Ornaments Error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch ornaments",
//       error: err.message,
//     });
//   }
// };

export const getOrnaments = async (req, res) => {
  try {
    const {
      gender,
      category,
      subCategory,
      type,
      minPrice,
      maxPrice,
      search,
      sort,
      page = 1,
      limit = 10,
      currency = "INR",
      includeVariants = false,
    } = req.query;

    const curr = currency.toUpperCase();
    const skip = (Number(page) - 1) * Number(limit);

    /* ⭐ FIX 1 — Add missing currencyRates */
    const currencyRates = {
      INR: { rate: 1, symbol: "₹" },
      USD: { rate: 0.012, symbol: "$" },
      GBP: { rate: 0.0095, symbol: "£" },
      CAD: { rate: 0.016, symbol: "CA$" },
      EUR: { rate: 0.011, symbol: "€" },
      AED: { rate: 0.009, symbol: "د.إ" },
      AUD: { rate: 0.018, symbol: "A$" },
      SGD: { rate: 0.016, symbol: "S$" },
      JPY: { rate: 1.8, symbol: "¥" }
    };

    /* =====================================================
       1. BUILD FILTER
    ====================================================== */
    let filter = {};

    if (gender) filter.gender = gender;

    if (category) {
      filter.category = {
        $in: Array.isArray(category)
          ? category
          : category.split(",").map((c) => c.trim()),
      };
    }

    if (subCategory) {
      filter.subCategory = {
        $in: Array.isArray(subCategory)
          ? subCategory
          : subCategory.split(",").map((s) => s.trim()),
      };
    }

    if (type) filter.type = type;

    if (minPrice || maxPrice) {
      filter.$or = [
        { [`prices.${curr}.amount`]: {} },
        { [`prices.INR.amount`]: {} },
      ];

      if (minPrice) {
        filter.$or[0][`prices.${curr}.amount`].$gte = Number(minPrice);
        filter.$or[1][`prices.INR.amount`].$gte = Number(minPrice);
      }
      if (maxPrice) {
        filter.$or[0][`prices.${curr}.amount`].$lte = Number(maxPrice);
        filter.$or[1][`prices.INR.amount`].$lte = Number(maxPrice);
      }
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (!includeVariants || includeVariants === "false") {
      filter.isVariant = false;
    }

    /* =====================================================
       2. SORTING
    ====================================================== */
    let sortOption = { createdAt: -1 };

    if (sort === "price_asc") {
      sortOption = {
        [`prices.${curr}.amount`]: 1,
        "prices.INR.amount": 1,
      };
    }

    if (sort === "price_desc") {
      sortOption = {
        [`prices.${curr}.amount`]: -1,
        "prices.INR.amount": -1,
      };
    }

    if (sort === "newest") sortOption = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };

    /* =====================================================
       3. FETCH MAIN PRODUCTS
    ====================================================== */
    const ornaments = await Ornament.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const pricing = await Pricing.findOne().lean();

    const extractPurity = (val) => {
      if (!val) return null;
      const m = String(val).toUpperCase().match(/(\d+K)/);
      return m ? m[1] : null;
    };

    const computeTotals = (item) => {
      const metal = item.metal || {};
      const weight = Number(metal.weight || 0);

      const purity =
        extractPurity(metal.purity) ||
        extractPurity(metal.metalType) ||
        null;

      let metalINR = 0;

      // GOLD
      if (purity) {
        const gp =
          pricing.goldPrices?.get?.(purity) ??
          pricing.goldPrices?.[purity];
        metalINR = weight * Number(gp || 0);
      }

      // PLATINUM
      else if (metal.metalType === "Platinum") {
        metalINR = weight * Number(pricing.platinumPricePerGram || 0);
      }

      // SILVER
      else if (metal.metalType === "925 Sterling Silver") {
        metalINR = weight * Number(pricing.silver925PricePerGram || 0);
      }

      // VERMEIL
      else if (metal.metalType === "Gold Vermeil") {
        if (pricing.goldVermeilPricePerGram > 0) {
          metalINR = weight * Number(pricing.goldVermeilPricePerGram);
        } else {
          const silver = Number(pricing.silver925PricePerGram || 0);
          const gold18 = Number(
            (pricing.goldPrices?.get?.("18K") ??
              pricing.goldPrices?.["18K"]) || 0
          );
          metalINR = weight * (silver + gold18 * 0.05);
        }
      }

      const mainDiamond = Number(item.mainDiamondTotal || 0);
      const sideDiamond = Number(item.sideDiamondTotal || 0);

      let gemstonesINR = 0;
      (item.gemstoneDetails || []).forEach((st) => {
        const type = st.stoneType || "";
        const rate = pricing?.gemstonePrices?.[type] || 0;
        gemstonesINR += rate * Number(st.carat || 0) * Number(st.count || 1);
      });

      const basePrice = metalINR + mainDiamond + sideDiamond + gemstonesINR;

      return { metalINR, mainDiamond, sideDiamond, gemstonesINR, basePrice };
    };

    const total = await Ornament.countDocuments(filter);

    /* =====================================================
       4. COLLECT VARIANT IDs
    ====================================================== */
    const allVariantIds = ornaments
      .filter((o) => !o.isVariant)
      .flatMap((o) => Object.values(o.variants || {}));

    const allVariants = await Ornament.find({
      _id: { $in: allVariantIds },
    }).lean();

    const variantMap = {};
    allVariants.forEach((v) => (variantMap[v._id] = v));

    /* =====================================================
       5. TRANSFORM RESULTS
    ====================================================== */
    const transformed = ornaments.map((orn) => {
      /* --------------------------
         MAIN PRODUCT
      -------------------------- */
      if (!orn.isVariant) {
        const variantIds = Object.values(orn.variants || {});
        const productVariants = variantIds
          .map((id) => variantMap[id])
          .filter(Boolean);

        let startingPrice = null;

        let currencySymbol = currencyRates[curr].symbol;  // ⭐ FIX moved

        productVariants.forEach((v) => {
          const totals = computeTotals(v);
          const rate = currencyRates[curr].rate;

          const convertedBase = totals.basePrice * rate;
          const convertedMaking = Number(v.makingCharges || 0) * rate;

          const price = convertedBase + convertedMaking;

          if (startingPrice === null || price < startingPrice) {
            startingPrice = price;
          }
        });

        return {
          ...orn,
          isVariant: false,
          variantCount: productVariants.length,
          startingPrice,
          currencySymbol,
          displayPrice: startingPrice,
          displayCoverImage: orn.coverImage,
          displayImages: orn.images || [],
        };
      }

      /* --------------------------
         VARIANT PRODUCT
      -------------------------- */

      // ⭐ FIX 3 — Replace old broken price logic
      const totals = computeTotals(orn);
      const rate = currencyRates[curr].rate;

      const convertedBase = totals.basePrice * rate;
      const convertedMaking = Number(orn.makingCharges || 0) * rate;

      const price = convertedBase + convertedMaking;  // ⭐ FIXED
      const currencySymbol = currencyRates[curr].symbol; // ⭐ FIXED

      const originalPrice = orn.originalPrice || price;
      const discount = Math.round(((originalPrice - price) / originalPrice) * 100);

      return {
        ...orn,
        isVariant: true,
        displayPrice: price,
        originalPrice,
        discount: Number.isFinite(discount) ? discount : 0,
        currencySymbol,
        displayCoverImage: orn.coverImage,
        displayImages: orn.images || [],
      };
    });

    /* =====================================================
       6. SEND RESPONSE
    ====================================================== */
    return res.json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
      count: transformed.length,
      ornaments: transformed,
    });
  } catch (err) {
    console.error("❌ Get Ornaments Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ornaments",
      error: err.message,
    });
  }
};







// -----------------------------------------------------
// PRICE CONVERTER
// -----------------------------------------------------
export const getOrnamentById = async (req, res) => {
  try {
    const { id } = req.params;
    const curr = (req.query.currency || "INR").toUpperCase();

    const currencyRates = {
      INR: { rate: 1, symbol: "₹" },
      USD: { rate: 0.012, symbol: "$" },
      GBP: { rate: 0.0095, symbol: "£" },
      CAD: { rate: 0.016, symbol: "CA$" },
      EUR: { rate: 0.011, symbol: "€" },
      AED: { rate: 0.009, symbol: "د.إ" },
      AUD: { rate: 0.018, symbol: "A$" },
      SGD: { rate: 0.016, symbol: "S$" },
      JPY: { rate: 1.8, symbol: "¥" }
    };
    const selectedCurrency = currencyRates[curr] || currencyRates.INR;

    /* -------------------------------------------
       FETCH PRODUCT
    ------------------------------------------- */
    let ornament = await Ornament.findById(id).lean();

    /* -----------------------------------------------------------
   ⭐ PATCH: Normalize Metal, Main Diamond, Side Diamonds, Stones
------------------------------------------------------------ */

    // ⭐ Normalize metal
    ornament.metal = {
      weight: Number(ornament.metal?.weight || 0),
      purity: ornament.metal?.purity || "",
      metalType: ornament.metal?.metalType || "",
    };

    // ⭐ Normalize main diamond details
    let diamond = ornament.diamondDetails || null;

    if (diamond) {
      diamond = {
        carat: Number(diamond.carat || 0),
        count: Number(diamond.count || 0),
        color: diamond.color || "",
        clarity: diamond.clarity || "",
        cut: diamond.cut || "",
        pricePerCarat: Number(diamond.pricePerCarat || 0),
        useAuto: diamond.useAuto !== false,
      };
    } else {
      diamond = {
        carat: 0,
        count: 0,
        color: "",
        clarity: "",
        cut: "",
        pricePerCarat: 0,
        useAuto: true,
      };
    }

    ornament.diamondDetails = diamond;

    // ⭐ Normalize side diamonds array
    let side = Array.isArray(ornament.sideDiamondDetails)
      ? ornament.sideDiamondDetails
      : [];

    side = side.map((sd) => ({
      carat: Number(sd.carat || 0),
      count: Number(sd.count || 0),
      color: sd.color || "",
      clarity: sd.clarity || "",
      cut: sd.cut || "",
      pricePerCarat: Number(sd.pricePerCarat || 0),
      useAuto: sd.useAuto !== false,
    }));

    ornament.sideDiamondDetails = side;

    // ⭐ Normalize stones (gemstones)

    if (!Array.isArray(ornament.gemstoneDetails)) {
      ornament.gemstoneDetails = [];
    } else {
      ornament.gemstoneDetails = ornament.gemstoneDetails.map((st) => ({
        stoneType: st.stoneType || "",
        carat: Number(st.carat || 0),
        count: Number(st.count || 1),
        color: st.color || "",
        clarity: st.clarity || "",
        cut: st.cut || "",
        pricePerCarat: Number(st.pricePerCarat || 0),
        useAuto: st.useAuto !== false,
      }));
    }


    // ⭐ Normalize price fields
    ornament.price = Number(ornament.price || 0);
    ornament.originalPrice = Number(ornament.originalPrice || ornament.price);
    ornament.makingCharges = Number(ornament.makingCharges || 0);
    ornament.discount = Number(ornament.discount || 0);

    if (!ornament)
      return res.status(404).json({ success: false, message: "Not found" });

    /* -------------------------------------------
       NORMALIZE VARIANT IDs
       Accepts ObjectId objects, strings, or {$oid: "..."} shapes.
       Result: ornament.variants will only contain valid hex string ids.
    ------------------------------------------- */

    const normalizedVariants = {};
    if (ornament.variants && typeof ornament.variants === "object") {
      for (const [label, value] of Object.entries(ornament.variants)) {
        let candidate = null;

        // If it's an actual ObjectId instance (bson), call toString()
        if (value && typeof value === "object" && value._bsontype === "ObjectId") {
          candidate = value.toString();
        }

        // If it's a plain string that's a valid ObjectId, use it
        else if (typeof value === "string" && isValidObjectId(value)) {
          candidate = value;
        }

        // Some shapes may be like { $oid: "..." } or other object wrappers
        // Try to extract a potential id using toString() or value.$oid
        else if (value && typeof value === "object") {
          if (typeof value.toString === "function") {
            const s = value.toString();
            if (isValidObjectId(s)) candidate = s;
          }
          if (!candidate && value.$oid && typeof value.$oid === "string" && isValidObjectId(value.$oid)) {
            candidate = value.$oid;
          }
        }

        // Only include valid ids
        if (candidate && isValidObjectId(candidate)) {
          normalizedVariants[label] = candidate;
        }
      }
    }

    ornament.variants = normalizedVariants;


    /* -------------------------------------------
   GOLD + DIAMOND + STONE TOTAL CALCULATION
   (INR → then converted based on currency)
------------------------------------------- */

    const pricing = await Pricing.findOne().lean(); // Make sure Pricing is imported

    // Extract purity from "18K", "22K"
    const extractPurity = (val) => {
      if (!val) return null;
      const m = String(val).toUpperCase().match(/(\d+K)/);
      return m ? m[1] : null;
    };

    const computeTotals = (item) => {
      const metal = item.metal || {};
      const weight = Number(metal.weight || 0);

      const purity =
        extractPurity(metal.purity) ||
        extractPurity(metal.metalType) ||
        null;

      // Gold/gm price from database
      let goldRate = 0;
      if (purity && pricing?.goldPrices) {
        const gp =
          pricing.goldPrices.get?.(purity) ??
          pricing.goldPrices[purity];

        goldRate = Number(gp || 0);
      }

     let metalINR = 0;

// 1️⃣ GOLD TYPES (14K / 18K / 22K)
if (purity) {
  const gp =
    pricing.goldPrices.get?.(purity) ??
    pricing.goldPrices[purity];

  metalINR = weight * Number(gp || 0);
}

// 2️⃣ PLATINUM
else if (metal.metalType === "Platinum") {
  metalINR = weight * Number(pricing.platinumPricePerGram || 0);
}

// 3️⃣ 925 STERLING SILVER
else if (metal.metalType === "925 Sterling Silver") {
  metalINR = weight * Number(pricing.silver925PricePerGram || 0);
}

// 4️⃣ GOLD VERMEIL
else if (metal.metalType === "Gold Vermeil") {
  if (pricing.goldVermeilPricePerGram > 0) {
    metalINR = weight * Number(pricing.goldVermeilPricePerGram);
  } else {
    // fallback formula
    const silver = Number(pricing.silver925PricePerGram || 0);
   const gold18 = Number(
  (pricing.goldPrices?.get?.("18K") ?? pricing.goldPrices?.["18K"]) || 0
);

    metalINR = weight * (silver + gold18 * 0.05);
  }
}





      // MAIN DIAMOND — manual override first
      let mainDiamondINR = 0;

      // IMPORTANT: check if field actually exists in DB, not value > 0
      if (item.mainDiamondTotal !== undefined && item.mainDiamondTotal !== null) {
        // use stored override
        mainDiamondINR = Number(item.mainDiamondTotal);
      } else {
        // fallback auto calculation
        const d = item.diamondDetails || {};
        const manualPPC = Number(d.pricePerCarat || 0);
        const globalPPC = Number(pricing?.diamondPricePerCarat || 0);

        const diamondRate = manualPPC > 0 ? manualPPC : globalPPC;

        mainDiamondINR =
          Number(d.carat || 0) *
          Number(d.count || 0) *
          diamondRate;
      }




      // SIDE DIAMONDS — manual override first
      let sideDiamondINR = 0;

      if (item.sideDiamondTotal !== undefined && item.sideDiamondTotal !== null) {
        sideDiamondINR = Number(item.sideDiamondTotal);
      } else {
        sideDiamondINR = (item.sideDiamondDetails || []).reduce((sum, sd) => {
          const manualPPC = Number(sd.pricePerCarat || 0);
          const globalPPC = Number(pricing?.diamondPricePerCarat || 0);
          const rate = manualPPC > 0 ? manualPPC : globalPPC;

          return sum + Number(sd.carat || 0) * Number(sd.count || 0) * rate;
        }, 0);
      }




      // Stones
      // Gemstones price (auto)
      let gemstonesINR = 0;

      (item.gemstoneDetails || []).forEach((st) => {
        const type = st.stoneType || "";
        const rate =
          pricing?.gemstonePrices?.[type] ??
          0;

        gemstonesINR += rate * Number(st.carat || 0) * Number(st.count || 1);
      });


  const baseINR = metalINR + mainDiamondINR + sideDiamondINR + gemstonesINR;



      return {
        goldTotal: metalINR,
        mainDiamondTotal: mainDiamondINR,
        sideDiamondTotal: sideDiamondINR,
        gemstonesTotal: gemstonesINR,
        basePrice: baseINR,
      };

    };

    const getCountryPrice = (item, curr) => {
      const p = item.prices?.[curr];
      return p?.amount ? Number(p.amount) : Number(item.price); // fallback
    };

    const getCountryMaking = (item, curr) => {
      const m = item.makingChargesByCountry?.[curr];
      return m?.amount ? Number(m.amount) : Number(item.makingCharges);
    };

    const convertUsingDB = (item, curr, totals) => {
      const rate = selectedCurrency.rate;
      const symbol = selectedCurrency.symbol;

      const displayPrice = totals.basePrice * rate;
      const convertedMaking = Number(item.makingCharges || 0) * rate;

      return {
        // ...item,
        // ...totals,
        // displayPrice,
        // convertedMakingCharge: convertedMaking,
        // totalConvertedPrice: displayPrice + convertedMaking,
        // currency: symbol
        ...item,

        price: totals.basePrice,

        //  Always override totals with computed values
        goldTotal: totals.goldTotal,
        mainDiamondTotal: totals.mainDiamondTotal,
        sideDiamondTotal: totals.sideDiamondTotal,
        gemstonesTotal: totals.gemstonesTotal,
        basePrice: totals.basePrice,

        //  Currency-calculated values
        displayPrice,
        convertedMakingCharge: convertedMaking,
        totalConvertedPrice: displayPrice + convertedMaking,
        currency: symbol,

      };
    };




    // 🔥 Attach totals to main product
    ornament = { ...ornament, ...computeTotals(ornament) };


    /* -------------------------------------------
       CASE 1 — VARIANT PRODUCT
    ------------------------------------------- */
    // if (ornament.isVariant) {
    //   const converted = convertPricing(ornament, curr, selectedCurrency);
    //   return res.json({
    //     success: true,
    //     type: "variant",
    //     ornament: converted
    //   });
    // }

    if (ornament.isVariant) {
      const totals = computeTotals(ornament);

      const converted = convertUsingDB(ornament, curr, totals);

      return res.json({
        success: true,
        type: "variant",
        ornament: converted
      });
    }


    /* -------------------------------------------
       CASE 2 — MAIN PRODUCT
    ------------------------------------------- */

    // SAFE collected IDs as an array of validated hex strings
    const variantIds = Object.values(ornament.variants).filter((x) =>
      isValidObjectId(x)
    );

    // Fetch linked variants
    let variants = [];
    if (variantIds.length) {
      variants = await Ornament.find({ _id: { $in: variantIds } }).lean();
    }

    // Also fetch variants using parentProduct
    const directVariants = await Ornament.find({
      parentProduct: ornament._id,
      isVariant: true
    }).lean();

    // Merge without duplicates
    const allVariants = [
      ...variants,
      ...directVariants.filter(
        (dv) => !variants.some((v) => v._id.toString() === dv._id.toString())
      )
    ];

    const convertedVariants = allVariants.map((v) => {
      const totals = computeTotals(v);
      const converted = convertUsingDB(v, curr, totals);
      return { ...converted, ...totals };
    });


    const totals = computeTotals(ornament);
    const converted = convertUsingDB(ornament, curr, totals);



    // Final total = price + making
    const finalTotal =
      Number(converted.displayPrice || 0) +
      Number(converted.convertedMakingCharge || 0);



    /* -------------------------------------------
       RESPONSE
    ------------------------------------------- */
    return res.json({
      success: true,
      type: "main",
      ornament: {
        ...converted,
        variants: convertedVariants,
        startingPrice:
          convertedVariants.length > 0
            ? Math.min(
              ...convertedVariants.map(
                (v) =>
                  Number(v.displayPrice || 0) +
                  Number(v.convertedMakingCharge || 0)
              )
            )
            : null
      }
    });

  } catch (err) {
    console.error("❌ getOrnamentById Error:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching ornament",
      error: err.message
    });
  }
};




// =======================================
// 🔵 GET MAIN PRODUCT (with variant summaries)
// =======================================
export const getMainProduct = async (req, res) => {
  try {
    const { currency = "INR" } = req.query;
    const curr = currency.toUpperCase();

    const mainId = req.params.id;

    const main = await Ornament.findById(mainId).lean();

    if (!main || main.isVariant) {
      return res.status(404).json({
        success: false,
        message: "Main product not found",
      });
    }

    // Extract variant IDs (stored as { metalType: ObjectId })
    const variantIds = Object.values(main.variants || {});

    const variants = await Ornament.find({
      _id: { $in: variantIds }
    })
      .select(
        "metalType size color price originalPrice discount coverImage prices makingCharges makingChargesByCountry"
      )
      .lean();

    // Prepare compact variant summary
    const variantSummary = variants.map((v) => {
      let price = v.price;
      let symbol = "₹";

      if (v.prices?.[curr]) {
        price = v.prices[curr].amount;
        symbol = v.prices[curr].symbol;
      } else if (currencyRates[curr]) {
        price = Number((v.price * currencyRates[curr].rate).toFixed(2));
        symbol = currencyRates[curr].symbol;
      }

      const originalPrice = v.originalPrice || price;
      const discount =
        v.discount ||
        Math.round(((originalPrice - price) / originalPrice) * 100) ||
        0;

      return {
        _id: v._id,
        metalType: v.metalType,
        size: v.size,
        color: v.color,
        displayPrice: price,
        currency: symbol,
        discount,
        coverImage: v.coverImage,
      };
    });

    // Main product response
    return res.json({
      success: true,
      mainProduct: {
        ...main,
        variants: variantSummary,
      },
    });
  } catch (err) {
    console.error("❌ getMainProduct Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// =======================================
// 🔴 GET VARIANT PRODUCT (full details)
// =======================================
export const getVariantProduct = async (req, res) => {
  try {
    const { currency = "INR" } = req.query;
    const curr = currency.toUpperCase();

    const variantId = req.params.id;

    const variant = await Ornament.findById(variantId).lean();

    if (!variant || !variant.isVariant) {
      return res.status(404).json({
        success: false,
        message: "Variant product not found",
      });
    }

    // Currency conversion
    let finalPrice = variant.price;
    let symbol = "₹";

    if (variant.prices?.[curr]) {
      finalPrice = variant.prices[curr].amount;
      symbol = variant.prices[curr].symbol;
    } else if (currencyRates[curr]) {
      finalPrice = Number((variant.price * currencyRates[curr].rate).toFixed(2));
      symbol = currencyRates[curr].symbol;
    }

    // Making charges conversion
    let makingCharge = variant.makingCharges || 0;

    if (variant.makingChargesByCountry?.[curr]) {
      makingCharge = variant.makingChargesByCountry[curr].amount;
    } else if (currencyRates[curr]) {
      makingCharge = Number(
        (variant.makingCharges * currencyRates[curr].rate).toFixed(2)
      );
    }

    const totalConvertedPrice = Number((finalPrice + makingCharge).toFixed(2));

    const originalPrice = variant.originalPrice || finalPrice;
    const discount =
      variant.discount ||
      Math.round(((originalPrice - finalPrice) / originalPrice) * 100) ||
      0;

    const variantResponse = {
      ...variant,
      displayPrice: finalPrice,
      convertedMakingCharge: makingCharge,
      totalConvertedPrice,
      currency: symbol,
      originalPrice,
      discount,
      coverImage: variant.coverImage,
      images: variant.images || [],
      videoUrl: variant.videoUrl || null,
      model3D: variant.model3D || null,
    };

    return res.json({
      success: true,
      variant: variantResponse,
    });
  } catch (err) {
    console.error("❌ getVariantProduct Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};






// // ✅ Update Ornament
// export const updateOrnament = async (req, res) => {
//   try {
//     const ornamentId = req.params.id;

//     // Fetch existing ornament
//     const existing = await Ornament.findById(ornamentId);
//     if (!existing) {
//       return res.status(404).json({
//         success: false,
//         message: "Ornament not found",
//       });
//     }

//     const isVariant = existing.isVariant; // IMPORTANT

//     // Safe JSON
//     const parseJSON = (value, fallback = null) => {
//       try {
//         if (!value) return fallback;
//         return typeof value === "string" ? JSON.parse(value) : value;
//       } catch {
//         return fallback;
//       }
//     };

//     /* =====================================================
//        STEP 1 — BUILD UPDATE OBJECT
//     ===================================================== */
//     let updateOps = { $set: {} };

//     const body = req.body;

//     // SKU CANNOT BE UPDATED
//     if (body.sku) {
//       return res.status(400).json({
//         success: false,
//         message: "SKU cannot be updated",
//       });
//     }

//     /* =====================================================
//        STEP 2 — GENERAL FIELDS (applies to all products)
//     ===================================================== */
//     const generalFields = [
//       "name",
//       "description",
//       "categoryType",
//       "category",
//       "subCategory",
//       "gender",
//       "isFeatured",
//       "stock",
//       "color",
//       "size",
//       "variantLabel",
//     ];

//     generalFields.forEach((field) => {
//       if (body[field] !== undefined) updateOps.$set[field] = body[field];
//     });

//     /* =====================================================
//        STEP 3 — BASE PRODUCT SPECIFIC (isVariant = false)
//     ===================================================== */
//     if (!isVariant) {
//       // Updating variants map (variantLabel: variantId)
//       if (body.variants) {
//         updateOps.$set.variants = parseJSON(body.variants, existing.variants);
//       }

//       // Metal for base product
//       if (body.metal) {
//         updateOps.$set.metal = parseJSON(body.metal, existing.metal);
//       }

//       // Stones array for base product
//       if (body.stones) {
//         updateOps.$set.stones = parseJSON(body.stones, existing.stones);
//       }
//     }

//     /* =====================================================
//        STEP 4 — VARIANT PRODUCT SPECIFIC (isVariant = true)
//     ===================================================== */
//     if (isVariant) {
//       const variantNumericFields = [
//         "price",
//         "originalPrice",
//         "discount",
//         "makingCharges",
//       ];

//       variantNumericFields.forEach((field) => {
//         if (body[field] !== undefined) {
//           updateOps.$set[field] = Number(body[field]);
//         }
//       });

//       // Update metal object
//       if (body.metal) {
//         updateOps.$set.metal = parseJSON(body.metal, existing.metal);
//       }

//       // Update stones[] array
//       if (body.stones) {
//         updateOps.$set.stones = parseJSON(body.stones, existing.stones);
//       }

//       // Country specific price object
//       if (body.prices) {
//         updateOps.$set.prices = parseJSON(body.prices, existing.prices);
//       }

//       // Country specific making charges
//       if (body.makingChargesByCountry) {
//         updateOps.$set.makingChargesByCountry = parseJSON(
//           body.makingChargesByCountry,
//           existing.makingChargesByCountry
//         );
//       }

//       // Auto-discount calculation
//       const newPrice = Number(body.price) || existing.price;
//       const newOriginal = Number(body.originalPrice) || existing.originalPrice;

//       if (newOriginal > newPrice) {
//         updateOps.$set.discount = Math.round(((newOriginal - newPrice) / newOriginal) * 100);
//       }
//     }

//     /* =====================================================
//        STEP 5 — MEDIA UPLOADS (Main + Variant)
//     ===================================================== */
//     // Cover image
//     if (req.files?.coverImage?.[0]) {
//       updateOps.$set.coverImage = req.files.coverImage[0].path;
//     }

//     // Gallery replace
//     if (req.files?.images?.length) {
//       updateOps.$set.images = req.files.images.map((f) => f.path);
//     }

//     // Add extra image (front-end sends URL)
//     if (body.addImage) {
//       updateOps.$push = { images: body.addImage };
//     }

//     // Remove specific image
//     if (body.removeImage) {
//       updateOps.$pull = { images: body.removeImage };
//     }

//     // 3D model update
//     if (req.files?.model3D?.[0]) {
//       updateOps.$set.model3D = req.files.model3D[0].path;
//     }

//     // Video update
//     if (req.files?.videoFile?.[0]) {
//       updateOps.$set.videoUrl = req.files.videoFile[0].path;
//     }

//     /* =====================================================
//        STEP 6 — EXECUTE UPDATE
//     ===================================================== */
//     const updated = await Ornament.findByIdAndUpdate(ornamentId, updateOps, {
//       new: true,
//       runValidators: true,
//     });

//     return res.status(200).json({
//       success: true,
//       message: `${isVariant ? "Variant updated" : "Main product updated"} successfully`,
//       ornament: updated,
//     });
//   } catch (err) {
//     console.error("❌ Update Ornament Error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update ornament",
//       error: err.message,
//     });
//   }
// };

// ✅ Update Ornament
export const updateOrnament = async (req, res) => {
  try {
    const ornamentId = req.params.id;

    const existing = await Ornament.findById(ornamentId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Ornament not found",
      });
    }

    const isVariant = existing.isVariant;

    const parseJSON = (value, fallback = null) => {
      try {
        if (!value) return fallback;
        return typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        return fallback;
      }
    };

    /* =====================================================
       STEP 1 — BUILD UPDATE OBJECT
    ===================================================== */
    let updateOps = { $set: {} };

    const body = req.body;

    console.log("===== BACKEND RAW REQ.BODY =====");
    Object.entries(body).forEach(([k, v]) => {
      console.log(`${k}:`, v, "| type:", typeof v);
    });

    console.log("MAIN TOTAL (raw) =", body.mainDiamondTotal, "| type:", typeof body.mainDiamondTotal);
    console.log("SIDE TOTAL (raw) =", body.sideDiamondTotal, "| type:", typeof body.sideDiamondTotal);

    console.log("Number(mainDiamondTotal) =", Number(body.mainDiamondTotal));
    console.log("Number(sideDiamondTotal) =", Number(body.sideDiamondTotal));
    console.log("=================================\n");


    // ❌ Prevent SKU update
    if (body.sku) {
      return res.status(400).json({
        success: false,
        message: "SKU cannot be updated",
      });
    }

    /* =====================================================
       STEP 2 — GENERAL FIELDS (ALL PRODUCTS)
    ===================================================== */
    const generalFields = [
      "name",
      "description",
      "categoryType",
      "category",
      "subCategory",
      "gender",
      "isFeatured",
      "stock",
      "color",
      "size",
      "variantLabel",
    ];

    generalFields.forEach((field) => {
      if (body[field] !== undefined) updateOps.$set[field] = body[field];
    });

    /* =====================================================
       STEP 3 — UPDATE PRICE FIELDS (BASE + VARIANT)
    ===================================================== */
    const numericPriceFields = ["price", "originalPrice", "discount", "makingCharges"];

    numericPriceFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateOps.$set[field] = Number(body[field]);
      }
    });

    // Auto discount
    if (
      body.originalPrice !== undefined &&
      body.price !== undefined &&
      Number(body.originalPrice) > Number(body.price)
    ) {
      updateOps.$set.discount = Math.round(
        ((Number(body.originalPrice) - Number(body.price)) / Number(body.originalPrice)) * 100
      );
    }

    /* =====================================================
       STEP 4 — BOTH base + variant CAN update diamonds & gemstones
    ===================================================== */

    // METAL
    if (body.metal) {
      updateOps.$set.metal = parseJSON(body.metal, existing.metal);
    }

    // MAIN diamond
    if (body.diamondDetails) {
      updateOps.$set.diamondDetails = parseJSON(
        body.diamondDetails,
        existing.diamondDetails
      );
    }




    // SIDE diamonds
    if (body.sideDiamondDetails) {
      updateOps.$set.sideDiamondDetails = parseJSON(
        body.sideDiamondDetails,
        existing.sideDiamondDetails
      );
    }





    // GEMSTONES (correct field)
    if (body.stones) {
      updateOps.$set.gemstoneDetails = parseJSON(
        body.stones,
        existing.gemstoneDetails
      );
    }

    // /* =====================================================
    //    STEP 5 — VARIANT SPECIFIC
    // ===================================================== */
    // if (isVariant) {
    //   if (body.prices) {
    //     updateOps.$set.prices = parseJSON(body.prices, existing.prices);
    //   }

    //   if (body.makingChargesByCountry) {
    //     updateOps.$set.makingChargesByCountry = parseJSON(
    //       body.makingChargesByCountry,
    //       existing.makingChargesByCountry
    //     );
    //   }
    // }

    // /* =====================================================
    //    STEP 6 — BASE PRODUCT SPECIFIC
    // ===================================================== */
    // if (!isVariant) {
    //   if (body.variants) {
    //     updateOps.$set.variants = parseJSON(body.variants, existing.variants);
    //   }
    // }

    /* =====================================================
   STEP 5 — VARIANT SPECIFIC
===================================================== */
    if (isVariant) {
      const variantNumericFields = [
        "price",
        "originalPrice",
        "discount",
        "makingCharges",
      ];

      variantNumericFields.forEach((field) => {
        if (body[field] !== undefined) {
          updateOps.$set[field] = Number(body[field]);
        }
      });

      if (body.metal) {
        updateOps.$set.metal = parseJSON(body.metal, existing.metal);
      }

      if (body.stones) {
        updateOps.$set.stones = parseJSON(body.stones, existing.stones);
      }
    }

    /* =====================================================
       STEP 6 — BASE PRODUCT SPECIFIC
    ===================================================== */
    if (!isVariant) {
      if (body.variants) {
        updateOps.$set.variants = parseJSON(body.variants, existing.variants);
      }
    }

    /* =====================================================
       STEP 7 — PRICES & MAKING CHARGES (BASE + VARIANT)
    ===================================================== */
    if (body.prices) {
      updateOps.$set.prices = parseJSON(body.prices, existing.prices);
    }

    if (body.makingChargesByCountry) {
      updateOps.$set.makingChargesByCountry = parseJSON(
        body.makingChargesByCountry,
        existing.makingChargesByCountry
      );
    }


    /* =====================================================
       STEP 7 — MEDIA (fix push/pull)
    ===================================================== */

    // Cover
    if (req.files?.coverImage?.[0]) {
      updateOps.$set.coverImage = req.files.coverImage[0].path;
    }

    // Gallery replace
    if (req.files?.images?.length) {
      updateOps.$set.images = req.files.images.map((f) => f.path);
    }

    // ADD images (array)
    if (body.addImage) {
      const arr = parseJSON(body.addImage, []);
      if (arr.length) {
        updateOps.$push = updateOps.$push || {};
        updateOps.$push.images = { $each: arr };
      }
    }

    // REMOVE images (array)
    if (body.removeImage) {
      const arr = parseJSON(body.removeImage, []);
      if (arr.length) {
        updateOps.$pull = updateOps.$pull || {};
        updateOps.$pull.images = { $in: arr };
      }
    }

    // 3D model
    if (req.files?.model3D?.[0]) {
      updateOps.$set.model3D = req.files.model3D[0].path;
    }

    // Video
    if (req.files?.videoFile?.[0]) {
      updateOps.$set.videoUrl = req.files.videoFile[0].path;
    }

    /* =====================================================
   FINAL STEP — APPLY MANUAL DIAMOND TOTAL OVERRIDES
   (THIS MUST RUN LAST)
===================================================== */

    // MAIN TOTAL OVERRIDE
    // MAIN TOTAL OVERRIDE (fixed)
    if (body.mainDiamondTotal !== undefined) {
      const raw = body.mainDiamondTotal;

      if (raw === "" || raw === "null") {
        updateOps.$set.mainDiamondTotal = null;
      } else {
        const v = Number(raw);
        updateOps.$set.mainDiamondTotal = isNaN(v) ? null : v;
      }
    }

    // SIDE TOTAL OVERRIDE (fixed)
    if (body.sideDiamondTotal !== undefined) {
      const raw = body.sideDiamondTotal;

      if (raw === "" || raw === "null") {
        updateOps.$set.sideDiamondTotal = null;
      } else {
        const v = Number(raw);
        updateOps.$set.sideDiamondTotal = isNaN(v) ? null : v;
      }
    }



    /* =====================================================
       STEP 8 — EXECUTE UPDATE
    ===================================================== */
    const updated = await Ornament.findByIdAndUpdate(ornamentId, updateOps, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: `${isVariant ? "Variant updated" : "Main product updated"} successfully`,
      ornament: updated,
    });
  } catch (err) {
    console.error("❌ Update Ornament Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update ornament",
      error: err.message,
    });
  }
};



// ✅ Delete Ornament
export const deleteOrnament = async (req, res) => {
  try {
    const ornament = await Ornament.findByIdAndDelete(req.params.id);
    if (!ornament) return res.status(404).json({ message: "Ornament not found" });

    res.status(200).json({ message: "Ornament deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete ornament", error: err.message });
  }
};
