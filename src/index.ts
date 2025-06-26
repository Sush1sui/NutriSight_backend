import "dotenv/config";
import express from "express";
import session from "express-session";
import passport from "passport";
import "./middleware/passport";
import authGoogleRoutes from "./routes/auth.google";
import authLocalRoutes from "./routes/auth.local";
import { connectDB } from "./db";
import MongoStore from "connect-mongo";

const SERVER_LINK = process.env.SERVER_LINK;
let timeoutId: NodeJS.Timeout;

const app = express();
app.set("trust proxy", 1); // Trust the first proxy
app.use(express.json());

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || "nutrisightsecret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      dbName: "NutriSight",
      collectionName: "sessions",
      ttl: 14 * 24 * 60 * 60, // 14 days in seconds
    }),
    cookie: {
      maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days in ms
      secure: process.env.NODE_ENV === "production", // Only send cookie over HTTPS in production
      httpOnly: true, // Prevent client-side JS from accessing the cookie
      sameSite: "lax", // Or 'strict' depending on your needs
    },
  })
);

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth/google", authGoogleRoutes);
app.use("/auth", authLocalRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Welcome to NutriSight Backend API" });
});

app.get("/debug-protocol", (req, res) => {
  res.json({
    protocol: req.protocol,
    hostname: req.hostname,
    full_url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
  });
});

app.get("/success", (req, res) => {
  res.json({ message: "Authentication successful", user: req.user });
});

// MongoDB connection
connectDB();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function pingServer() {
  if (!SERVER_LINK) return;

  const attemptPing = () => {
    fetch(SERVER_LINK)
      .then((res) => res.text())
      .then((text) => console.log(`Ping successful: ${text}`))
      .catch((err) => {
        clearTimeout(timeoutId);
        console.log(`Ping failed, retrying: ${err}`);
        timeoutId = setTimeout(attemptPing, 5000);
      });
  };

  attemptPing(); // Start the ping loop immediately
}

setInterval(pingServer, 600000);
