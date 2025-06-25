import express from "express";
import { verifyGoogleToken } from "../controllers/authGoogleController";

const router = express.Router();

// Route to handle token verification from the client
router.post("/verify", verifyGoogleToken);

export default router;
