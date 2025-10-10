// routes/cartRoutes.js
import express from "express";
import {
  initGuestCart,
  addToGuestCart,
  getGuestCart,
  removeGuestCartItem,
  addToUserCart,
  getUserCart,
  updateUserCartItem,
  removeUserCartItem,
} from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Guest endpoints
router.post("/guest/init", initGuestCart);                 // create guestId
router.post("/guest/add", addToGuestCart);                 // add to guest cart
router.get("/guest/:guestId", getGuestCart);               // get guest cart
router.delete("/guest/remove/:guestId/:ornamentId", removeGuestCartItem);


router.post("/user/add", protect, addToUserCart);          // add to logged-in user's cart
router.get("/user", protect, getUserCart);                 // get user's cart
router.put("/user/update", protect, updateUserCartItem);   // update quantity
router.delete("/user/remove/:ornamentId", protect, removeUserCartItem);

export const cartRoutes = router;
