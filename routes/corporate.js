import express from "express";
import sendEmail from "../emailer/sendEmail.js";

const router = express.Router();

// Corporate gifting inquiry route
router.post("/inquiry", async (req, res) => {
  try {
    const {
      companyName,
      contactName,
      email,
      phone,
      quantity,
      occasion,
      budget,
      message,
    } = req.body;

    // Build HTML email content
    const htmlMessage = `
      <h2>New Corporate Gifting Inquiry</h2>
      <p><strong>Company Name:</strong> ${companyName}</p>
      <p><strong>Contact Person:</strong> ${contactName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <hr/>
      <p><strong>Quantity Needed:</strong> ${quantity}</p>
      <p><strong>Occasion:</strong> ${occasion}</p>
      <p><strong>Budget Range:</strong> ${budget}</p>
      <p><strong>Message:</strong> ${message}</p>
    `;

    // Send email
    await sendEmail({
      email: "jenasaisubham8@gmail.com", // destination inbox
      subject: "Corporate Gifting Inquiry - Nymara Jewels",
      message: htmlMessage,
    });

    res.json({ success: true, message: "Inquiry sent successfully!" });
  } catch (error) {
    console.error("❌ Failed to send corporate inquiry:", error.message);
    res.status(500).json({ success: false, message: "Failed to send inquiry" });
  }
});

export default router;
