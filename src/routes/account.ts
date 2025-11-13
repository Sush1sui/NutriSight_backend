import { Router } from "express";
import upload from "../middleware/cloudinary";
import {
  changeProfilePicture,
  updateAccount,
  updateDietHistory,
  getDietHistoryByDate,
  deleteDietHistoryByDate,
  getRecommendationForTheDay,
} from "../controllers/accountController";

const router = Router();

router.post(
  "/change-profile-picture",
  upload.single("profilePicture"), // field name in form data
  changeProfilePicture
);

router.put("/update", updateAccount);
router.put("/update-diet-history", updateDietHistory);
router.post("/diet-history", getDietHistoryByDate);
router.delete("/diet-history", deleteDietHistoryByDate);
router.get("/recommend-foods", getRecommendationForTheDay);

export default router;
