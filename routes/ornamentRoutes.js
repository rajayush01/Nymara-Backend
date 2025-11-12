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
import { updatePricing, getPricing } from "../controllers/pricingController.js";
import upload from "../cloud/upload.js";


const router = express.Router();

/* ----------------------------------------
   ✅ PRICING ROUTES — Must be placed FIRST
---------------------------------------- */
router.get("/pricing", protect, adminOnly, getPricing);
router.put("/pricing", protect, adminOnly, updatePricing);

/* ----------------------------------------
   ✅ ORNAMENT CRUD ROUTES
---------------------------------------- */
router.post("/add", protect, adminOnly, upload.any(), addOrnament);

router.get("/", protect, adminOnly, getOrnaments);
router.put("/edit/:id", protect, adminOnly, upload.any(), updateOrnament);
router.delete("/delete/:id", protect, adminOnly, deleteOrnament);
router.get("/:id", protect, adminOnly, getOrnamentById);

export default router;
