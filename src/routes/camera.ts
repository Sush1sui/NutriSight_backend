import { Router } from "express";
import {
  barcodeHandler,
  getFoodDataHandler,
  predictFoodHandler,
} from "../controllers/cameraController";
import class_names from "../cnn_model/class_names.json";

const router = Router();

router.get("/food-classes", (_req, res) => {
  return res.json(class_names);
});

router.post("/barcode", barcodeHandler);
router.post("/predict-food", predictFoodHandler);
router.post("/get-food-data", getFoodDataHandler);

export default router;
