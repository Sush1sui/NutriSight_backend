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
      result = JSON.parse(match[0]);
      console.log("Gemini fallback groupedNutrition:", result.groupedNutrition);

      // While debugging, keep small positive nutrition values (filter out non-positive only)
      result.groupedNutrition = result.groupedNutrition
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => item.value > 0.001),
        }))
        .filter((group) => group.items.length > 0);
    } else {
      console.log(
        "No JSON block found in Gemini fallback response:",
        response.text
      );
    }
  } catch (e) {
    console.error("Failed to parse fallback response:", e, response.text);
    return result;
  }

  return result;
}
