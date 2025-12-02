import mongoose from "mongoose";

const ornamentSchema = new mongoose.Schema(
  {
    /* BASIC INFO */
    name: { type: String, required: true },
    description: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },

    /* CATEGORY */
    categoryType: {
      type: String,
      enum: ["Gold", "Diamond", "Gemstone", "Fashion", "Composite"],
      required: true,
    },

    category: {
      type: String,
      enum: [
        "rings",
        "earrings",
        "necklaces",
        "bracelets",
        "mens",
        "loose-diamonds",
      ],
      required: true,
    },

    subCategory: { type: String, default: null },

    gender: {
      type: String,
      enum: ["Men", "Women", "Unisex"],
      required: true,
    },

    /* VARIANT SYSTEM */
    isVariant: { type: Boolean, default: false },

    // This is only for VARIANT products
    parentProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ornament",
      default: null,
    },

    // Base product: stores variant ids by label
    // Example:
    //  variants: {
    //     "18K Yellow Gold" : ObjectId("..."),
    //     "18K White Gold": ObjectId("...")
    //  }
    variants: {
      type: Map,
      of: { type: mongoose.Schema.Types.ObjectId, ref: "Ornament" },
      default: {},
    },

    // Label shown on UI (e.g., “Metal Type”, “Color”, “Purity”)
    variantLabel: { type: String, default: "" },

    /* SKU */
    sku: { type: String, unique: true, sparse: true },

    /* COMPOSITE PRICING */
    /* ===========================
       METAL COMPONENT 
       =========================== */
    metal: {
      weight: { type: Number, default: 0 }, // grams
      purity: { type: String, default: "" }, // 18K, 22K, etc.
      metalType: {
        type: String,
        enum: [
           "18K Gold", 
"18K White Gold", 
"18K Rose Gold", 
"14K Gold", 
"14K White Gold",
"14K Rose Gold", 
"Platinum", 
"925 Sterling Silver",
"Gold Vermeil",
          "",
        ],
        default: "",
      },
    },

    /* ===========================
       DIAMOND / GEMSTONE COMPONENT 
       =========================== */
      gemstoneDetails: [
  {
    stoneType: { type: String, required: true },  // Ruby, Emerald, Sapphire
    carat: { type: Number, default: 0 },
    count: { type: Number, default: 1 },
    color: { type: String, default: "" },
    clarity: { type: String, default: "" },
    cut: { type: String, default: "" },
    pricePerCarat: { type: Number, default: 0 },
    useAuto: { type: Boolean, default: true }
  }
],


    // OPTIONAL — Main Diamond Details
   diamondDetails: {
  carat: { type: Number, default: 0 },
  count: { type: Number, default: 0 },
  color: { type: String, default: "" },
  clarity: { type: String, default: "" },
  cut: { type: String, default: "" },
  pricePerCarat: { type: Number, default: 0 },
  useAuto: { type: Boolean, default: true },
},
mainDiamondTotal: { type: Number, default: 0 },



sideDiamondDetails: [
  {
    carat: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
    color: { type: String, default: "" },
    clarity: { type: String, default: "" },
    cut: { type: String, default: "" },
    pricePerCarat: { type: Number, default: 0 },
    useAuto: { type: Boolean, default: true },
  }
],

sideDiamondTotal: { type: Number, default: 0 },




    /* PRICING */
    price: { type: Number, default: 0 },
    originalPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    makingCharges: { type: Number, default: 0 },
    prices: { type: mongoose.Schema.Types.Mixed, default: {} },
    makingChargesByCountry: { type: mongoose.Schema.Types.Mixed, default: {} },

    /* MEDIA */
    coverImage: { type: String, default: null },
    images: { type: [String], default: [] },
    model3D: { type: String, default: null },
    videoUrl: { type: String, default: null },

    /* MISC */
    stock: { type: Number, default: 1 },
    isFeatured: { type: Boolean, default: false },

    color: { type: String, default: "" },
    size: { type: String, default: "" },
  },
  { timestamps: true }
);

/* INDEXES */
ornamentSchema.index({ category: 1, gender: 1, isFeatured: 1 });
ornamentSchema.index({ parentProduct: 1 });

/* SKU GENERATION */
ornamentSchema.pre("save", async function (next) {
  if (!this.isNew || !this.categoryType) return next();

  const catCode = this.categoryType.substring(0, 2).toUpperCase();
  const genderCode = this.gender.substring(0, 1).toUpperCase();
  const typeCode = this.category.substring(0, 3).toUpperCase();

  const prefix = `${catCode}-${genderCode}-${typeCode}-`;

  const last = await mongoose
    .model("Ornament")
    .findOne({ sku: new RegExp(`^${prefix}`) })
    .sort({ sku: -1 });

  let nextNumber = 1;
  if (last?.sku) {
    const num = parseInt(last.sku.split("-")[3], 10);
    if (!isNaN(num)) nextNumber = num + 1;
  }

  this.sku = `${prefix}${String(nextNumber).padStart(3, "0")}`;
  next();
});

export default mongoose.model("Ornament", ornamentSchema);
