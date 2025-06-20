import "dotenv/config";
import express from "express";
import session from "express-session";
import passport from "passport";
import "./middleware/passport";
import authGoogleRoutes from "./routes/auth.google";
import authLocalRoutes from "./routes/auth.local";
import { connectDB } from "./db";
import MongoStore from "connect-mongo";

const app = express();
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
    cookie: { maxAge: 14 * 24 * 60 * 60 * 1000 }, // 14 days in ms
  })
);

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth/google", authGoogleRoutes);
app.use("/auth", authLocalRoutes);

app.get("/success", (req, res) => {
  res.json({ message: "Authentication successful", user: req.user });
});

// MongoDB connection
connectDB();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
