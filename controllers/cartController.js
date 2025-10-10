// controllers/cartController.js
import { v4 as uuidv4 } from "uuid";
import Cart from "../models/Cart.js";
import Ornament from "../models/Ornament.js";

/**
 * Create a guest cart and return guestId 
 * POST /api/cart/guest/init
 */
export const initGuestCart = async (req, res) => {
  try {
    const guestId = uuidv4();
    const cart = new Cart({ guestId, items: [] });
    await cart.save();
    return res.status(201).json({ success: true, guestId, cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to create guest cart", error: err.message });
  }
};

/**
 * Add item to guest cart
 * POST /api/cart/guest/add
 * body: { guestId?, ornamentId, quantity }
 */
export const addToGuestCart = async (req, res) => {
  try {
    let { guestId, ornamentId, quantity } = req.body;

    if (!ornamentId) {
      return res.status(400).json({ success: false, message: "ornamentId is required" });
    }

    // 🔹 CHANGE: Auto-generate guestId if not provided
    if (!guestId) {
      guestId = uuidv4();
    }

    const ornament = await Ornament.findById(ornamentId);
    if (!ornament) return res.status(404).json({ success: false, message: "Ornament not found" });

    let cart = await Cart.findOne({ guestId });
    if (!cart) cart = new Cart({ guestId, items: [] });

    const existing = cart.items.find(i => i.ornament.toString() === ornamentId);
    if (existing) existing.quantity += (quantity || 1);
    else cart.items.push({ ornament: ornamentId, quantity: quantity || 1 });

    await cart.save();
    await cart.populate("items.ornament");

    // 🔹 CHANGE: return guestId in response (important for first-time guest)
    return res.json({ success: true, message: "Added to guest cart", guestId, cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to add to guest cart", error: err.message });
  }
};

/**
 * Get guest cart
 * GET /api/cart/guest/:guestId
 */
export const getGuestCart = async (req, res) => {
  try {
    const { guestId } = req.params;
    if (!guestId) return res.status(400).json({ success: false, message: "guestId required" });

    const cart = await Cart.findOne({ guestId }).populate("items.ornament");
    if (!cart) return res.json({ success: true, cart: { items: [] } });

    return res.json({ success: true, cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch guest cart", error: err.message });
  }
};

/**
 * Add item to logged-in user's cart
 * POST /api/cart/user/add
 */
export const addToUserCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { ornamentId, quantity } = req.body;
    if (!ornamentId) return res.status(400).json({ success: false, message: "ornamentId required" });

    const ornament = await Ornament.findById(ornamentId);
    if (!ornament) return res.status(404).json({ success: false, message: "Ornament not found" });

    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = new Cart({ user: userId, items: [] });

    const existing = cart.items.find(i => i.ornament.toString() === ornamentId);
    if (existing) existing.quantity += (quantity || 1);
    else cart.items.push({ ornament: ornamentId, quantity: quantity || 1 });

    await cart.save();
    await cart.populate("items.ornament");
    return res.json({ success: true, message: "Added to cart", cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to add to cart", error: err.message });
  }
};

/**
 * Get user's cart (protected)
 * GET /api/cart/user
 */
export const getUserCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const cart = await Cart.findOne({ user: userId }).populate("items.ornament");
    if (!cart) return res.json({ success: true, cart: { items: [] } });
    return res.json({ success: true, cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch cart", error: err.message });
  }
};

/**
 * Update item quantity in user cart (protected)
 * PUT /api/cart/user/update
 */
export const updateUserCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { ornamentId, quantity } = req.body;
    if (!ornamentId || typeof quantity !== "number") {
      return res.status(400).json({ success: false, message: "ornamentId and numeric quantity required" });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const item = cart.items.find(i => i.ornament.toString() === ornamentId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found in cart" });

    item.quantity = quantity;
    await cart.save();
    await cart.populate("items.ornament");
    return res.json({ success: true, message: "Cart updated", cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update cart", error: err.message });
  }
};

/**
 * Remove item from user cart (protected)
 * DELETE /api/cart/user/remove/:ornamentId
 */
export const removeUserCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const ornamentId = req.params.ornamentId;
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    cart.items = cart.items.filter(i => i.ornament.toString() !== ornamentId);
    await cart.save();
    await cart.populate("items.ornament");
    return res.json({ success: true, message: "Item removed", cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to remove item", error: err.message });
  }
};

/**
 * Remove item from guest cart
 * DELETE /api/cart/guest/remove/:guestId/:ornamentId
 */
export const removeGuestCartItem = async (req, res) => {
  try {
    const { guestId, ornamentId } = req.params;
    const cart = await Cart.findOne({ guestId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    cart.items = cart.items.filter(i => i.ornament.toString() !== ornamentId);
    await cart.save();
    await cart.populate("items.ornament");
    return res.json({ success: true, message: "Item removed from guest cart", cart });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to remove guest item", error: err.message });
  }
};

/**
 * Merge guest cart into user cart (internal utility)
 * Call when user logs in (pass guestId from frontend)
 */
export const mergeGuestCartToUser = async (guestId, userId) => {
  if (!guestId) return;
  const guestCart = await Cart.findOne({ guestId });
  if (!guestCart || !guestCart.items || guestCart.items.length === 0) return;

  let userCart = await Cart.findOne({ user: userId });
  if (!userCart) userCart = new Cart({ user: userId, items: [] });

  for (const gItem of guestCart.items) {
    const existing = userCart.items.find(i => i.ornament.toString() === gItem.ornament.toString());
    if (existing) existing.quantity += gItem.quantity;
    else userCart.items.push({ ornament: gItem.ornament, quantity: gItem.quantity });
  }

  await userCart.save();
  await Cart.deleteOne({ guestId }); // cleanup guest cart
  return userCart;
};
