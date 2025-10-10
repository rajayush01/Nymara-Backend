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

/**
 * 🔹 Get all ornaments (public route)
 */
router.get("/ornaments", async (req, res) => {
  try {
    const {
      gender,
      category,
      subCategory,
      type,
      metalType,
      stoneType,
      style,
      size,
      color,
      minPrice,
      maxPrice,
      search,
      sort,
      currency = "INR",
    } = req.query;

    let filter = {};

    // 🔹 Currency rates
    const currencyRates = {
      INR: { rate: 1, symbol: "₹" },
      USD: { rate: 0.012, symbol: "$" },
      GBP: { rate: 0.0095, symbol: "£" },
      CAD: { rate: 0.016, symbol: "CA$" },
      EUR: { rate: 0.011, symbol: "€" },
    };

    // 🔹 Determine selected currency (default: INR)
    const selectedCurrency =
      currencyRates[currency.toUpperCase()] || currencyRates["INR"];

    // 🔹 Gender filter
    if (gender) filter.gender = new RegExp(gender, "i");

    // 🔹 Category filter
    if (category) {
      const catArray = Array.isArray(category) ? category : category.split(",");
      filter.category = { $in: catArray.map((c) => new RegExp(`^${c.trim()}$`, "i")) };
    }

    // 🔹 SubCategory filter
    if (subCategory) {
      const subCatArray = Array.isArray(subCategory) ? subCategory : subCategory.split(",");
      filter.subCategory = {
        $in: subCatArray.map((s) => new RegExp(s.trim(), "i")),
      };
    }

    // 🔹 Type filter
    if (type) filter.type = new RegExp(type, "i");

    // 🔹 Metal type filter
    if (metalType) {
      const metals = Array.isArray(metalType) ? metalType : metalType.split(",");
      filter.metalType = { $in: metals.map((m) => new RegExp(m, "i")) };
    }

    // 🔹 Stone type filter
    if (stoneType) {
      const stones = Array.isArray(stoneType) ? stoneType : stoneType.split(",");
      filter.stoneType = { $in: stones.map((s) => new RegExp(s, "i")) };
    }

    // 🔹 Style filter
    if (style) {
      const styles = Array.isArray(style) ? style : style.split(",");
      filter.style = { $in: styles.map((s) => new RegExp(s, "i")) };
    }

    // 🔹 Size filter
    if (size) {
      const sizes = Array.isArray(size) ? size : size.split(",");
      filter.size = { $in: sizes.map((s) => new RegExp(s, "i")) };
    }

    // 🔹 Color filter
    if (color) {
      const colors = Array.isArray(color) ? color : color.split(",");
      filter.color = { $in: colors.map((c) => new RegExp(c, "i")) };
    }

    // 🔹 Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // 🔹 Search filter (across multiple fields)
    if (search) {
      const searchRegex = new RegExp(search, "i");
      const searchConditions = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { subCategory: searchRegex },
        { type: searchRegex },
        { metalType: searchRegex },
        { stoneType: searchRegex },
        { style: searchRegex },
        { color: searchRegex },
      ];
      filter = { $and: [filter, { $or: searchConditions }] };
    }

    // 🔹 Sorting
    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { price: 1 };
    if (sort === "price_desc") sortOption = { price: -1 };
    if (sort === "newest") sortOption = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    if (sort === "featured") sortOption = { isFeatured: -1, createdAt: -1 };

    const ornaments = await Ornament.find(filter).sort(sortOption);


    const total = await Ornament.countDocuments(filter);

    // 🔹 Currency conversion + discount calculation
    const ornamentsWithCurrency = ornaments.map((orn) => {
      const price = orn.price || 0;
      const originalPrice = orn.originalPrice || price;
      const discount =
        orn.discount ||
        (originalPrice > price
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0);

      const convertedPrice = price
        ? Number((price * selectedCurrency.rate).toFixed(2))
        : null;

      return {
        ...orn.toObject(),
        priceInINR: price,
        convertedPrice,
        currency: selectedCurrency.symbol,
        originalPrice,
        discount,
        prices: orn.prices || {},
      };
    });

    // ✅ Send Response
    res.json({
      success: true,
      total,
      count: ornaments.length,
      ornaments: ornamentsWithCurrency,
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
 * 🔹 Get single ornament details (public route)
 */
router.get("/ornaments/:id", async (req, res) => {
  try {
    const { currency = "INR" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ornament ID" });
    }

    const ornament = await Ornament.findById(req.params.id);

    if (!ornament) {
      return res
        .status(404)
        .json({ success: false, message: "Ornament not found" });
    }

    let convertedPrice = ornament.price;
    let symbol = "₹";

    // ✅ First check if product has predefined prices
    if (ornament.prices && ornament.prices[currency]) {
      convertedPrice = ornament.prices[currency].amount;
      symbol = ornament.prices[currency].symbol;
    } 
    // ✅ Otherwise fallback to dynamic conversion
    else if (currencyRates[currency.toUpperCase()]) {
      convertedPrice = ornament.price
        ? Number((ornament.price * currencyRates[currency.toUpperCase()].rate).toFixed(2))
        : null;
      symbol = currencyRates[currency.toUpperCase()].symbol;
    }

      const price = ornament.price || 0;
    const originalPrice = ornament.originalPrice || price;
    const discount =
      ornament.discount ||
      Math.round(((originalPrice - price) / originalPrice) * 100) ||
      0;

    res.json({
      success: true,
      count: 1,
      ornament: {
        ...ornament.toObject(),
        priceInINR: ornament.price,
        convertedPrice,
        currency: symbol,
         originalPrice,
        discount,
        prices: ornament.prices || {}, // send full map too
      },
    });
  } catch (error) {
    res.status(500).json({
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
