// models/Cart.js
import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  ornament: { type: mongoose.Schema.Types.ObjectId, ref: "Ornament", required: true },
  quantity: { type: Number, default: 1, min: 1 },
}, { _id: false });

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },   // when logged-in
    guestId: { type: String, default: null, index: true },                       // when guest
    items: [cartItemSchema],
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;
