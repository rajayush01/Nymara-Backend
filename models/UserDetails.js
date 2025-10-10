import mongoose from "mongoose";

const userDetailsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one-to-one with User
      index: true,
    },

    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true },

    address: {
      houseNo: { type: String, trim: true },
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, default: "India", trim: true },
    },

    orderIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserOrder",
      },
    ],
  },
  { timestamps: true }
);

// Ensure unique UserDetails per user
userDetailsSchema.index({ userId: 1 }, { unique: true });

export default mongoose.model("UserDetails", userDetailsSchema);
