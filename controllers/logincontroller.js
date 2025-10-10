// user and admin login controller
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AdminModel from "../models/Admin.js";
import UserModel from "../models/User.js";
import dotenv from "dotenv";

// 🔹 Import cart merge helper
import { mergeGuestCartToUser } from "./cartController.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

// 🔹 Token generator
const generateToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: "3h" });

export const login = async (req, res) => {
  try {
    // 🔹 Accept guestId for cart merging
    const { email, password, guestId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // ---------------------------
    // 🔹 1. Check Admin first
    // ---------------------------
    const admin = await AdminModel.findOne({ email });
    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) return res.status(401).json({ message: "Incorrect password" });

      const token = generateToken({
        id: admin._id,
        email: admin.email,
        name: admin.name,
        isAdmin: true,
      });

      return res.status(200).json({
        message: "Admin login successful",
        token,
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          isAdmin: true,
        },
      });
    }

    // ---------------------------
    // 🔹 2. Check User
    // ---------------------------
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Account not found. Please sign up to continue." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Incorrect password" });

    // 🔹 Merge guest cart → user cart if guestId exists
    if (guestId) {
      try {
        await mergeGuestCartToUser(guestId, user._id);
      } catch (mergeErr) {
        console.error("Cart merge failed:", mergeErr.message);
        // don't block login if merge fails
      }
    }

    const token = generateToken({
      id: user._id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res
      .status(500)
      .json({ message: "Login failed", error: err.message });
  }
};
