const STANDARD_NUTRIENTS = {
  calories: "Calories",
  "total fat": "Total Fat",
  "saturated fat": "Saturated Fat",
  "trans fat": "Trans Fat",
  "monounsaturated fat": "Monounsaturated Fat",
  "polyunsaturated fat": "Polyunsaturated Fat",
  cholesterol: "Cholesterol",
  sodium: "Sodium",
  "total carbohydrates": "Total Carbohydrates",
  "net carbs": "Net Carbs",
  "dietary fiber": "Dietary Fiber",
  sugars: "Sugars",
  protein: "Protein",
  "vitamin a": "Vitamin A",
  calcium: "Calcium",
  iron: "Iron",
  potassium: "Potassium",
};

// Map all possible synonyms to the standard key
const synonymMap: Record<string, string> = {
  energy: "Calories",
  "energy-kcal": "Calories",
  "energy (kcal)": "Calories",
  calories: "Calories",
  fat: "Total Fat",
  "total fat": "Total Fat",
  "fatty acids, total saturated": "Saturated Fat",
  "saturated fat": "Saturated Fat",
  "fatty acids, total trans": "Trans Fat",
  "trans fat": "Trans Fat",
  "fatty acids, total monounsaturated": "Monounsaturated Fat",
  "monounsaturated fat": "Monounsaturated Fat",
  "fatty acids, total polyunsaturated": "Polyunsaturated Fat",
  "polyunsaturated fat": "Polyunsaturated Fat",
  cholesterol: "Cholesterol",
  sodium: "Sodium",
  salt: "Sodium",
  "total carbohydrate": "Total Carbohydrates",
  "total carbohydrates": "Total Carbohydrates",
  "carbohydrate, by difference": "Total Carbohydrates",
  carbohydrates: "Total Carbohydrates",
  "net carbs": "Net Carbs",
  "fiber, total dietary": "Dietary Fiber",
  "dietary fiber": "Dietary Fiber",
  fiber: "Dietary Fiber",
  sugars: "Sugars",
  sugar: "Sugars",
  protein: "Protein",
  proteins: "Protein",
  "vitamin a": "Vitamin A",
  "vitamin a, iu": "Vitamin A",
  calcium: "Calcium",
  "calcium, ca": "Calcium",
  iron: "Iron",
  "iron, fe": "Iron",
  potassium: "Potassium",
  "potassium, k": "Potassium",
  // Add more as needed
};

export function filterStandardNutrients(arr: any[]) {
  return arr
    .map((item: any) => {
      // Normalize the name
      let name = (item.name || "")
        .toLowerCase()
        .replace(/-/g, " ")
        .replace(/\,.*$/, "")
        .trim();
      // Map synonym to standard key
      const standardKey = synonymMap[name];
      if (
        standardKey &&
        STANDARD_NUTRIENTS[standardKey as keyof typeof STANDARD_NUTRIENTS]
      ) {
        return {
          ...item,
          name: standardKey,
        };
      }
      return null;
    })
    .filter((item) => item !== null);
}

export function renameNutrition(arr: any[]) {
  return arr.map((item: any) => {
    const lower = (item.name || "").toLowerCase();
    if (
      ["energy", "energy-kcal", "energy (kcal)", "calories"].includes(lower)
    ) {
      return { ...item, name: "calories" };
    }
    if (["protein"].includes(lower)) return { ...item, name: "protein" };
    if (["total fat", "fat"].includes(lower))
      return { ...item, name: "total fat" };
    if (["saturated fat", "fatty acids, total saturated"].includes(lower))
      return { ...item, name: "saturated fat" };
    if (["trans fat", "fatty acids, total trans"].includes(lower))
      return { ...item, name: "trans fat" };
    if (["cholesterol"].includes(lower))
      return { ...item, name: "cholesterol" };
    if (["sodium"].includes(lower)) return { ...item, name: "sodium" };
    if (
      [
        "total carbohydrate",
        "total carbohydrates",
        "carbohydrate, by difference",
      ].includes(lower)
    )
      return { ...item, name: "total carbohydrates" };
    if (["dietary fiber", "fiber, total dietary"].includes(lower))
      return { ...item, name: "dietary fiber" };
    if (["sugars", "sugar"].includes(lower)) return { ...item, name: "sugars" };
    if (["vitamin a", "vitamin a, iu"].includes(lower))
      return { ...item, name: "vitamin a" };
    if (["calcium", "calcium, ca"].includes(lower))
      return { ...item, name: "calcium" };
    if (["iron", "iron, fe"].includes(lower)) return { ...item, name: "iron" };
    if (["potassium", "potassium, k"].includes(lower))
      return { ...item, name: "potassium" };
    // ...add more mappings as needed
    return item;
  });
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function replaceUnderscoreToWhitespace(str: string): string {
  return str.replace(/_/g, " ");
}

export function formatNutriments(nutriments: any) {
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
