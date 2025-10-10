import express from "express";
import sendEmail from "../emailer/sendEmail.js";  // ✅ import your utility

const router = express.Router();

router.post("/request", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      caratWeight,
      shape,
      color,
      clarity,
      budget,
      message,
    } = req.body;

    // Format the HTML message
    const htmlMessage = `
      <h2>New Bespoke Diamond Request</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <hr/>
      <p><strong>Carat Weight:</strong> ${caratWeight}</p>
      <p><strong>Shape:</strong> ${shape}</p>
      <p><strong>Color:</strong> ${color}</p>
      <p><strong>Clarity:</strong> ${clarity}</p>
      <p><strong>Budget:</strong> ${budget}</p>
      <p><strong>Message:</strong> ${message}</p>
    `;

    // Use your utility function
    await sendEmail({
      email: "jenasaisubham8@gmail.com", // ✅ destination inbox
      subject: "New Custom Diamond Request - Nymara Jewels",
      message: htmlMessage,
    });

    res.json({ success: true, message: "Bespoke request sent successfully" });
  } catch (error) {
    console.error("❌ Failed to send bespoke request:", error.message);
    res.status(500).json({ success: false, message: "Failed to send request" });
  }
});

export default router;
