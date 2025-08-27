const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in the environment variables.");
  process.exit(1);
}

export async function predictIngredients(foodName: string): Promise<string[]> {
  const prompt = `List the most common ingredients in ${foodName}. Only list the ingredients, separated by commas.`;
  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!response.ok) {
    console.error("Error from Gemini API:", await response.text());
    throw new Error("Failed to fetch ingredients from Gemini API");
  }
  const data: any = await response.json();
  if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
    console.error("Unexpected Gemini API response:", data);
    throw new Error("Invalid response from Gemini API");
  }
  const text = data.candidates[0].content.parts[0].text;
  return text.split(",").map((i: string) => i.trim());
}

export async function predictIngredientsAndNutrition(
  foodName: string,
  servingSize: string = "250g"
): Promise<{ ingredients: string[]; nutrition: Record<string, string> }> {
  const prompt = `
For the food "${foodName}", list:
1. The most common ingredients (comma-separated).
2. The estimated nutrition facts for a fixed serving size of ${servingSize}, including calories, protein, fat, carbohydrates, and fiber. 
Format your response as:
Ingredients: ingredient1, ingredient2, ingredient3, ...
Nutrition:
Calories: X kcal
Protein: X g
Fat: X g
Carbohydrates: X g
Fiber: X g
`;

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    console.error("Error from Gemini API:", await response.text());
    throw new Error("Failed to fetch data from Gemini API");
  }

  const data: any = await response.json();
  if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
    console.error("Unexpected Gemini API response:", data);
    throw new Error("Invalid response from Gemini API");
  }

  const text = data.candidates[0].content.parts[0].text;

  // Parse ingredients
  const ingredientsMatch = text.match(/Ingredients:\s*(.+)/i);
  const ingredients = ingredientsMatch
    ? ingredientsMatch[1].split(",").map((i: string) => i.trim())
    : [];

  // Parse nutrition
  const nutrition: Record<string, string> = {};
  const nutritionMatch = text.match(/Nutrition:\s*([\s\S]*)/i);
  if (nutritionMatch) {
    const lines = nutritionMatch[1].split("\n");
    lines.forEach((line: any) => {
      const [key, value] = line.split(":").map((s: any) => s.trim());
      if (key && value) nutrition[key] = value;
    });
  }

  return { ingredients, nutrition };
}
