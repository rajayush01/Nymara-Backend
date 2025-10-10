import User from "../models/User.js";
import UserDetails from "../models/UserDetails.js";

// 🔹 Save / Update user details
export const saveUserDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { firstName, lastName, email, phoneNumber, address } = req.body;

    // 🔹 Validate
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }
    if (!address || typeof address !== "object") {
      return res.status(400).json({ success: false, message: "Address must be an object" });
    }

    // 🔹 Update User (basic info)
    const name = [firstName, lastName].filter(Boolean).join(" ");
    await User.findByIdAndUpdate(userId, { name, email, phoneNumber });

    // 🔹 Update or create UserDetails (profile info)
    const details = await UserDetails.findOneAndUpdate(
      { userId },
      { address },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: "User details saved successfully",
      details,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to save user details",
      error: err.message,
    });
  }
};

// 🔹 Get logged-in user's full details
export const getUserDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Fetch from User collection
    const user = await User.findById(userId).select("name email phoneNumber isAdmin");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Fetch from UserDetails collection
    const details = await UserDetails.findOne({ userId }).populate("orderIds");

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isAdmin: user.isAdmin,
      },
      details: details || null,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
      error: err.message,
    });
  }
};
