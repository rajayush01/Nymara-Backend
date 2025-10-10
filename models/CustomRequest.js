import mongoose from "mongoose";

const CustomRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // linked to logged in user
    category: { type: String, required: true },
    style: { type: String },
    metal: { type: String },
    stone: { type: String },
    size: { type: String },
    budget: { type: String },
    timeline: { type: String },
    inspiration: { type: String },
    specialRequests: { type: String },
    images: [{ type: String }], // optional uploaded references
    status: { type: String, enum: ["pending", "reviewed", "in-progress", "completed"], default: "pending" }
  },
  { timestamps: true }
);

export default mongoose.model("CustomRequest", CustomRequestSchema);
