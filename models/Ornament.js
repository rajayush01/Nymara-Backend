import mongoose from "mongoose";

const ornamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },

    // ✅ Aligns with your frontend main routes
   category: {
      type: String,
      required: true,
      enum: [
        "rings",
        "earrings",
        "necklaces",
        "bracelets",
        "mens",
        "loose-diamonds",
      ],
    },

    // ✅ Matches your getCategoryFromPath subcategories
    subCategory: {
      type: String,
      enum: [
        "engagement",
        "wedding",
        "eternity",
        "cocktail",
        "gemstone",
        "gold",
        "fashion",
        "studs",
        "hoops",
        "tennis",
        "pendants",
        "bangles",
        "mens rings",
        "mens earrings",
        "mens necklaces",
        "mens bracelets",
        "cufflinks",
      ],
    },

    // ✅ Category Type (broader grouping)
    categoryType: {
      type: String,
      enum: ["Gold", "Diamond", "Gemstone", "Fashion"],
    },

    gender: {
      type: String,
      required: true,
      enum: ["Men", "Women", "Unisex"],
    },

    sku: { type: String, unique: true },

    weight: { type: Number, required: true },
    purity: { type: String },

    price: { type: Number, required: true },
    originalPrice: { type: Number },        
    discount: { type: Number, default: 0 },
    prices: {
      type: Map,
      of: new mongoose.Schema(
        {
          amount: { type: Number, required: true },
          symbol: { type: String, required: true },
        },
        { _id: false }
      ),
      default: {},
    },

    makingCharges: { type: Number, default: 0 },
    stoneDetails: { type: String, default: "" },
    description: { type: String },
    stock: { type: Number, default: 1 },

    coverImage: { type: String, trim: true },
    images: { type: [String], default: [] },

    model3D: { type: String, default: "" },
    videoUrl: {
  type: String,
  default: null,
},

    

    metalType: {
      type: String,
      enum: [
        "18K White Gold",
        "18K Yellow Gold",
        "18K Rose Gold",
        "Platinum",
        "Sterling Silver",
        "14K Yellow Gold",
      ],
    },

    stoneType: {
      type: String,
      enum: [
        "Lab-Grown Diamond",
        "Lab-Grown Sapphire",
        "Lab-Grown Emerald",
        "Lab-Grown Ruby",
        "Pearl",
        "None",
      ],
    },

    style: {
      type: String,
      enum: [
        "Solitaire",
        "Halo",
        "Three Stone",
        "Wedding Band",
        "Eternity",
        "Cocktail",
        "Drop",
        "Vintage",
        "Tennis",
        "Cluster",
        "Chain",
        "Signet",
        "Studs",
        "Bangles",
      ],
    },

    size: { type: String },
    color: { type: String },

    variantLinks: {
      "Yellow Gold": { type: mongoose.Schema.Types.ObjectId, ref: "Ornament" },
      "White Gold": { type: mongoose.Schema.Types.ObjectId, ref: "Ornament" },
      "Rose Gold": { type: mongoose.Schema.Types.ObjectId, ref: "Ornament" },
      Silver: { type: mongoose.Schema.Types.ObjectId, ref: "Ornament" },
      Platinum: { type: mongoose.Schema.Types.ObjectId, ref: "Ornament" },
    },
  },
  { timestamps: true }
);

// 🔹 Auto-generate SKU
ornamentSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  const catCode =
    this.categoryType === "Gold"
      ? "GLD"
      : this.categoryType === "Diamond"
      ? "DMND"
      : this.categoryType === "Gemstone"
      ? "GSTN"
      : "FSHN";

  const genderCode = this.gender.substring(0, 1).toUpperCase();
 const typeCode = this.category.substring(0, 3).toUpperCase();

// 🔹 FIXED SKU generator
const prefix = `${catCode}-${genderCode}-${typeCode}-`;

const lastItem = await mongoose.model("Ornament").findOne({
  sku: new RegExp(`^${prefix}`)
}).sort({ createdAt: -1 });

let nextNumber = 1;

if (lastItem && lastItem.sku) {
  const lastNum = parseInt(lastItem.sku.split("-").pop(), 10);
  if (!isNaN(lastNum)) nextNumber = lastNum + 1;
}

this.sku = `${prefix}${String(nextNumber).padStart(3, "0")}`;



  

  next();
});

export default mongoose.model("Ornament", ornamentSchema);
