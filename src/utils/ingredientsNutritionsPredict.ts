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

export async function scanAllergens(
  foodName: string,
  userAllergens: string[]
): Promise<string[]> {
  const prompt = `List the most common ingredients in ${foodName}. Only list the ingredients, separated by commas.`;
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
  });

  const text = response.text ?? "";
  const ingredients = text
    .split(",")
    .map((i: string) => i.trim().toLowerCase());

  // Check which allergens are present in the ingredients
  const triggeredAllergens = userAllergens
    .map((a) => a.trim().toLowerCase())
    .filter((a) => ingredients.includes(a));

  return triggeredAllergens;
}

export async function predictAllergensAndNutrition(
  foodName: string,
  userAllergens: string[],
  servingSize: string = "150g"
): Promise<{
  allergens: string[];
  nutrition: Array<{ name: string; amount: number; unit: string }>;
}> {
  const prompt = `
For the food "${foodName}", list:
1. The most common ingredients (comma-separated).
2. The estimated nutrition facts for a serving size of ${servingSize} or your own estimated 1 serving, including calories, protein, fat, carbohydrates, and fiber.
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
  const allergens = userAllergens
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

  return { allergens, nutrition };
}
