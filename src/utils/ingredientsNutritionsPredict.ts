import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in the environment variables.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function scanAllergensAndOrganizeNutrition(
  foodName: string,
  userAllergens: string[],
  nutrition: Array<{ name: string; value: number; unit: string }>,
  packagedFood?: boolean,
  ingredients?: string[],
  serving_size?: string
): Promise<{
  ingredients: string[];
  triggeredAllergens: Array<{ ingredient: string; allergen: string }>;
  groupedNutrition: Array<{
    title: string;
    items: Array<{ name: string; value: number; unit: string }>;
  }>;
} | null> {
  // Set serving size for non-packaged food
  const servingSize = serving_size || packagedFood ? undefined : "150g";

  const ingredientsPart =
    ingredients && ingredients.length > 0
      ? `The most common ingredients are: [${ingredients.join(", ")}].`
      : `List the most common ingredients for "${foodName}" (comma-separated).`;

  const servingSizePart = servingSize
    ? `Assume a serving size of ${servingSize}.`
    : "";

  const prompt = `
For the food "${foodName}":
${ingredientsPart}
${servingSizePart}
The user's allergens are: [${userAllergens.join(", ")}].
Here is the nutrition data (array of {name, value, unit}): ${JSON.stringify(
    nutrition
  )}
Tasks:
- If ingredients were not provided, predict them.
- Identify which of these ingredients match the user's allergens.
- Organize the nutrition data into three groups: Macronutrients, Micronutrients, and Other Nutrients.
- When matching allergens, only use single, simple ingredient names (not full phrases or grouped ingredients).
- Make sure that in triggered allergens, the ingredient name exists in ingredients array
Return your answer as valid JSON in this format:
{
  "ingredients": [array of strings],
  "triggeredAllergens": [
    { "ingredient": "ingredient name", "allergen": "allergen name" }
  ],
  "groupedNutrition": [
    { "title": "Macronutrients", "items": [...] },
    { "title": "Micronutrients", "items": [...] },
    { "title": "Other Nutrients", "items": [...] }
  ]
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
  });

  let result: {
    ingredients: string[];
    triggeredAllergens: Array<{ ingredient: string; allergen: string }>;
    groupedNutrition: Array<{
      title: string;
      items: Array<{ name: string; value: number; unit: string }>;
    }>;
  } = {
    ingredients: [],
    triggeredAllergens: [],
    groupedNutrition: [],
  };
  try {
    const match = response.text?.match(/\{[\s\S]*\}/);
    if (match) {
      result = JSON.parse(match[0]);
      result.groupedNutrition = result.groupedNutrition
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => item.value > 0.01),
        }))
        .filter((group) => group.items.length > 0);
    }
  } catch (e) {
    console.error("Failed to parse response:", e);
    return null;
  }

  return result;
}

export async function geminiFallbackGroupedNutrition(
  foodName: string,
  userAllergens: string[],
  servingSize: string = "150g"
): Promise<{
  ingredients: string[];
  triggeredAllergens: Array<{ ingredient: string; allergen: string }>;
  groupedNutrition: Array<{
    title: string;
    items: Array<{ name: string; value: number; unit: string }>;
  }>;
} | null> {
  const prompt = `
For the food "${foodName}", do the following:
1. List the most common ingredients (comma-separated).
2. Identify which of these ingredients match the user's allergens: [${userAllergens.join(
    ", "
  )}].
3. Estimate the nutrition facts for a serving size of ${servingSize}, including calories, protein, fat, carbohydrates, fiber, and other relevant macros and micros.
4. Organize the nutrition data into three groups: Macronutrients, Micronutrients, and Other Nutrients.
5. When matching allergens, only use single, simple ingredient names (not full phrases or grouped ingredients).
6. Make sure that in triggered allergens, the ingredient name exists in ingredients array

IMPORTANT: Return only JSON and follow the exact schema below. All numeric fields must be numeric (no units embedded in the value field). Example:
{
  "ingredients": ["squash","garlic","onion"],
  "triggeredAllergens": [{ "ingredient":"shrimp paste", "allergen":"fish" }],
  "groupedNutrition": [
    {
      "title":"Macronutrients",
      "items":[
        {"name":"calories","value":230,"unit":"kcal"},
        {"name":"protein","value":8,"unit":"g"},
        {"name":"fat","value":12,"unit":"g"},
        {"name":"carbohydrates","value":20,"unit":"g"}
      ]
    },
    {"title":"Micronutrients","items":[{"name":"vitamin A","value":120,"unit":"mcg"}]},
    {"title":"Other Nutrients","items":[{"name":"fiber","value":3.5,"unit":"g"}]}
  ]
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
  });

  // DEBUG: log raw model output for diagnostics
  console.log("Gemini raw response text (fallback):", response.text);

  let result: {
    ingredients: string[];
    triggeredAllergens: Array<{ ingredient: string; allergen: string }>;
    groupedNutrition: Array<{
      title: string;
      items: Array<{ name: string; value: number; unit: string }>;
    }>;
  } = {
    ingredients: [],
    triggeredAllergens: [],
    groupedNutrition: [],
  };
  try {
    const match = response.text?.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);

      // Raw grouped data may appear in different shapes. Try to detect and normalize.
      // 1) { groupedNutrition: [ { title, items: [...] }, ... ], ingredients, triggeredAllergens }
      // 2) [ [items...], [items...], [items...] ]  (array-of-arrays)
      // 3) [ {name, value, unit}, ... ] (single array of items)
      const rawGrouped: any =
        parsed && parsed.groupedNutrition ? parsed.groupedNutrition : parsed;

      console.log("Gemini fallback raw groupedNutrition:", rawGrouped);

      const normalizeItem = (
        it: any
      ): { name: string; value: number; unit: string } | null => {
        if (!it || typeof it !== "object") return null;
        const name = (it.name ?? it.n ?? "unknown") as string;
        let value: any = it.value ?? it.v ?? it.amount ?? null;
        const unit = (it.unit ?? it.u ?? "") as string;
        if (typeof value === "string") {
          const num = parseFloat(value.replace(/[^0-9\.\-]/g, ""));
          value = isNaN(num) ? null : num;
        }
        value = value == null ? null : Number(value);
        if (value == null || Number.isNaN(value)) return null;
        return { name, value, unit };
      };

      const titles = ["Macronutrients", "Micronutrients", "Other Nutrients"];

      if (
        Array.isArray(rawGrouped) &&
        rawGrouped.length > 0 &&
        Array.isArray(rawGrouped[0])
      ) {
        // array-of-arrays -> map to titled groups
        result.groupedNutrition = (rawGrouped as any[])
          .map((items: any[], idx: number) => ({
            title: titles[idx] ?? `Group ${idx + 1}`,
            items: (items || [])
              .map(normalizeItem)
              .filter(
                (i: any): i is { name: string; value: number; unit: string } =>
                  i !== null
              ) as {
              name: string;
              value: number;
              unit: string;
            }[],
          }))
          .filter((g) => g.items.length > 0);
      } else if (
        Array.isArray(rawGrouped) &&
        rawGrouped.length > 0 &&
        rawGrouped[0] &&
        typeof rawGrouped[0] === "object" &&
        "title" in rawGrouped[0]
      ) {
        // already grouped objects
        result.groupedNutrition = (rawGrouped as any[])
          .map((g) => ({
            title: g.title,
            items: (g.items || [])
              .map(normalizeItem)
              .filter(
                (i: any): i is { name: string; value: number; unit: string } =>
                  i !== null
              ) as {
              name: string;
              value: number;
              unit: string;
            }[],
          }))
          .filter((g) => g.items.length > 0);
      } else if (
        Array.isArray(rawGrouped) &&
        rawGrouped.length > 0 &&
        rawGrouped[0] &&
        rawGrouped[0].name
      ) {
        // single array of nutrient items -> wrap as macronutrients
        result.groupedNutrition = [
          {
            title: "Macronutrients",
            items: (rawGrouped as any[])
              .map(normalizeItem)
              .filter(
                (i: any): i is { name: string; value: number; unit: string } =>
                  i !== null
              ) as {
              name: string;
              value: number;
              unit: string;
            }[],
          },
        ];
      } else {
        console.log(
          "Unrecognized groupedNutrition format from Gemini:",
          rawGrouped
        );
        result.groupedNutrition = [];
      }

      // Extract ingredients/triggeredAllergens if present
      if (parsed && Array.isArray(parsed.ingredients))
        result.ingredients = parsed.ingredients;
      if (parsed && Array.isArray(parsed.triggeredAllergens))
        result.triggeredAllergens = parsed.triggeredAllergens;

      console.log(
        "Normalized Gemini groupedNutrition:",
        result.groupedNutrition
      );
    } else {
      console.log(
        "No JSON block found in Gemini fallback response:",
        response.text
      );
      result.groupedNutrition = [];
    }
  } catch (e) {
    console.error("Failed to parse fallback response:", e, response.text);
    return result;
  }

  return result;
}
