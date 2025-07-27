import { Router } from "express";
import upload from "../middleware/multer";
import { changeProfilePicture } from "../controllers/accountController";

const router = Router();

router.post(
  "/change-profile-picture",
  upload.single("profilePicture"), // field name in form data
  changeProfilePicture
);

export default router;
