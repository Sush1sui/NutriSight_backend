import { Request, Response } from "express";

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

    const { barcodeData } = req.body;
    if (!barcodeData) {
      res.status(400).json({ message: "No barcode data provided" });
      return;
    }

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

    const foodNutrients = food.foodNutrients.map((n: any) => {
      return {
        name: n.nutrientName,
        amount: n.value,
        unit: n.unitName,
      };
    });

    res.status(200).json({
      message: "Barcode data received successfully",
      data: {
        name: food.description,
        brand: food.brandOwner,
        ingredients: food.ingredients,
        nutrition: foodNutrients,
      },
    });
    return;
  } catch (error) {
    console.error("Error processing barcode:", error);
    res.status(500).json({ message: "Internal server error" });
  }
  return;
}
