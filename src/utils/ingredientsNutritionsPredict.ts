import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in the environment variables.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function predictIngredients(foodName: string): Promise<string[]> {
  const prompt = `List the most common ingredients in ${foodName}. Only list the ingredients, separated by commas.`;
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
  });

  const text = response.text ?? "";
  return text.split(",").map((i: string) => i.trim());
}

export async function scanAllergensAndOrganizeNutrition(
  foodName: string,
  userAllergens: string[],
  nutrition: Array<{ name: string; value: number; unit: string }>
): Promise<{
  ingredients: string[];
  triggeredAllergens: string[];
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
3. Organize the following nutrition data (array of {name, value, unit}): ${JSON.stringify(
    nutrition
  )}
   into three groups: Macronutrients, Micronutrients, and Other Nutrients.
Return your answer as valid JSON in this format:
{
  "ingredients": [array of strings],
  "triggeredAllergens": [array of strings],
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

  let result = {
    ingredients: [],
    triggeredAllergens: [],
    groupedNutrition: [],
  };
  try {
    // Try to extract the JSON from the response
    const match = response.text?.match(/\{[\s\S]*\}/);
    if (match) {
      result = JSON.parse(match[0]);
    }
  } catch (e) {
    // fallback: return empty arrays if parsing fails
    console.error("Failed to parse response:", e);
    return null;
  }

  return result;
}

export async function scanAllergens(
  foodName: string,
  userAllergens: string[]
): Promise<{
  ingredients: string[];
  triggeredAllergens: string[];
}> {
  const prompt = `List the most common ingredients in ${foodName}. Only list the ingredients, separated by commas.`;
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
  });

  const text = response.text ?? "";
  const ingredients = text
    .split(",")
    .map((i: string) => i.trim().toLowerCase())
    .filter(Boolean);

  // Check which allergens are present in the ingredients
  const triggeredAllergens = userAllergens
    .map((a) => a.trim().toLowerCase())
    .filter((a) => ingredients.includes(a));

  return {
    ingredients,
    triggeredAllergens,
  };
}

export async function predictAllergensAndNutrition(
  foodName: string,
  userAllergens: string[],
  servingSize: string = "150g"
): Promise<{
  triggeredAllergens: string[];
  ingredients: string[];
  nutrition: Array<{ name: string; amount: number; unit: string }>;
}> {
  const prompt = `
For the food "${foodName}", list:
1. The most common ingredients (comma-separated).
2. The estimated nutrition facts for a serving size of ${servingSize} or your own estimated 1 serving, including calories, protein, fat, carbohydrates, and fiber, and other macros and micros.
Format your response as:
Ingredients: ingredient1, ingredient2, ingredient3, ...
Nutrition:
Calories: X kcal
Protein: X g
Fat: X g
Carbohydrates: X g
Fiber: X g
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
    // Optionally, you can add config here
    // config: { thinkingConfig: { thinkingBudget: 0 } }
  });

  const text = response.text ?? "";

  // Parse ingredients
  const ingredientsMatch = text.match(/Ingredients:\s*(.+)/i);
  const ingredients = ingredientsMatch
    ? ingredientsMatch[1].split(",").map((i: string) => i.trim().toLowerCase())
    : [];

  // Find triggered allergens
  const triggeredAllergens = userAllergens
    .map((a) => a.trim().toLowerCase())
    .filter((a) => ingredients.includes(a));

  // Parse nutrition as array of objects
  const nutrition: Array<{ name: string; amount: number; unit: string }> = [];
  const nutritionMatch = text.match(/Nutrition:\s*([\s\S]*)/i);
  if (nutritionMatch) {
    const lines = nutritionMatch[1].split("\n");
    lines.forEach((line: string) => {
      const [key, value] = line.split(":").map((s) => s.trim());
      if (key && value) {
        const match = value.match(/([\d.]+)\s*(\w+)/);
        if (match) {
          nutrition.push({
            name: key.toLowerCase(),
            amount: parseFloat(match[1]),
            unit: match[2],
          });
        }
      }
    });
  }

  return { triggeredAllergens, nutrition, ingredients };
}
