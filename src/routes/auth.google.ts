import express from "express";
import passport from "passport";

const router = express.Router();

// Google OAuth2 login
router.get(
  "/",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth2 callback
router.get(
  "/callback",
  passport.authenticate("google", {
    successRedirect: "/success",
    failureRedirect: "/auth/login",
    session: true,
  }),
  (req, res) => {
    res.json({ message: "Google OAuth2 login successful", user: req.user });
  }
);

export default router;
