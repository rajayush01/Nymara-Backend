import express from "express";
import {signup} from "../controllers/signupcontroller.js";
import { login } from "../controllers/logincontroller.js";

const router = express.Router();

// ✅ Routes
router.post("/signup", signup);
router.post("/login", login);

export default router;
