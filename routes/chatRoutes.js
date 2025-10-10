import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { protect } from "../middleware/authMiddleware.js"; // your middleware

dotenv.config();
const router = express.Router();

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Protected Route: Send welcome email + chatbot reply
router.post("/welcome", protect, async (req, res) => {
  try {
    const { name, email } = req.user; // ✅ taken from JWT

    // Send welcome email
    const mailOptions = {
      from: `"Nymara Jewels" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Welcome to Nymara, ${name}!`,
      html: `
        <h2>Hello ${name},</h2>
        <p>Thank you for chatting with our AI Assistant 💎</p>
        <p>We’re excited to assist you with your jewelry journey.</p>
        <p>Our team will reach out if needed, meanwhile feel free to ask me anything ✨</p>
        <br/>
        <p>Best regards,<br/>Nymara Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    const botMessage = `Welcome back, ${name}! ✨ I've sent a welcome email to ${email}. How can I assist you today?`;

    res.json({ success: true, botMessage });
  } catch (error) {
    console.error("❌ Error in chat welcome route:", error.message);
    res.status(500).json({ success: false, message: "Failed to send welcome message" });
  }
});

export default router;
