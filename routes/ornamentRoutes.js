import express from "express";
import {
  addOrnament,
  getOrnaments,
  updateOrnament,
  deleteOrnament,
  uploadOrnamentImages,
  getOrnamentById,
  
} from "../controllers/ornamentController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { updatePricing } from "../controllers/pricingController.js";
import Ornament from "../models/Ornament.js";
import { get } from "mongoose";

const router = express.Router();

// ✅ Only admins can manage ornaments
router.post("/add", protect, adminOnly,uploadOrnamentImages, addOrnament);
router.get("/",protect,adminOnly,getOrnaments);
router.put("/edit/:id", protect, adminOnly, uploadOrnamentImages,updateOrnament);
router.delete("/delete/:id", protect, adminOnly, deleteOrnament);
router.put("/pricing", protect,adminOnly, updatePricing);
router.get("/:id", protect, adminOnly, getOrnamentById);

export default router;
