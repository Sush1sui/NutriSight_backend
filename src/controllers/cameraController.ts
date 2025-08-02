import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";
import { Request, Response } from "express";
import sharp from "sharp";

const USDA_API_KEY = process.env.USDA_API_KEY;
if (!USDA_API_KEY) {
  console.error("USDA_API_KEY is not set in the environment variables.");
  process.exit(1);
}

export async function barcodeHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: "Image data is required" });
      return;
    }

    // remove data uri prefix if it exists
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, "base64");

    // convert image to raw pixel data (rgba)
    const { data: imgData, info } = await sharp(imgBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Convert Buffer to Uint8ClampedArray
    const pixelArray = new Uint8ClampedArray(
      imgData.buffer,
      imgData.byteOffset,
      imgData.length
    );

    // prep zxing reader
    const luminanceSource = new RGBLuminanceSource(
      pixelArray,
      info.width,
      info.height
    );
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
    const reader = new MultiFormatReader();

    // set hints for barcode formats
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ]);
    reader.setHints(hints);

    // decode the barcode
    const barcodeData = reader.decode(binaryBitmap).getText();
    if (!barcodeData) {
      res.status(400).json({ error: "No barcode data found" });
      return;
    }
    console.log("Decoded barcode data:", barcodeData);

    const response = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${barcodeData}`,
      {
        headers: {
          "x-api-key": USDA_API_KEY,
        },
      }
    );

    if (!response.ok) {
      res.status(500).json({ error: "Failed to fetch data from USDA API" });
      return;
    }

    const data: any = await response.json();
    const food = data?.foods ? data.foods[0] : null;
    if (!food) {
      res.status(404).json({ error: "No food found for the barcode" });
      return;
    }

    const foodNutrients = chunkArray(
      renameNutrition(
        food.foodNutrients
          .filter((n: any) => n.value !== 0)
          .map((n: any) => {
            return {
              name: n.nutrientName,
              amount: n.value,
              unit: n.unitName,
            };
          })
      ),
      6
    ).map((groupOf6) => chunkArray(groupOf6, 2));

    res.status(200).json({
      message: "Barcode data received successfully",
      data: {
        name: food.description,
        brand: food.brandOwner,
        ingredients: food.ingredients,
        nutrition: foodNutrients, // T[][][]
        servingSize: `${food.servingSize}${food.servingSizeUnit}`,
      },
    });
    return;
  } catch (error) {
    console.error("Error processing barcode:", error);
    res.status(500).json({ message: "Internal server error" });
  }
  return;
}

function renameNutrition(arr: any[]) {
  return arr.map((item: any) => {
    if (
      (item.name as string).toLowerCase() === "fatty acids, total saturated"
    ) {
      return { ...item, name: "Saturated Fats" };
    }
    if ((item.name as string).toLowerCase() === "fatty acids, total trans") {
      return { ...item, name: "Trans Fats" };
    }
    if (
      (item.name as string).toLowerCase() ===
      "vitamin d (d2 + d3), international units"
    ) {
      return { ...item, name: "Vitamin D2 + D3" };
    }
    if ((item.name as string).toLowerCase() === "potassium, k") {
      return { ...item, name: "Potassium" };
    }
    if ((item.name as string).toLowerCase() === "sodium, na") {
      return { ...item, name: "Sodium" };
    }
    if ((item.name as string).toLowerCase() === "calcium, ca") {
      return { ...item, name: "Calcium" };
    }
    if ((item.name as string).toLowerCase() === "iron, fe") {
      return { ...item, name: "Iron" };
    }
    if ((item.name as string).toLowerCase() === "fiber, total dietary") {
      return { ...item, name: "Dietary Fiber" };
    }
    if ((item.name as string).toLowerCase() === "total sugars") {
      return { ...item, name: "Sugar" };
    }
    if ((item.name as string).toLowerCase() === "carbohydrate, by difference") {
      return { ...item, name: "Carbohydrates" };
    }
    return item;
  });
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
