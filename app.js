// main file
// mongo config
// routes
// admin seeding


import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors"; // ✅ Import CORS
import authRoutes from "./routes/authRoutes.js";
import AdminModel from "./models/Admin.js";
import ornamentRoutes from "./routes/ornamentRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import {cartRoutes} from "./routes/cartRoutes.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import bespokeRoutes from "./routes/bespoke.js";
import corporateRoutes from "./routes/corporate.js";
import appointments from "./routes/appointments.js";
import chatRoutes from "./routes/chatRoutes.js";


import bcrypt from "bcryptjs";


dotenv.config();

const app = express();
app.use(express.json());



app.use(cors());

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));





// MongoDB connection inside server.js
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log("✅ MongoDB connected");

  // 🔹 Always reset or upsert admin
  try {
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

    await AdminModel.findOneAndUpdate(
      { email: process.env.ADMIN_EMAIL }, // find by email
      {
        name: "Super Admin",
        email: process.env.ADMIN_EMAIL,
        password: hashedPassword,
      },
      { upsert: true, new: true } // create if not exists
    );

    console.log("✅ Admin seeded/updated successfully");
  } catch (err) {
    console.error("❌ Admin seeding failed:", err.message);
  }
})
.catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
  process.exit(1);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/ornaments", ornamentRoutes);
app.use("/api/user", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/bespoke", bespokeRoutes);
app.use("/api/corporate", corporateRoutes);
app.use("/api/appointments", appointments);
app.use("/api/chat",chatRoutes);





  
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`hi Server running on port ${PORT}`));
