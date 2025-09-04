import { Router } from "express";
import {
  barcodeHandler,
  getFoodDataHandler,
} from "../controllers/cameraController";

const router = Router();

router.post("/barcode", barcodeHandler);
router.post("/get-food-data", getFoodDataHandler);

export default router;
