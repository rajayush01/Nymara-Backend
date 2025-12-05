import express from "express";
import mongoose from "mongoose";
import Ornament from "../models/Ornament.js";
import { protect } from "../middleware/authMiddleware.js";
import { saveUserDetails, getUserDetails } from "../controllers/userDetailsController.js";
import { currencyRates } from "../config/currencyRates.js";
import { forgetPassword, resetPassword } from "../emailer/password.js";
import CustomRequest from "../models/CustomRequest.js";
import sendEmail from "../emailer/sendEmail.js";

const router = express.Router();

router.get("/ornaments", async (req, res) => {
  try {
    const {
      gender,
      category,
      subCategory,
      metalType,
      stoneType,
      size,
      color,
      minPrice,
      maxPrice,
      search,
      sort,
      currency = "INR",
      includeVariants = "false",
    } = req.query;

    const curr = currency.toUpperCase();
    const currencyRates = {
      INR: { rate: 1, symbol: "₹" },
      USD: { rate: 0.012, symbol: "$" },
      GBP: { rate: 0.0095, symbol: "£" },
      CAD: { rate: 0.016, symbol: "CA$" },
      EUR: { rate: 0.011, symbol: "€" },
    };

    const selectedCurrency = currencyRates[curr] || currencyRates.INR;

    /* ==========================================================
       1. BUILD FILTER
    ========================================================== */
    let filter = {};

    if (includeVariants === "false") filter.isVariant = false;

    if (gender) filter.gender = new RegExp(gender, "i");

    if (category) {
      const arr = Array.isArray(category) ? category : category.split(",");
      filter.category = { $in: arr.map((c) => new RegExp(`^${c}$`, "i")) };
    }

    if (subCategory) {
      const arr = Array.isArray(subCategory) ? subCategory : subCategory.split(",");
      filter.subCategory = { $in: arr.map((c) => new RegExp(c, "i")) };
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { description: regex }];
    }

    /* ==========================================================
       2. FETCH MAIN PRODUCTS
    ========================================================== */
    const mains = await Ornament.find(filter).lean();

    /* Collect IDs of all variants */
    const variantIds = [];

    mains.forEach((item) => {
      if (!item.isVariant && item.variants) {
        Object.values(item.variants).forEach((id) => variantIds.push(id));
      }
    });

    /* Fetch variants in one query */
    const variants = await Ornament.find({
      _id: { $in: variantIds },
    }).lean();

    /* Build map for quick access */
    const variantMap = {};
    variants.forEach((v) => {
      variantMap[v._id.toString()] = v;
    });

    /* ==========================================================
       3. TRANSFORM OUTPUT (FAST)
    ========================================================== */
    let output = [];

    for (let product of mains) {
      if (!product.isVariant) {
        const variantIds = Object.values(product.variants || {});
        const theseVariants = variantIds.map((id) => variantMap[id.toString()]).filter(Boolean);

        const converted = theseVariants.map((v) => {
          let price = v.price;
          let making = v.makingCharges;
          let symbol = selectedCurrency.symbol;

          // Currency override
          if (v.prices?.[curr]) {
            price = v.prices[curr].amount;
            symbol = v.prices[curr].symbol;
          } else {
            price = Number((price * selectedCurrency.rate).toFixed(2));
          }

          if (v.makingChargesByCountry?.[curr]) {
            making = v.makingChargesByCountry[curr].amount;
          } else {
            making = Number((making * selectedCurrency.rate).toFixed(2));
          }

          const total = Number((price + making).toFixed(2));

          return {
            ...v,
            displayPrice: total,
            currency: symbol,
          };
        });

        const startingPrice =
          converted.length > 0
            ? Math.min(...converted.map((v) => v.displayPrice))
            : null;

        output.push({
          ...product,
          variants: converted,
          startingPrice,
          currency: selectedCurrency.symbol,
        });
      } else if (includeVariants === "true") {
        // Show variants separately if asked
        let price = product.price;
        let symbol = selectedCurrency.symbol;

        if (product.prices?.[curr]) {
          price = product.prices[curr].amount;
          symbol = product.prices[curr].symbol;
        } else {
          price = Number((price * selectedCurrency.rate).toFixed(2));
        }

        output.push({
          ...product,
          displayPrice: price,
          currency: symbol,
        });
      }
    }

    /* ==========================================================
       4. SORTING
    ========================================================== */
    if (sort === "price_asc")
      output.sort((a, b) => (a.startingPrice || Infinity) - (b.startingPrice || Infinity));

    if (sort === "price_desc")
      output.sort((a, b) => (b.startingPrice || 0) - (a.startingPrice || 0));

    if (sort === "newest")
      output.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (sort === "oldest")
      output.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    /* ==========================================================
       5. SEND RESPONSE
    ========================================================== */
    res.json({
      success: true,
      count: output.length,
      ornaments: output,
    });

  } catch (err) {
    console.error("❌ Error fetching ornaments:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ornaments",
      error: err.message,
    });
  }
});



    
   

    

/**
/**
 * 🔹 Get single ornament details (public route)
 */
// router.get("/ornaments/:id", async (req, res) => {
//   try {
//     const { currency = "INR" } = req.query;
//     const curr = currency.toUpperCase();

//     // Currency rates
//     const currencyRates = {
//       INR: { rate: 1, symbol: "₹" },
//       USD: { rate: 0.012, symbol: "$" },
//       GBP: { rate: 0.0095, symbol: "£" },
//       CAD: { rate: 0.016, symbol: "CA$" },
//       EUR: { rate: 0.011, symbol: "€" },
//     };
//     const selectedCurrency = currencyRates[curr] || currencyRates.INR;

//     // Validate ID
//     const ornamentId = req.params.id;
//     if (!mongoose.Types.ObjectId.isValid(ornamentId)) {
//       return res.status(400).json({ success: false, message: "Invalid ornament ID" });
//     }

//     // Fetch ornament
//     const ornament = await Ornament.findById(ornamentId).lean();
//     if (!ornament) {
//       return res.status(404).json({ success: false, message: "Ornament not found" });
//     }

//     /* ==========================================================
//        HELPER: Convert any product's price
//     ========================================================== */
//     const convertPrice = (item) => {
//       let price = item.price || 0;
//       let making = item.makingCharges || 0;
//       let symbol = selectedCurrency.symbol;

//       // Handle custom price by currency
//       if (item.prices?.[curr]) {
//         price = item.prices[curr].amount;
//         symbol = item.prices[curr].symbol;
//       } else {
//         price = Number((price * selectedCurrency.rate).toFixed(2));
//       }

//       // Handle country making charges
//       if (item.makingChargesByCountry?.[curr]) {
//         making = item.makingChargesByCountry[curr].amount;
//       } else {
//         making = Number((making * selectedCurrency.rate).toFixed(2));
//       }

//       const total = Number((price + making).toFixed(2));

//       const original = item.originalPrice || item.price || price;
//       const discount =
//         item.discount ||
//         (original > price
//           ? Math.round(((original - price) / original) * 100)
//           : 0);

//       return {
//         price,
//         making,
//         total,
//         symbol,
//         original,
//         discount,
//       };
//     };

//     /* ==========================================================
//        CASE 1 → VARIANT PRODUCT
//     ========================================================== */
//     if (ornament.isVariant) {
//       const converted = convertPrice(ornament);

//       return res.json({
//         success: true,
//         type: "variant",
//         ornament: {
//           ...ornament,
//           displayPrice: converted.price,
//           convertedMakingCharge: converted.making,
//           totalConvertedPrice: converted.total,
//           currency: converted.symbol,
//           originalPrice: converted.original,
//           discount: converted.discount,
//           metal: ornament.metal,
//           stones: ornament.stones || [],
//           images: ornament.images || [],
//           coverImage: ornament.coverImage || null,
//           model3D: ornament.model3D || null,
//           videoUrl: ornament.videoUrl || null,
//         },
//       });
//     }

//     /* ==========================================================
//        CASE 2 → MAIN PRODUCT
//        Fetch all variants and convert their prices
//     ========================================================== */
//     const variants = await Ornament.find({
//       parentProduct: ornament._id,
//       isVariant: true,
//     }).lean();

//     // Convert prices for all variants
//     const convertedVariants = variants.map((v) => {
//       const converted = convertPrice(v);

//       return {
//         ...v,
//         displayPrice: converted.price,
//         convertedMakingCharge: converted.making,
//         totalConvertedPrice: converted.total,
//         currency: converted.symbol,
//         originalPrice: converted.original,
//         discount: converted.discount,
//       };
//     });

//     // Starting price = lowest total price among variants
//     const startingPrice =
//       convertedVariants.length > 0
//         ? Math.min(...convertedVariants.map((v) => v.totalConvertedPrice))
//         : null;

//     return res.json({
//       success: true,
//       type: "main",
//       ornament: {
//         ...ornament,
//         currency: selectedCurrency.symbol,
//         variants: convertedVariants,
//         startingPrice,
//         metal: ornament.metal,
//         stones: ornament.stones || [],
//         images: ornament.images || [],
//         coverImage: ornament.coverImage || null,
//         model3D: ornament.model3D || null,
//         videoUrl: ornament.videoUrl || null,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Get Ornament Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch ornament",
//       error: error.message,
//     });
//   }
// });


router.get("/ornaments/:id", async (req, res) => {
  try {
    const { currency = "INR" } = req.query;
    const curr = currency.toUpperCase();

    const currencyRates = {
      INR: { rate: 1, symbol: "₹" },
      USD: { rate: 0.012, symbol: "$" },
      GBP: { rate: 0.0095, symbol: "£" },
      CAD: { rate: 0.016, symbol: "CA$" },
      EUR: { rate: 0.011, symbol: "€" },
      AED: { rate: 0.009, symbol: "د.إ" },
      AUD: { rate: 0.018, symbol: "A$" },
      SGD: { rate: 0.016, symbol: "S$" },
      JPY: { rate: 1.8, symbol: "¥" },
    };

    const selectedCurrency = currencyRates[curr] || currencyRates.INR;

    const ornamentId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(ornamentId)) {
      return res.status(400).json({ success: false, message: "Invalid ornament ID" });
    }

    let ornament = await Ornament.findById(ornamentId).lean();
    if (!ornament) {
      return res.status(404).json({ success: false, message: "Ornament not found" });
    }

    /* -----------------------------------------------------------
       FIX 1: NORMALIZE OBJECT-BASED VARIANT IDS
       ex: { "925 Sterling Silver": ObjectId("..") }
    ------------------------------------------------------------*/
    const normalVariantIds = [];

    if (ornament.variants && typeof ornament.variants === "object" && !Array.isArray(ornament.variants)) {
      for (const key in ornament.variants) {
        const value = ornament.variants[key];

        let idString = null;

        if (value && typeof value === "object" && value._bsontype === "ObjectId") {
          idString = value.toString();
        } else if (typeof value === "string") {
          idString = value;
        } else if (value?.$oid) {
          idString = value.$oid;
        }

        if (idString && mongoose.Types.ObjectId.isValid(idString)) {
          normalVariantIds.push(idString);
        }
      }
    }

    /* -----------------------------------------------------------
       PRICE CONVERTER
    ------------------------------------------------------------*/
    const convertPrice = (item) => {
      let price = item.price || 0;
      let making = item.makingCharges || 0;
      let symbol = selectedCurrency.symbol;

      // DB_OVERRIDE price
      if (item.prices?.[curr]) {
        price = Number(item.prices[curr].amount);
        symbol = item.prices[curr].symbol || symbol;
      } else {
        price = Number((price * selectedCurrency.rate).toFixed(2));
      }

      // DB_OVERRIDE making
      if (item.makingChargesByCountry?.[curr]) {
        making = Number(item.makingChargesByCountry[curr].amount);
      } else {
        making = Number((making * selectedCurrency.rate).toFixed(2));
      }

      const total = Number((price + making).toFixed(2));
      const original = item.originalPrice || item.price || price;
      const discount =
        item.discount ||
        (original > price ? Math.round(((original - price) / original) * 100) : 0);

      return { price, making, total, symbol, original, discount };
    };

    /* ==========================================================
       CASE 1 — VARIANT PRODUCT ITSELF
    ==========================================================*/
    if (ornament.isVariant) {
      const converted = convertPrice(ornament);

      return res.json({
        success: true,
        type: "variant",
        ornament: {
          ...ornament,
          displayPrice: converted.price,
          convertedMakingCharge: converted.making,
          totalConvertedPrice: converted.total,
          currency: converted.symbol,
          originalPrice: converted.original,
          discount: converted.discount,
        },
      });
    }

    /* ==========================================================
       CASE 2 — MAIN PRODUCT
       Fetch variants in 2 ways:
       1) From linked object-based variants
       2) From children: parentProduct = ornament._id
    ==========================================================*/

    // 1) Fetch object-based variants
    let objectBasedVariants = [];
    if (normalVariantIds.length > 0) {
      objectBasedVariants = await Ornament.find({ _id: { $in: normalVariantIds } }).lean();
    }

    // 2) Fetch child variants
    const childVariants = await Ornament.find({
      parentProduct: ornament._id,
      isVariant: true,
    }).lean();

    // Merge without duplicates
    const mergedVariants = [
      ...objectBasedVariants,
      ...childVariants.filter((cv) => 
        !objectBasedVariants.some((ov) => ov._id.toString() === cv._id.toString())
      )
    ];

    // Convert each variant
    const convertedVariants = mergedVariants.map((variant) => {
      const c = convertPrice(variant);
      return {
        ...variant,
        displayPrice: c.price,
        convertedMakingCharge: c.making,
        totalConvertedPrice: c.total,
        currency: c.symbol,
        originalPrice: c.original,
        discount: c.discount,
      };
    });

    const startingPrice =
      convertedVariants.length > 0
        ? Math.min(...convertedVariants.map((v) => v.totalConvertedPrice))
        : null;

    const convertedMain = convertPrice(ornament);

    return res.json({
      success: true,
      type: "main",
      ornament: {
        ...ornament,
        currency: convertedMain.symbol,
        displayPrice: convertedMain.price,
        convertedMakingCharge: convertedMain.making,
        totalConvertedPrice: convertedMain.total,
        originalPrice: convertedMain.original,
        discount: convertedMain.discount,
        variants: convertedVariants,
        startingPrice,
      },
    });
  } catch (error) {
    console.error("❌ Get Ornament Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch ornament",
      error: error.message,
    });
  }
});




// Save/update user details
router.post("/details", protect, saveUserDetails);

// Get logged-in user details
router.get("/details", protect, getUserDetails);

router.post("/forgetpassword", forgetPassword);
router.put("/reset-password/:token", resetPassword);

router.post("/custom", async (req, res) => {
  try {
    const { name, email, phone, inspiration, specialRequests, images } = req.body;

    // Basic validation
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and phone number.",
      });
    }

    // Build email HTML
    const message = `
      <h2>💎 New Custom Jewelry Request</h2>
      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Phone:</b> ${phone}</p>
      <p><b>Inspiration:</b> ${inspiration || "<i>Not provided</i>"}</p>
      <p><b>Special Requests:</b> ${specialRequests || "<i>Not provided</i>"}</p>
      ${
        images?.length
          ? `<p><b>Reference Images:</b> ${images.length} file(s) attached below.</p>`
          : "<p><i>No reference images uploaded.</i></p>"
      }
    `;

    // Send the email (with images attached if available)
    await sendEmail({
      email: "jenasaisubham@gmail.com", // ✅ your admin email
      subject: "New Custom Jewelry Request",
      message,
      attachments:
        images?.map((base64, index) => {
          const base64Data = base64.split(";base64,").pop();
          const mimeType = base64.match(/data:(.*?);base64/)?.[1] || "image/jpeg";

          return {
            filename: `reference-${index + 1}.${mimeType.split("/")[1]}`,
            content: Buffer.from(base64Data, "base64"),
            contentType: mimeType,
          };
        }) || [],
    });

    res.status(200).json({
      success: true,
      message: "Custom request submitted and emailed successfully!",
    });
  } catch (error) {
    console.error("❌ Error sending custom jewelry email:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email.",
    });
  }
});

router.post("/inquiry", async (req, res) => {
  try {
    const { fullName, email, phone, location, investment, experience, message } = req.body;

    if (!fullName || !email || !phone) {
      return res.status(400).json({ success: false, message: "Please fill all required fields." });
    }

    const subject = "New Franchise Inquiry - Nymara Jewels";

    // ✅ Email content for your inbox
    const emailBody = `
      <h2>Franchise Inquiry Details</h2>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Preferred Location:</strong> ${location || "Not specified"}</p>
      <p><strong>Investment Capacity:</strong> ${investment || "Not specified"}</p>
      <p><strong>Business Experience:</strong> ${experience || "Not specified"}</p>
      <p><strong>Message:</strong></p>
      <p>${message || "No additional details provided."}</p>
    `;

    // ✅ Send email to your business inbox
    await sendEmail({
      email: "jenasaisubham8@gmail.com", // 👈 where you receive inquiries
      subject,
      message: emailBody,
    });

    console.log("✅ Franchise inquiry email sent successfully");
    res.status(200).json({ success: true, message: "Inquiry sent successfully" });
  } catch (error) {
    console.error("❌ Error sending franchise inquiry:", error.message);
    res.status(500).json({ success: false, message: "Failed to send inquiry" });
  }
});



export default router;



