const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-latest:generateContent";
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
  const text = (response as any).data.candidates[0].content.parts[0].text;
  return text.split(",").map((i: string) => i.trim());
}
