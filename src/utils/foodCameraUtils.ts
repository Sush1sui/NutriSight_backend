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

export function filterStandardNutrients(arr: any[]) {
  return arr.filter((item: any) => {
    const name = (item.name || "")
      .toLowerCase()
      .replace(/-/g, " ")
      .replace(/\,.*$/, "")
      .trim();
    return (STANDARD_NUTRIENTS as Record<string, string>)[name] !== undefined;
  });
}

export function renameNutrition(arr: any[]) {
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
