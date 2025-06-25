import express from "express";
import passport from "passport";
import "express-session"; // Import for side-effects to enable module augmentation

// Extend the Express session interface to include our custom property
declare module "express-session" {
  interface SessionData {
    isMobile?: boolean;
  }
}

const router = express.Router();

// Google OAuth2 login
router.get("/", (req, res, next) => {
  // We'll use a query parameter to distinguish clients.
  // React Native will send ?platform=mobile
  const isMobile = req.query.platform === "mobile";
  if (req.session) {
    req.session.isMobile = isMobile;
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next
  );
});

// Google OAuth2 callback for both Web and React Native
router.get("/callback", (req, res, next) => {
  passport.authenticate("google", (err: any, user: any, _info: any) => {
    const isMobile = req.session?.isMobile;

    if (err) {
      console.error("Authentication error:", err);
      if (isMobile) {
        return res.redirect("nutrisight://auth/failure?error=auth_error");
      }
      // For web, show an error page and close the popup
      return res
        .status(500)
        .send(
          "<h1>Authentication Error</h1><p>Something went wrong. Please try again.</p><script>setTimeout(window.close, 3000);</script>"
        );
    }
    if (!user) {
      if (isMobile) {
        return res.redirect("nutrisight://auth/failure");
      }
      // For web, just close the popup. The parent window will handle it.
      return res.send("<script>window.close();</script>");
    }

    req.logIn(user, (loginErr) => {
      // Clean up the session flag regardless of login outcome
      if (req.session) {
        delete req.session.isMobile;
      }

      if (loginErr) {
        console.error("Login error after Google auth:", loginErr);
        if (isMobile) {
          return res.redirect("nutrisight://auth/failure?error=login_failed");
        }
        return res
          .status(500)
          .send(
            "<h1>Login Error</h1><p>Could not log you in. Please try again.</p><script>setTimeout(window.close, 3000);</script>"
          );
      }

      if (isMobile) {
        // MOBILE: Redirect to the custom scheme for the app to handle.
        const userJson = JSON.stringify({
          id: user.id,
          displayName: user.displayName,
          email: user.email,
        });
        res.redirect(
          `nutrisight://auth/success?user=${encodeURIComponent(userJson)}`
        );
      } else {
        // WEB: Send a script to close the popup.
        // The main window will get the session cookie and can update its state.
        res.send("<script>window.close();</script>");
      }
    });
  })(req, res, next);
});

export default router;
