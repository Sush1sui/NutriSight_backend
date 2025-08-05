import { Request, Response } from "express";

const USDA_API_KEY = process.env.USDA_API_KEY;
if (!USDA_API_KEY) {
  console.error("USDA_API_KEY is not set in the environment variables.");
  process.exit(1);
}
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
if (!HUGGINGFACE_API_KEY) {
  console.error("HUGGINGFACE_API_KEY is not set in the environment variables.");
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
      console.error("Failed to fetch data from USDA API");
      res.status(500).json({ error: "Failed to fetch data from USDA API" });
      return;
    }

    const data: any = await response.json();
    const food = data?.foods ? data.foods[0] : null;
    if (food) {
      const foodNutrients = chunkArray(
        renameNutrition(
          food.foodNutrients
            .filter((n: any) => n.value >= 0.1)
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
    }

    // fallback to Open Food Facts if USDA API fails
    const offResponse = await fetch(
      `https://world.openfoodfacts.net/api/v2/product/${barcodeData}.json`,
      {
        headers: {
          "User-Agent": "nutrisight-thesis/1.0 - (github.com/Sush1sui)",
        },
      }
    );

    if (!offResponse.ok) {
      console.error("Failed to fetch data from Open Food Facts API");
      res.status(500).json({ error: "Failed to fetch data." });
      return;
    }

    const offData = (await offResponse.json()) as any;
    if (!offData.product) {
      console.log("No product found for the barcode:", barcodeData);
      res.status(404).json({ error: "No product found for the barcode" });
      return;
    }

    res.status(200).json({
      message: "Barcode data received successfully from Open Food Facts",
      data: {
        name: offData.product.product_name || "Unknown",
        brand: offData.product.brands || "Unknown",
        ingredients: offData.product.ingredients_text || "N/A",
        nutrition: chunkArray(
          formatNutriments(offData.product.nutriments).filter(
            (n: any) => n.amount >= 0.1
          ),
          6
        ).map((groupOf6) => chunkArray(groupOf6, 2)),
        servingSize: offData.product.serving_size || "N/A",
      },
    });
    return;
  } catch (error) {
    console.error("Error processing barcode:", error);
    res.status(500).json({ message: "Internal server error" });
  }
  return;
}

export async function foodScanHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      console.error("User not authenticated");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { image } = req.body;
    if (!image) {
      console.error("No image provided for food scan");
      res.status(400).json({ message: "No image provided" });
      return;
    }

    // send image to hugging face for inference api
    const imgBuffer = Buffer.from(image, "base64");
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/nateraw/food",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/octet-stream",
        },
        body: imgBuffer,
      }
    );

    if (!hfRes.ok) {
      const errBody = await hfRes.text();
      console.error("Hugging Face API error:", errBody);
      res.status(500).json({
        error: "Failed to fetch data from Hugging Face",
        message: errBody,
      });
      return;
    }

    const predictions = (await hfRes.json()) as any[];
    if (!predictions || predictions.length === 0) {
      console.error("No food items detected in the image");
      res.status(404).json({ error: "No food items detected in the image" });
      return;
    }

    if (predictions.length === 0 || predictions[0].score < 0.5) {
      console.error("No food items predicted close to the image");
      res
        .status(404)
        .json({ error: "No food items predicted close to the image" });
      return;
    }

    const response = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
        predictions[0].label
      )}&dataType=Survey (FNDDS),Branded&api_key=${USDA_API_KEY}`
    );

    if (!response.ok) {
      console.error("Failed to fetch data from USDA API");
      res.status(500).json({ error: "Failed to fetch data from USDA API" });
      return;
    }

    const data = (await response.json()) as any;

    const results: {
      nutrition?: any[][][];
      ingredients?: string;
      foodName?: string;
      servingSize?: string;
    } = {
      foodName: predictions[0].label,
    };

    // get the first food with survey dataType
    if (data.foods && data.foods.length > 0) {
      for (const f of data.foods) {
        if (f.dataType === "Survey (FNDDS)") {
          results.nutrition = chunkArray(
            renameNutrition(
              f.foodNutrients
                .filter((n: any) => n.value >= 0.1)
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

          break;
        }
      }
      for (const f of data.foods) {
        if (
          f.dataType === "Branded" &&
          (f.packageWeight || (f.servingSize && f.servingSizeUnit)) &&
          f.ingredients
        ) {
          results.ingredients = f.ingredients;
          results.servingSize = f.packageWeight
            ? f.packageWeight
            : `${f.servingSize}${f.servingSizeUnit}`;
          break;
        }
      }
    }

    res.status(200).json({
      message: "Food scan data received successfully",
      data: results,
    });
    return;
  } catch (error) {
    console.error("Error processing food scan:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
}

function formatNutriments(nutriments: any) {
  const nutrientList: any = [];
  // A list of the main nutrient keys we care about
  const mainNutrients = [
    "energy-kcal",
    "fat",
    "saturated-fat",
    "trans-fat",
    "cholesterol",
    "carbohydrates",
    "sugars",
    "fiber",
    "proteins",
    "salt",
    "sodium",
    "vitamin-a",
    "vitamin-c",
    "vitamin-d",
    "calcium",
    "iron",
    "potassium",
  ];

  mainNutrients.forEach((key) => {
    // Check if the nutrient exists and has a value
    if (nutriments[key] !== undefined && nutriments[key] > 0) {
      nutrientList.push({
        name: capitalizeFirstLetter(key.replace(/-/g, " ")), // Make the name more readable
        amount: nutriments[key],
        // The unit is usually in a corresponding key like 'proteins_unit'
        unit: nutriments[`${key}_unit`] || "g", // Default to 'g' if no unit
      });
    }
  });
  return nutrientList;
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

function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
