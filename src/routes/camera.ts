import { Router } from "express";
import { barcodeHandler } from "../controllers/cameraController";

const router = Router();

router.post("/barcode", barcodeHandler);

export default router;
