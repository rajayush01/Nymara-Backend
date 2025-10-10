import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    uId: { type: String, unique: true }, // 👈 sequential customer ID
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true, unique: true }, // 👈 Add phone number
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
  },
  { timestamps: true }
);

// 🔹 Pre-save hook
userSchema.pre("save", async function (next) {
  try {
    // 1️⃣ Generate sequential uId only for new users
    if (this.isNew && !this.uId) {
      const lastUser = await this.constructor.findOne().sort({ uId: -1 }).lean();

      if (!lastUser || !lastUser.uId) {
        this.uId = "BOF001";
      } else {
        const lastNumber = parseInt(lastUser.uId.replace(/\D/g, ""), 10) || 0;
        const newNumber = lastNumber + 1;
        this.uId = `BOF${String(newNumber).padStart(3, "0")}`;
      }
    }

    // 2️⃣ Hash password if modified
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    next();
  } catch (error) {
    next(error);
  }
});

// 🔑 Password reset token generator
userSchema.methods.createPasswordResetToken = function () {
  const plainToken = crypto.randomBytes(32).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(plainToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes

  return plainToken;
};

// 🔑 Password check method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);
