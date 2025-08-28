import { Router } from "express";
import upload from "../middleware/cloudinary";
import {
  changeProfilePicture,
  updateAccount,
} from "../controllers/accountController";

const router = Router();

router.post(
  "/change-profile-picture",
  upload.single("profilePicture"), // field name in form data
  changeProfilePicture
);

router.put("/update", updateAccount);

export default router;
