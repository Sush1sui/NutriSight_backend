import { Request, Response } from "express";
import cloudinary from "../middleware/cloudinary";
import UserAccount from "../models/UserAccount";

export const changeProfilePicture = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // upload the image to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "user_profiles",
    });

    // update user in DB
    const uid = (req.user as { _id: string })._id;
    const user = await UserAccount.findByIdAndUpdate(
      uid,
      { profileLink: result.secure_url },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({
      message: "Profile picture updated successfully",
      profileLink: user.profileLink,
    });
  } catch (error) {
    console.error("Error changing profile picture:", error);
    res.status(500).json({ error: "Internal server error" });
  }
  return;
};
