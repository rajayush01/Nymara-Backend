// user signup controller
import UserModel from "../models/User.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { mergeGuestCartToUser } from "./cartController.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

// 🔹 Helper to generate JWT
const generateToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: "3h" });

export const signup = async (req, res) => {
  try {
    // 🔹 Extract data from request body
    const { name, email, phoneNumber, password, guestId } = req.body;

    // 🔹 Validate required fields
    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({ 
        message: "Name, email, phone number, and password are required" 
      });
    }

    // 🔹 Password length check
    if (password.length < 6) {
      return res.status(400).json({ 
        message: "Password must be at least 6 characters long" 
      });
    }

    // 🔹 Check if user already exists (by email OR phone)
    const existingUser = await UserModel.findOne({ 
      $or: [{ email }, { phoneNumber }] 
    });
    if (existingUser) {
      return res.status(400).json({ 
        message: "User already exists with this email or phone number" 
      });
    }

    // 🔹 Create user
    const user = await UserModel.create({ 
      name, 
      email, 
      phoneNumber, 
      password 
    });

    // 🔹 Merge guest cart if guestId provided
    if (guestId) {
      try {
        await mergeGuestCartToUser(guestId, user._id);
      } catch (mergeErr) {
        console.error("Cart merge failed on signup:", mergeErr.message);
      }
    }

    // 🔹 Generate JWT token
    const token = generateToken({ 
      id: user._id, 
      email: user.email, 
      phoneNumber: user.phoneNumber, 
      name: user.name, 
      isAdmin: user.isAdmin 
    });

    // 🔹 Send success response
    res.status(201).json({
      message: "Signup successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isAdmin: user.isAdmin,
      },
    });

  } catch (err) {
    console.error("Signup Error:", err.message);
    res.status(500).json({ 
      message: "Signup failed", 
      error: err.message 
    });
  }
};
