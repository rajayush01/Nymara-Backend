// controllers/ornamentController.js
import Ornament from "../models/Ornament.js";
import upload from "../cloud/upload.js"; 
import { currencyRates } from "../config/currencyRates.js";
import util from "util";

// Middleware to handle uploads (1 coverImage + multiple images)
export const uploadOrnamentImages = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "images", maxCount: 5 },
  { name: "model3D", maxCount: 1 },
  { name: "videoFile", maxCount: 1 }, 
    { name: "variantCoverImage", maxCount: 1 },
  { name: "variantImages", maxCount: 5 },
]);

// ✅ Add Ornament
// ✅ Add Ornament


export const addOrnament = async (req, res) => {
  try {
    console.log("🧩 Incoming Ornament Request:");
    console.log("BODY:\n", JSON.stringify(req.body, null, 2));
    console.log("FILES:\n", util.inspect(req.files, { depth: null, colors: true }));

    // ✅ Base product media
   // 🟢 Handle uploads dynamically (works with upload.any())
let coverImage = null;
let images = [];
let model3D = null;
let videoUrl = null;
let variantFiles = {};

if (Array.isArray(req.files)) {
  for (const file of req.files) {
    if (file.fieldname === "coverImage") {
      coverImage = file.path;
    } else if (file.fieldname === "images") {
      images.push(file.path);
    } else if (file.fieldname === "model3D") {
      model3D = file.path;
    } else if (file.fieldname === "videoFile") {
      videoUrl = file.path;
    } else if (/^variant\d+_(cover|images)$/.test(file.fieldname)) {
      const match = file.fieldname.match(/^variant(\d+)_(cover|images)$/);
      const variantIndex = match[1];
      const type = match[2];
      if (!variantFiles[variantIndex]) variantFiles[variantIndex] = { images: [] };
      if (type === "cover") variantFiles[variantIndex].coverImage = file.path;
      else variantFiles[variantIndex].images.push(file.path);
    }
  }
}


    // ✅ Category logic
    const category = Array.isArray(req.body.category)
      ? req.body.category[0]
      : req.body.category || null;
    const subCategory = Array.isArray(req.body.subCategory)
      ? req.body.subCategory[0]
      : req.body.subCategory || null;
    const type = req.body.type || req.body.category || "other";

    // ✅ Safe JSON parse helper
    const parseJSON = (val, fallback = {}) => {
      if (!val) return fallback;
      try {
        return typeof val === "string" ? JSON.parse(val) : val;
      } catch {
        return fallback;
      }
    };

    const prices = parseJSON(req.body.prices, {});
    const makingChargesByCountry = parseJSON(req.body.makingChargesByCountry, {});
    const variantLinks = parseJSON(req.body.variantLinks, {});
    const diamondDetails = parseJSON(req.body.diamondDetails, null);
    const sideDiamondDetails = parseJSON(req.body.sideDiamondDetails, null);
    let variants = parseJSON(req.body.variants, []); // 🔹 Base variant info

    // ✅ Price + discount normalization
    const price = Number(req.body.price) || 0;
    const originalPrice = Number(req.body.originalPrice) || price;
    let discount = Number(req.body.discount) || 0;
    if (!discount && originalPrice > price) {
      discount = Math.round(((originalPrice - price) / originalPrice) * 100);
    }

    const rating = req.body.rating ? Number(req.body.rating) : 0;

    // ✅ Validation for diamond/gemstone types
    if (
      ["Diamond", "Gemstone", "Fashion"].includes(req.body.categoryType) &&
      !diamondDetails
    ) {
      return res.status(400).json({
        success: false,
        message: `${req.body.categoryType} products must include 'diamondDetails'.`,
      });
    }

    // ✅ Attach images for each variant (dynamic handling)
       // 🧩 Merge uploaded variant files with variant info
if (Array.isArray(variants) && variants.length > 0) {
  variants.forEach((v, i) => {
    if (variantFiles[i]) {
      v.coverImage = variantFiles[i].coverImage || null;
      v.images = variantFiles[i].images || [];
    }
  });
}


    // ✅ Create final object
    const ornamentData = {
      ...req.body,
      type,
      category,
      subCategory,
      coverImage,
      images,
      prices,
      makingChargesByCountry,
      price,
      originalPrice,
      discount,
      rating,
      diamondDetails,
      sideDiamondDetails,
      variantLinks,
      model3D,
      videoUrl,
      variants, // ✅ embedded array with its own images
    };

    const ornament = await Ornament.create(ornamentData);

    res.status(201).json({
      success: true,
      message: "✅ Ornament added successfully",
      ornament,
    });
  } catch (err) {
    console.error("❌ Add Ornament Error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Server Error",
      error: err.stack || err,
    });
  }
};




// ✅ Get Single Ornament by ID
export const getOrnamentById = async (req, res) => {
  try {
    const curr = (req.query.currency || "INR").toUpperCase();

    const ornament = await Ornament.findById(req.params.id);
    if (!ornament) {
      return res.status(404).json({
        success: false,
        message: "Ornament not found",
      });
    }

    // 💰 Currency conversion
    let finalPrice = 0;
    let symbol = "₹";

    if (ornament.prices?.[curr]) {
      const priceObj = ornament.prices[curr];
      finalPrice = priceObj.amount;
      symbol = priceObj.symbol;
    } else if (curr !== "INR" && currencyRates[curr]) {
      const rate = currencyRates[curr]?.rate || 1;
      finalPrice = Number(((ornament.price || 0) * rate).toFixed(2));
      symbol = currencyRates[curr]?.symbol || "₹";
    } else {
      finalPrice = ornament.price || 0;
      symbol = "₹";
    }

    // 💎 Making charge conversion
    let makingCharge = 0;
    if (ornament.makingChargesByCountry?.[curr]) {
      makingCharge = ornament.makingChargesByCountry[curr].amount;
    } else if (curr !== "INR" && currencyRates[curr]) {
      makingCharge = Number(
        ((ornament.makingCharges || 0) * currencyRates[curr].rate).toFixed(2)
      );
    } else {
      makingCharge = ornament.makingCharges || 0;
    }

    // 💎 Diamond / gemstone details
    const diamondInfo =
      ["Diamond", "Gemstone", "Fashion"].includes(ornament.categoryType)
        ? {
            diamondDetails: ornament.diamondDetails || null,
            sideDiamondDetails: ornament.sideDiamondDetails || null,
          }
        : {};

    // 💰 Discount & total
    const basePrice = ornament.price || 0;
    const originalPrice = ornament.originalPrice || basePrice;
    const discount =
      ornament.discount ||
      (originalPrice > basePrice
        ? Math.round(((originalPrice - basePrice) / originalPrice) * 100)
        : 0);

    const totalConvertedPrice = Number((finalPrice + makingCharge).toFixed(2));

    // 🖼 Images
    const displayCoverImage = ornament.coverImage || null;
    const displayImages = ornament.images || [];

    // ✅ Send response
    res.status(200).json({
      success: true,
      ornament: {
        ...ornament.toObject(),
        ...diamondInfo,
        priceInINR: ornament.price,
        displayPrice: Number(finalPrice.toFixed(2)),
        convertedMakingCharge: Number(makingCharge.toFixed(2)),
        totalConvertedPrice,
        currency: symbol,
        prices: ornament.prices || {},
        makingChargesByCountry: ornament.makingChargesByCountry || {},
        model3D: ornament.model3D || null,
        originalPrice,
        discount,
        displayCoverImage,
        displayImages,
        variants: ornament.variants || [], // embedded variants
      },
    });
  } catch (err) {
    console.error("❌ Get Ornament Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ornament",
      error: err.message,
    });
  }
};


// ✅ Get All Ornaments (with filters)
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
      includeVariants = false, // optional query param: include all variants in results
    } = req.query;

    const curr = currency.toUpperCase();
    let filter = {};

    // 🔹 Basic filters
    if (gender) filter.gender = gender;

    if (category) {
      const categories = Array.isArray(category)
        ? category
        : category.split(",").map((c) => c.trim());
      filter.category = { $in: categories };
    }

    if (subCategory) {
      const subCategories = Array.isArray(subCategory)
        ? subCategory
        : subCategory.split(",").map((s) => s.trim());
      filter.subCategory = { $in: subCategories };
    }

    if (type) filter.type = type;

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // 🔹 Optional: hide variant products in main listing unless asked
    if (!includeVariants) {
  filter.$or = [{ isBaseProduct: true }, { isBaseProduct: { $exists: false } }];
}

    // 🔹 Sorting logic
    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { price: 1 };
    if (sort === "price_desc") sortOption = { price: -1 };
    if (sort === "newest") sortOption = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };

    const skip = (Number(page) - 1) * Number(limit);

    // 🔹 Fetch ornaments with variants & base linkage
    const ornaments = await Ornament.find(filter)
  .sort(sortOption)
  .skip(skip)
  .limit(Number(limit))
  .lean(); // ✅ No populate — embedded variants come automatically


    const total = await Ornament.countDocuments(filter);

    // ✅ Transform results with currency + variant image fallback
    const ornamentsWithCurrency = ornaments.map((orn) => {
      let finalPrice, symbol;

      if (orn.prices && orn.prices[curr]) {
        const priceObj = orn.prices[curr];
        finalPrice = priceObj.amount;
        symbol = priceObj.symbol;
      } else {
        const selectedCurrency = currencyRates[curr] || currencyRates["INR"];
        finalPrice = (orn.price || 0) * selectedCurrency.rate;
        symbol = selectedCurrency.symbol;
      }

      const originalPrice = orn.originalPrice || orn.price;
      const discount =
        orn.discount ||
        Math.round(((originalPrice - orn.price) / originalPrice) * 100) ||
        0;

      // 🖼️ Fallback logic for images (variant → self → base)
     // ✅ Determine which variant cover image to show
const displayCoverImage =
  orn.variants?.find(v => v.isDefault)?.coverImage ||
  orn.variants?.[0]?.coverImage ||
  orn.coverImage ||
  null;

// ✅ Determine which variant images to show
let displayImages = [];

if (orn.variants && orn.variants.length > 0) {
  // Find the default variant or the first one
  const defaultVariant = orn.variants.find(v => v.isDefault) || orn.variants[0];

  // Use that variant’s images
  if (defaultVariant?.images?.length > 0) {
    displayImages = defaultVariant.images;
  }
}

// Fallback to product-level images if no variant images exist
if (displayImages.length === 0 && orn.images?.length > 0) {
  displayImages = orn.images;
}


      return {
        ...orn,
        priceInINR: orn.price,
        displayPrice: Number(finalPrice.toFixed(2)),
        currency: symbol,
        model3D: orn.model3D || orn.baseProduct?.model3D || null,
        originalPrice,
        discount,
        displayCoverImage,
        displayImages,
      };
    });

    res.status(200).json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
      count: ornaments.length,
      ornaments: ornamentsWithCurrency,
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


// ✅ Update Ornament
export const updateOrnament = async (req, res) => {
  try {
    const {
      images,
      addImage,
      removeImage,
      sku,
      prices,
      variantLinks,
      variants,
      diamondDetails,
      makingChargesByCountry,
      sideDiamondDetails,
      ...updateData
    } = req.body;

    if (sku) {
      return res.status(400).json({
        success: false,
        message: "SKU cannot be updated manually",
      });
    }

    const updateOps = { $set: { ...updateData } };

    // ✅ Helper: safely parse JSON
    const parseJSON = (val, fallback = null) => {
      try {
        if (!val) return fallback;
        if (typeof val === "object") return val;
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    };

    /* ==============================
       🧩 VARIANT PARSING FIX
    =============================== */
    let parsedVariants = [];

    if (variants) {
      let temp = variants;

      // Handle Array sent as ["[object Object],[object Object]"]
      if (Array.isArray(temp)) temp = temp.join(",");

      // Fix common malformed cases
      if (typeof temp === "string" && temp.includes("[object Object]")) {
        console.warn("⚠️ Received malformed variants string — auto-fixing...");
        temp = "[]"; // fallback to empty
      }

      // Try normal parsing
      let parsed = parseJSON(temp, []);
      // Handle weird nested array (e.g. [[{},{},...]])
      if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
        parsed = parsed[0];
      }

      parsedVariants = Array.isArray(parsed) ? parsed : [];
    }

    /* ==============================
       💰 PRICES & MAKING CHARGES
    =============================== */
    const parsedPrices = parseJSON(prices);
    const parsedCharges = parseJSON(makingChargesByCountry);
    if (parsedPrices) updateOps.$set.prices = parsedPrices;
    if (parsedCharges) updateOps.$set.makingChargesByCountry = parsedCharges;

    /* ==============================
       🖼️ COVER & GALLERY IMAGES
    =============================== */
    if (req.files?.coverImage?.[0]) {
      updateOps.$set.coverImage = req.files.coverImage[0].path;
    }
    if (req.files?.images?.length) {
      updateOps.$set.images = req.files.images.map((f) => f.path);
    }
    if (images) updateOps.$set.images = images;

    // Add/remove specific images
    if (addImage)
      updateOps.$push = { ...(updateOps.$push || {}), images: addImage };
    if (removeImage)
      updateOps.$pull = { ...(updateOps.$pull || {}), images: removeImage };

    /* ==============================
       🧩 VARIANT FILE UPLOADS
    =============================== */
    const variantFiles = {};
    if (Array.isArray(req.files)) {
      for (const file of req.files) {
        if (/^variant\d+_(cover|images)$/.test(file.fieldname)) {
          const match = file.fieldname.match(/^variant(\d+)_(cover|images)$/);
          const variantIndex = match[1];
          const type = match[2];
          if (!variantFiles[variantIndex])
            variantFiles[variantIndex] = { images: [] };
          if (type === "cover") variantFiles[variantIndex].coverImage = file.path;
          else variantFiles[variantIndex].images.push(file.path);
        }
      }
    }

    // ✅ Merge variant uploads with parsed variants
    if (parsedVariants.length && Object.keys(variantFiles).length) {
      parsedVariants.forEach((variant, i) => {
        if (typeof variant !== "object" || variant === null) {
          console.warn(`⚠️ Skipping malformed variant at index ${i}`);
          return;
        }

        if (variantFiles[i]) {
          variant.coverImage =
            variantFiles[i].coverImage || variant.coverImage || null;
          variant.images = [
            ...(variant.images || []),
            ...(variantFiles[i].images || []),
          ];
        }
      });
    }

    if (parsedVariants.length) {
      updateOps.$set.variants = parsedVariants;
    }

    /* ==============================
       🔗 VARIANT LINKS
    =============================== */
    const parsedVariantLinks = parseJSON(variantLinks);
    if (parsedVariantLinks) updateOps.$set.variantLinks = parsedVariantLinks;

    /* ==============================
       💲 NUMERIC FIELDS
    =============================== */
    if (updateData.price) updateOps.$set.price = Number(updateData.price);
    if (updateData.originalPrice)
      updateOps.$set.originalPrice = Number(updateData.originalPrice);
    if (updateData.discount)
      updateOps.$set.discount = Number(updateData.discount);

    // Auto discount
    const { price, originalPrice, discount } = updateOps.$set;
    if (!discount && price && originalPrice && originalPrice > price) {
      updateOps.$set.discount = Math.round(
        ((originalPrice - price) / originalPrice) * 100
      );
    }

    /* ==============================
       💎 DIAMOND DETAILS
    =============================== */
    if (["Diamond", "Gemstone", "Fashion"].includes(updateData.categoryType)) {
      const parsedDiamond = parseJSON(diamondDetails);
      const parsedSide = parseJSON(sideDiamondDetails);
      if (parsedDiamond) updateOps.$set.diamondDetails = parsedDiamond;
      if (parsedSide) updateOps.$set.sideDiamondDetails = parsedSide;
    } else {
      updateOps.$unset = {
        ...updateOps.$unset,
        diamondDetails: "",
        sideDiamondDetails: "",
      };
    }

    console.log("🧩 Final parsedVariants:", parsedVariants);

    /* ==============================
       ✅ DB UPDATE
    =============================== */
    const ornament = await Ornament.findByIdAndUpdate(req.params.id, updateOps, {
      new: true,
      runValidators: true,
    });

    if (!ornament) {
      return res.status(404).json({
        success: false,
        message: "Ornament not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "✅ Ornament updated successfully",
      ornament,
    });
  } catch (err) {
    console.error("❌ Update Ornament Error:", err);
    res.status(500).json({
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
