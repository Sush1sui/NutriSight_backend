import { Router } from "express";
import {
  barcodeHandler,
  getFoodDataHandler,
  predictFoodHandler,
} from "../controllers/cameraController";

const router = Router();

router.post("/barcode", barcodeHandler);
router.post("/predict-food", predictFoodHandler);
router.post("/get-food-data", getFoodDataHandler);

export default router;
