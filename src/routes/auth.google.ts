import express from "express";
import passport from "passport";

const router = express.Router();

// Google OAuth2 login
router.get(
  "/",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth2 callback for React Native
router.get("/callback", (req, res, next) => {
  passport.authenticate("google", (err: any, user: any, _info: any) => {
    if (err) {
      // Handle internal server errors
      res
        .status(500)
        .json({ message: "Authentication error", error: err.message });
      return;
    }
    if (!user) {
      res.redirect("nutrisight://auth/failure");
      return;
    }
    // Manually login the user to establish a session
    req.logIn(user, (err) => {
      if (err) {
        res.redirect("nutrisight://auth/failure?error=login_failed");
        return;
      }
      // On success, redirect to a success path, passing user data.
      // The session is established on the server via a cookie that the
      // in-app browser will handle.
      const userJson = JSON.stringify({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
      });
      res.redirect(
        `nutrisight://auth/success?user=${encodeURIComponent(userJson)}`
      );
      return;
    });
    return;
  })(req, res, next);
});

export default router;
