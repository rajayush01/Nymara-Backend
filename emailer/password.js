// controllers/passwordController.js
import crypto from "crypto";
import UserModel from "../models/User.js";
import sendEmail from "./sendEmail.js";

// Forgot password
export const forgetPassword = async (req, res) => {
  let user;
  try {
    const { email } = req.body;
    user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Email does not exist, please enter correct email",
      });
    }

    // 🔹 Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const message = `
      <h1>You have requested a password reset</h1>
      <p>Please click the link below to reset your password:</p>
      <a href="${resetUrl}" clicktracking="off">${resetUrl}</a>
      <p>This link is valid for 15 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `;

    await sendEmail({
      email: user.email,
      subject: "Password Reset Request",
      message,
    });

    res.status(200).json({ success: true, data: "Email Sent" });
  } catch (error) {
    console.error("Forgot Password Error:", error);

    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }

    res
      .status(500)
      .json({ success: false, error: "Email could not be sent" });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await UserModel.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(201).json({
      success: true,
      data: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
