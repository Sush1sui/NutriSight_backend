import { Request, Response } from "express";
import { classifyImage } from "../utils/model_inference";
import * as fs from "fs";
import {
  chunkArray,
  filterStandardNutrients,
  formatNutriments,
  renameNutrition,
} from "../utils/foodCameraUtils";
import { NUTRITIONIX_NUTRIENT_MAP } from "../utils/nutritionixMap";
import {
  predictAllergensAndNutrition,
  scanAllergens,
} from "../utils/ingredientsNutritionsPredict";
import { convertToGrams } from "../utils/convertToGrams";

const USDA_API_KEY = process.env.USDA_API_KEY;
if (!USDA_API_KEY) {
  console.error("USDA_API_KEY is not set in the environment variables.");
  process.exit(1);
}

const NUTRITIONIX_APP_ID = process.env.NUTRITIONIX_APP_ID;
if (!NUTRITIONIX_APP_ID) {
  console.error("NUTRITIONIX_APP_ID is not set in the environment variables.");
  process.exit(1);
}

const NUTRITIONIX_API_KEY = process.env.NUTRITIONIX_API_KEY;
if (!NUTRITIONIX_API_KEY) {
  console.error("NUTRITIONIX_API_KEY is not set in the environment variables.");
  process.exit(1);
}

// const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
// if (!HUGGINGFACE_API_KEY) {
//   console.error("HUGGINGFACE_API_KEY is not set in the environment variables.");
//   process.exit(1);
// }

const classNames = JSON.parse(
  fs.readFileSync("src/cnn_models/class_names.json", "utf8")
);
const modelPath = "src/cnn_models/efficientnet_b3.onnx";

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

    let data: any = await response.json();
    const food = data?.foods ? data.foods[0] : null;
    data = null;
    if (food) {
      const foodNutrients = chunkArray(
        filterStandardNutrients(
          convertToGrams(
            food.foodNutrients
              .filter((n: any) => n.value >= 0.1)
              .map((n: any) => {
                return {
                  name: n.nutrientName,
                  amount: n.value,
                  unit: n.unitName,
                };
              })
          )
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
          filterStandardNutrients(
            convertToGrams(formatNutriments(offData.product.nutriments)).filter(
              (n: any) => n.amount >= 0.1
            )
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

    let imgBuffer: Buffer<ArrayBufferLike> | null = Buffer.from(
      image,
      "base64"
    );

    // send image to hugging face for inference api
    // const hfRes = await fetch(
    //   "https://api-inference.huggingface.co/models/nateraw/food",
    //   {
    //     method: "POST",
    //     headers: {
    //       Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
    //       "Content-Type": "application/octet-stream",
    //     },
    //     body: imgBuffer,
    //   }
    // );

    // if (!hfRes.ok) {
    //   const errBody = await hfRes.text();
    //   console.error("Hugging Face API error:", errBody);
    //   res.status(500).json({
    //     error: "Failed to fetch data from Hugging Face",
    //     message: errBody,
    //   });
    //   return;
    // }

    // const predictions = (await hfRes.json()) as any[];

    const predictions = await classifyImage(
      imgBuffer,
      modelPath,
      classNames,
      5
    );

    imgBuffer = null;

    if (!predictions || predictions.length === 0) {
      console.error("No food items detected in the image");
      res.status(404).json({ error: "No food items detected in the image" });
      return;
    }

    if (predictions.length === 0) {
      console.error("No food items predicted close to the image");
      res
        .status(404)
        .json({ error: "No food items predicted close to the image" });
      return;
    }

    res.status(200).json({
      message: "Food scan data received successfully",
      data: predictions,
    });
    return;
  } catch (error) {
    console.error("Error processing food scan:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
}

export async function getFoodDataHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      console.error("User not authenticated");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { foodName } = req.body;

    console.log("Attempting to fetch data from USDA API");
    const usda_response = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
        foodName
      )}&dataType=Survey (FNDDS),Branded&api_key=${USDA_API_KEY}`
    );

    if (usda_response.ok) {
      let data = (await usda_response.json()) as any;

      const results: {
        nutrition?: any[][][];
        ingredients?: string;
        foodName?: string;
        servingSize?: string;
      } = {
        foodName,
      };

      // get the first food with survey dataType
      if (data.foods && data.foods.length > 0) {
        for (const f of data.foods) {
          if (f.dataType === "Survey (FNDDS)") {
            results.nutrition = chunkArray(
              filterStandardNutrients(
                convertToGrams(
                  f.foodNutrients
                    .filter((n: any) => n.value >= 0.1)
                    .map((n: any) => {
                      return {
                        name: n.nutrientName,
                        amount: n.value,
                        unit: n.unitName,
                      };
                    })
                )
              ),
              6
            ).map((groupOf6) => chunkArray(groupOf6, 2));

            break;
          }
        }

        const ingredients = await scanAllergens(
          foodName,
          (req.user as any).allergens
        );
        console.log("Predicted ingredients:", ingredients);
        if (!ingredients || ingredients.length === 0) {
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
        } else {
          results.ingredients = ingredients.join(",");
          results.servingSize = "150g";
        }
      }

      data = null;

      if (results.nutrition && results.ingredients && results.servingSize) {
        res.status(200).json({
          message: "Food Data received successfully",
          data: results,
        });
        return;
      }
    }

    console.log("Attempting to fetch data from Nutritionix API");
    const nutritionix_response = await fetch(
      "https://trackapi.nutritionix.com/v2/natural/nutrients",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-id": NUTRITIONIX_APP_ID,
          "x-app-key": NUTRITIONIX_API_KEY,
        },
        body: JSON.stringify({ query: foodName }),
      }
    );

    if (nutritionix_response.ok) {
      let data: any = await nutritionix_response.json();

      const food = data.foods ? data.foods[0] : null;
      data = null;
      if (food) {
        const nutritionData = food.full_nutrients
          .map((n: { attr_id: number; value: number }) => {
            const nutrientInfo =
              NUTRITIONIX_NUTRIENT_MAP[
                n.attr_id as keyof typeof NUTRITIONIX_NUTRIENT_MAP
              ];
            if (nutrientInfo) {
              return {
                name: nutrientInfo.name,
                amount: n.value,
                unit: nutrientInfo.unit,
              };
            }
            return null;
          })
          .filter(Boolean);

        const ingredients = await scanAllergens(
          foodName,
          (req.user as any).allergens
        );
        console.log("Predicted ingredients:", ingredients);

        const result = {
          foodName: food.food_name,
          brand: "Generic", // Nutritionix common foods don't have a brand
          servingSize:
            ingredients.length > 0
              ? "150g"
              : `${food.serving_qty} ${food.serving_unit} (${food.serving_weight_grams}g)`,
          ingredients:
            ingredients.length > 0
              ? ingredients.join(",")
              : "N/A (Natural language query)",
          nutrition: chunkArray(
            filterStandardNutrients(convertToGrams(nutritionData)).filter(
              (n) => n.amount >= 0.1
            ),
            6
          ).map((groupOf6) => chunkArray(groupOf6, 2)),
        };

        res.status(200).json({
          message: "Food Data received successfully",
          data: result,
        });
        return;
      }
    }

    const result = await predictAllergensAndNutrition(
      foodName,
      (req.user as any).allergens
    );
    if (!result) {
      console.error("Failed to fetch ingredients and nutrition data");
      res.status(404).json({ message: "No food data found" });
      return;
    }

    // console.log("Gemini API response:", result);
    res.status(200).json({
      message: "Food Data received successfully",
      data: {
        foodName,
        servingSize: "150g",
        ingredients: result.allergens.join(","),
        nutrition: chunkArray(
          filterStandardNutrients(convertToGrams(result.nutrition)).filter(
            (n) => n.amount >= 0.1
          ),
          6
        ).map((groupOf6) => chunkArray(groupOf6, 2)),
      },
    });
    return;
  } catch (error) {
    console.error("Error fetching food data:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
}
