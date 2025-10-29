import { Request, Response } from "express";
import {
  extractAllIngredientTexts,
  extractValuesWithUnitsFromOFF,
  getNutrientsFromNutritionix,
} from "../utils/foodCameraUtils";
import {
  geminiFallbackGroupedNutrition,
  scanAllergensAndOrganizeNutrition,
} from "../utils/ingredientsNutritionsPredict";
import FoodModel from "../models/Foods";
import { convertToGrams } from "../utils/convertToGrams";
import { classifyImage } from "../utils/model_inference";
import * as fs from "fs";

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

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
if (!HUGGINGFACE_API_KEY) {
  console.error("HUGGINGFACE_API_KEY is not set in the environment variables.");
  process.exit(1);
}

const classNames = JSON.parse(
  fs.readFileSync("src/cnn_model/class_names.json", "utf8")
);
const modelPath = "src/cnn_model/model.onnx";

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

    console.log("Fetching data from USDA API...");
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
      const organizedResult = await scanAllergensAndOrganizeNutrition(
        food.description,
        (req.user as any).allergens,
        food.foodNutrients,
        true,
        (food.ingredients as string)?.split(",") || []
      );
      if (organizedResult && organizedResult.groupedNutrition) {
        const convertedGroupedNutrition = organizedResult.groupedNutrition.map(
          (group) => ({
            title: group.title,
            items: group.items
              .filter((n) =>
                [
                  "g",
                  "mg",
                  "µg",
                  "kg",
                  "oz",
                  "lb",
                  "st",
                  "ml",
                  "iu",
                  "l",
                  "dl",
                  "cl",
                  "tbsp",
                  "tsp",
                  "cup",
                  "pint",
                  "quart",
                  "gal",
                  "kcal",
                  "cal",
                  "cals",
                ].includes(n.unit?.toLowerCase().trim())
              )
              .map((n) => {
                if (
                  n.name.toLowerCase().includes("energy") ||
                  n.name.toLowerCase().includes("calorie") ||
                  n.unit.toLowerCase() === "kcal" ||
                  n.unit.toLowerCase() === "cal" ||
                  n.unit.toLowerCase() === "cals"
                ) {
                  return {
                    ...n,
                    unit: "kcal",
                  };
                }

                return {
                  name: n.name,
                  value: convertToGrams(
                    n.value,
                    n.unit,
                    n.name.toLowerCase().replace(/_/g, " ").replace(/-/g, " "),
                    n.name
                  ).value,
                  unit: "g",
                };
              })
              .filter((n) => n.value > 0.01),
          })
        );

        res.status(200).json({
          message: "Barcode data received successfully",
          data: {
            name: food.description,
            brand: food.brandOwner,
            ingredients:
              (food.ingredients as string)?.split(",") ||
              organizedResult.ingredients,
            triggeredAllergens: organizedResult.triggeredAllergens,
            nutritionData: convertedGroupedNutrition.map((g) => ({
              title: g.title ?? "",
              items: g.items.filter((n) => !n.name.includes(":")),
            })),
            servingSize: `${food.servingSize}${food.servingSizeUnit}`,
            source: "usda",
          },
        });
        return;
      } else {
        console.log("No USDA data found, trying Nutritionix...");
      }
    }
    console.log("No USDA data found, trying Nutritionix...");

    //fallback to nutritionix
    console.log("Fetching data from Nutritionix API...");
    const nxResponse = await fetch(
      `https://trackapi.nutritionix.com/v2/search/item?upc=${barcodeData}`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-app-id": NUTRITIONIX_APP_ID,
          "x-app-key": NUTRITIONIX_API_KEY,
        },
      }
    );
    if (nxResponse.ok) {
      const data = (await nxResponse.json()) as any;
      const food = data?.foods ? data.foods[0] : null;

      if (food) {
        const organizedResult = await scanAllergensAndOrganizeNutrition(
          food.food_name,
          (req.user as any).allergens,
          getNutrientsFromNutritionix(food.full_nutrients),
          true,
          typeof food.nf_ingredient_statement === "string"
            ? (food.nf_ingredient_statement as string)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : Array.isArray(food.nf_ingredient_statement)
            ? food.nf_ingredient_statement
            : []
        );
        if (organizedResult && organizedResult.groupedNutrition) {
          const convertedGroupedNutrition =
            organizedResult.groupedNutrition.map((group) => ({
              title: group.title,
              items: group.items
                .filter((n) =>
                  [
                    "g",
                    "mg",
                    "µg",
                    "kg",
                    "oz",
                    "lb",
                    "st",
                    "ml",
                    "iu",
                    "l",
                    "dl",
                    "cl",
                    "tbsp",
                    "tsp",
                    "cup",
                    "pint",
                    "quart",
                    "gal",
                    "kcal",
                    "cal",
                    "cals",
                  ].includes(n.unit?.toLowerCase().trim())
                )
                .map((n) => {
                  if (
                    n.name.toLowerCase().includes("energy") ||
                    n.name.toLowerCase().includes("calorie") ||
                    n.unit.toLowerCase() === "kcal" ||
                    n.unit.toLowerCase() === "cal" ||
                    n.unit.toLowerCase() === "cals"
                  ) {
                    return {
                      ...n,
                      unit: "kcal",
                    };
                  }

                  return {
                    name: n.name,
                    value: convertToGrams(
                      n.value,
                      n.unit,
                      n.name
                        .toLowerCase()
                        .replace(/_/g, " ")
                        .replace(/-/g, " "),
                      n.name
                    ).value,
                    unit: "g",
                  };
                })
                .filter((n) => n.value > 0.01),
            }));
          res.status(200).json({
            message: "Barcode data received successfully",
            data: {
              name: food.food_name,
              brand: food.brand_name,
              ingredients: organizedResult.ingredients,
              triggeredAllergens: organizedResult.triggeredAllergens,
              nutritionData: convertedGroupedNutrition,
              servingSize: food.serving_weight_grams + "g",
              source: "nutritionix",
            },
          });
          return;
        } else {
          console.log("No Nutritionix data found, trying Open Food Facts...");
        }
      } else {
        console.log("No Nutritionix data found, trying Open Food Facts...");
      }
    }
    console.log(
      "Failed to fetch data from Nutritionix API, trying Open Food Facts..."
    );

    console.log("Fetching data from Open Food Facts API...");
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

    const ingredientNames = extractAllIngredientTexts(
      offData.product.ingredients || []
    );

    const formattedNutriments = offData.product.nutriments
      ? extractValuesWithUnitsFromOFF(offData.product.nutriments)
      : [];

    const organizedResult = await scanAllergensAndOrganizeNutrition(
      offData.product.product_name,
      (req.user as any).allergens,
      formattedNutriments,
      true,
      ingredientNames
    );

    if (!organizedResult) {
      console.log(
        "Failed to organize nutrition data from open food facts:",
        organizedResult
      );
      res.status(500).json({ error: "Failed to process nutrition data." });
      return;
    }

    const convertedGroupedNutrition = organizedResult.groupedNutrition.map(
      (group) => ({
        title: group.title,
        items: group.items
          .filter((n) =>
            [
              "g",
              "mg",
              "µg",
              "kg",
              "oz",
              "lb",
              "st",
              "ml",
              "iu",
              "l",
              "dl",
              "cl",
              "tbsp",
              "tsp",
              "cup",
              "pint",
              "quart",
              "gal",
              "kcal",
              "cal",
              "cals",
            ].includes(n.unit?.toLowerCase().trim())
          )
          .map((n) => {
            if (
              n.name.toLowerCase().includes("energy") ||
              n.name.toLowerCase().includes("calorie") ||
              n.unit.toLowerCase() === "kcal" ||
              n.unit.toLowerCase() === "cal" ||
              n.unit.toLowerCase() === "cals"
            ) {
              return {
                ...n,
                unit: "kcal",
              };
            }

            return {
              name: n.name,
              value: convertToGrams(
                n.value,
                n.unit,
                n.name.toLowerCase().replace(/_/g, " ").replace(/-/g, " "),
                n.name
              ).value,
              unit: "g",
            };
          })
          .filter((n) => n.value > 0.01),
      })
    );

    res.status(200).json({
      message: "Barcode data received successfully from Open Food Facts",
      data: {
        name: offData.product.product_name || "Unknown",
        brand: offData.product.brands || "Unknown",
        ingredients:
          ingredientNames.length > 0
            ? ingredientNames
            : organizedResult.ingredients,
        triggeredAllergens: organizedResult.triggeredAllergens,
        nutritionData: convertedGroupedNutrition,
        servingSize:
          offData.product.serving_size ||
          offData.product.serving_quantity +
            offData.product.serving_quantity_unit ||
          "N/A",
        source: "open food facts",
      },
    });
    return;
  } catch (error) {
    console.error("Error processing barcode:", error);
    res.status(500).json({ message: "Internal server error" });
  }
  return;
}

export async function predictFoodHandler(req: Request, res: Response) {
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

    const predictions = await classifyImage(
      imgBuffer,
      modelPath,
      classNames,
      5
    );

    // call external food/not-food microservice
    try {
      const MICRO_URL =
        "https://food-not-food-microservice.onrender.com/predict";
      const MS_API_KEY =
        process.env.FOOD_NOT_FOOD_API_KEY ||
        process.env.FOOD_MICROSERVICE_API_KEY;

      // Use global FormData/Blob to avoid adding dependencies; cast to any for TypeScript
      const FormDataClass: any = (globalThis as any).FormData;
      const BlobClass: any = (globalThis as any).Blob;

      if (FormDataClass && BlobClass && imgBuffer) {
        const form: any = new FormDataClass();
        const blob = new BlobClass([imgBuffer], { type: "image/jpeg" });
        form.append("image", blob, "image.jpg");

        const headers: any = {};
        if (MS_API_KEY) headers["x-api-key"] = MS_API_KEY;

        const msResp = await fetch(MICRO_URL, {
          method: "POST",
          body: form,
          headers,
        });

        if (msResp.ok) {
          const msJson = (await msResp.json()) as any;
          console.log("Food/not-food microservice response:", msJson);
          if (msJson?.result === "not_food") {
            // return predictions but include the required error field
            res.status(200).json({
              message: "Food scan data received successfully",
              data: predictions,
              error: "not food",
            });
            imgBuffer = null;
            return;
          }
        } else {
          console.warn(
            "Food/not-food microservice returned non-OK status:",
            msResp.status
          );
        }
      } else {
        console.warn(
          "Skipping microservice call: FormData/Blob not available or no image buffer"
        );
      }
    } catch (msErr) {
      console.error("Error calling food/not-food microservice:", msErr);
      // fall through to normal response
    }

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

    // attempt to find food on DB first
    console.log("Attempting to find food in database");
    const food = await FoodModel.findOne({
      name: (foodName as string).replace(/_/g, " ").toLowerCase(),
    });
    if (food) {
      const geminiRes = await scanAllergensAndOrganizeNutrition(
        foodName,
        (req.user as any).allergens,
        food.nutrition,
        false,
        food.common_ingredients || [],
        food.serving_size
      );

      if (geminiRes) {
        const convertedGroupedNutrition = geminiRes.groupedNutrition.map(
          (group) => ({
            title: group.title,
            items: group.items
              .filter((n) =>
                [
                  "g",
                  "mg",
                  "µg",
                  "kg",
                  "oz",
                  "lb",
                  "st",
                  "ml",
                  "iu",
                  "l",
                  "dl",
                  "cl",
                  "tbsp",
                  "tsp",
                  "cup",
                  "pint",
                  "quart",
                  "gal",
                  "kcal",
                  "cal",
                  "cals",
                ].includes(n.unit?.toLowerCase().trim())
              )
              .map((n) => {
                if (
                  n.name.toLowerCase().includes("energy") ||
                  n.name.toLowerCase().includes("calorie") ||
                  n.unit.toLowerCase() === "kcal" ||
                  n.unit.toLowerCase() === "cal" ||
                  n.unit.toLowerCase() === "cals"
                ) {
                  return {
                    ...n,
                    unit: "kcal",
                  };
                }

                return {
                  name: n.name,
                  value: convertToGrams(
                    n.value,
                    n.unit,
                    n.name.toLowerCase().replace(/_/g, " ").replace(/-/g, " "),
                    n.name
                  ).value,
                  unit: "g",
                };
              })
              .filter((n) => n.value > 0.01),
          })
        );

        console.log(convertedGroupedNutrition);

        res.status(200).json({
          message: "Food data retrieved successfully",
          data: {
            foodName: food.name,
            ingredients: food.common_ingredients,
            triggeredAllergens: geminiRes.triggeredAllergens,
            nutritionData: convertedGroupedNutrition,
            servingSize: food.serving_size,
            source: food.source || "database",
          },
        });
        return;
      }
    }

    // fetch from usda api
    console.log("Attempting to fetch data from USDA API");
    const usda_response = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
        foodName
      )}&dataType=Survey (FNDDS)&api_key=${USDA_API_KEY}`
    );

    if (usda_response.ok) {
      let data = (await usda_response.json()) as any;
      const food = data?.foods ? data.foods[0] : null;
      data = null;

      const results: {
        nutritionData?: {
          title: string;
          items: {
            name: string;
            value: number;
            unit: string;
          }[];
        }[];
        ingredients?: string[];
        triggeredAllergens?: Array<{ ingredient: string; allergen: string }>;
        foodName?: string;
        servingSize?: string;
        source?: string;
      } = {
        foodName,
        source: "usda",
      };

      // get the first food with survey dataType
      if (food) {
        const geminiRes = await scanAllergensAndOrganizeNutrition(
          foodName,
          (req.user as any).allergens,
          food.foodNutrients,
          false,
          (food.ingredients as string)?.split(",") || []
        );

        if (geminiRes) {
          const convertedGroupedNutrition = geminiRes.groupedNutrition.map(
            (group) => ({
              title: group.title,
              items: group.items
                .filter((n) =>
                  [
                    "g",
                    "mg",
                    "µg",
                    "kg",
                    "oz",
                    "lb",
                    "st",
                    "ml",
                    "iu",
                    "l",
                    "dl",
                    "cl",
                    "tbsp",
                    "tsp",
                    "cup",
                    "pint",
                    "quart",
                    "gal",
                    "kcal",
                    "cal",
                    "cals",
                  ].includes(n.unit?.toLowerCase().trim())
                )
                .map((n) => {
                  if (
                    n.name.toLowerCase().includes("energy") ||
                    n.name.toLowerCase().includes("calorie") ||
                    n.unit.toLowerCase() === "kcal" ||
                    n.unit.toLowerCase() === "cal" ||
                    n.unit.toLowerCase() === "cals"
                  ) {
                    return {
                      ...n,
                      unit: "kcal",
                    };
                  }

                  return {
                    name: n.name,
                    value: convertToGrams(
                      n.value,
                      n.unit,
                      n.name
                        .toLowerCase()
                        .replace(/_/g, " ")
                        .replace(/-/g, " "),
                      n.name
                    ).value,
                    unit: "g",
                  };
                })
                .filter((n) => n.value > 0.01),
            })
          );

          results.ingredients =
            (food.ingredients as string)?.split(",") || geminiRes.ingredients;
          results.triggeredAllergens = geminiRes.triggeredAllergens;
          results.nutritionData = convertedGroupedNutrition.map((g) => ({
            title: g.title ?? "",
            items: g.items.filter((n) => !n.name.includes(":")),
          }));
          results.servingSize = "150g";

          if (
            results.nutritionData &&
            results.ingredients &&
            results.servingSize
          ) {
            res.status(200).json({
              message: "Food Data received successfully",
              data: results,
            });
            return;
          }
        }
      }
    }

    // fallback to nutritionix api
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
        const geminiRes = await scanAllergensAndOrganizeNutrition(
          foodName,
          (req.user as any).allergens,
          food.full_nutrients,
          false,
          []
        );

        if (geminiRes) {
          const convertedGroupedNutrition = geminiRes.groupedNutrition.map(
            (group) => ({
              title: group.title,
              items: group.items
                .filter((n) =>
                  [
                    "g",
                    "mg",
                    "µg",
                    "kg",
                    "oz",
                    "lb",
                    "st",
                    "ml",
                    "iu",
                    "l",
                    "dl",
                    "cl",
                    "tbsp",
                    "tsp",
                    "cup",
                    "pint",
                    "quart",
                    "gal",
                    "kcal",
                    "cal",
                    "cals",
                  ].includes(n.unit?.toLowerCase().trim())
                )
                .map((n) => {
                  if (
                    n.name.toLowerCase().includes("energy") ||
                    n.name.toLowerCase().includes("calorie") ||
                    n.unit.toLowerCase() === "kcal" ||
                    n.unit.toLowerCase() === "cal" ||
                    n.unit.toLowerCase() === "cals"
                  ) {
                    return {
                      ...n,
                      unit: "kcal",
                    };
                  }

                  return {
                    name: n.name,
                    value: convertToGrams(
                      n.value,
                      n.unit,
                      n.name
                        .toLowerCase()
                        .replace(/_/g, " ")
                        .replace(/-/g, " "),
                      n.name
                    ).value,
                    unit: "g",
                  };
                })
                .filter((n) => n.value > 0.01),
            })
          );
          const result = {
            foodName: food.food_name,
            ingredients: geminiRes.ingredients,
            servingSize: "150g",
            triggeredAllergens: geminiRes.triggeredAllergens,
            nutritionData: convertedGroupedNutrition,
            source: "nutritionix",
          };

          res.status(200).json({
            message: "Food Data received successfully",
            data: result,
          });
          return;
        }
      }
    }

    // fallback to gemini api
    console.log("Falling back to Gemini API for food data");
    const geminiRes = await geminiFallbackGroupedNutrition(
      foodName,
      (req.user as any).allergens,
      "150g"
    );

    console.log("Gemini API response:", geminiRes);

    if (!geminiRes) {
      res.status(500).json({ message: "Failed to process food data" });
      return;
    }

    res.status(200).json({
      message: "Food Data received successfully",
      data: {
        foodName,
        servingSize: "150g",
        ingredients: geminiRes.ingredients,
        triggeredAllergens: geminiRes.triggeredAllergens,
        nutritionData: geminiRes.groupedNutrition.map((g) =>
          g.items
            .map((n) => {
              if (
                n.name.toLowerCase().includes("energy") ||
                n.name.toLowerCase().includes("calorie") ||
                n.unit.toLowerCase() === "kcal" ||
                n.unit.toLowerCase() === "cal" ||
                n.unit.toLowerCase() === "cals"
              ) {
                return {
                  ...n,
                  unit: "kcal",
                };
              }

              return {
                name: n.name,
                value: convertToGrams(
                  n.value,
                  n.unit,
                  n.name.toLowerCase().replace(/_/g, " ").replace(/-/g, " "),
                  n.name
                ).value,
                unit: "g",
              };
            })
            .filter((n) => n.value > 0.01)
        ),
        source: "gemini",
      },
    });
    return;
  } catch (error) {
    console.error("Error fetching food data:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
}
