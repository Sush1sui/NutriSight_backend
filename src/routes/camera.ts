import { Router } from "express";
import {
  barcodeHandler,
  foodScanHandler,
} from "../controllers/cameraController";

const router = Router();

router.post("/barcode", barcodeHandler);
router.post("/food-scan", foodScanHandler);

export default router;
