import { Router } from "express";
import {
  barcodeHandler,
  foodScanHandler,
  getFoodDataHandler,
} from "../controllers/cameraController";

const router = Router();

router.post("/barcode", barcodeHandler);
router.post("/food-scan", foodScanHandler);
router.post("/get-food-data", getFoodDataHandler);

export default router;
