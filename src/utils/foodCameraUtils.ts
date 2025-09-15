import { NUTRITIONIX_NUTRIENT_MAP } from "./nutritionixMap";

export const STANDARD_NUTRIENTS_SET = new Set([
  "calories",
  "energy",
  "total fat",
  "saturated fat",
  "trans fat",
  "monounsaturated fat",
  "polyunsaturated fat",
  "total carbs",
  "net carbs",
  "dietary fiber",
  "fiber",
  "protein",
  "cholesterol",
  "sodium",
  "vitamin a",
  "calcium",
  "iron",
  "potassium",
  "carbohydrates",
]);

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
        value: nutriments[key],
        // The unit is usually in a corresponding key like 'proteins_unit'
        unit: nutriments[`${key}_unit`] || "g", // Default to 'g' if no unit
      });
    }
  });
  return nutrientList;
}

export function cleanIngredients(ingredients: string[]): string[] {
  const seen = new Set<string>();
  return ingredients
    .map((i) =>
      i
        .replace(/\s*\(.*?\)/g, "") // Remove anything in parentheses
        .replace(/[^a-zA-Z0-9&\-\s]/g, "") // Remove most special chars except & and -
        .trim()
        .toLowerCase()
    )
    .filter((i) => i && i.length <= 40 && !seen.has(i) && seen.add(i)); // Remove duplicates and overly long names
}

export function extractAllIngredientTexts(ingredients: any[]): string[] {
  const result: string[] = [];
  for (const i of ingredients) {
    if (i.text && (i.id as string).toLowerCase().startsWith("en")) {
      result.push(i.text.toLowerCase());
    }
  }
  return result;
}

export function getNutrientsFromNutritionix(item: any) {
  const out: { name: string; value: number; unit: string }[] = [];

  if (Array.isArray(item.full_nutrients)) {
    for (const fn of item.full_nutrients) {
      const map =
        NUTRITIONIX_NUTRIENT_MAP[
          fn.attr_id as keyof typeof NUTRITIONIX_NUTRIENT_MAP
        ];
      if (map) {
        // skip if already present (nf_* took precedence)
        if (!out.some((x) => x.name === map.name)) {
          out.push({ name: map.name, value: Number(fn.value), unit: map.unit });
        }
      }
    }
  }

  // add serving info (optional)
  if (item.serving_weight_grams != null) {
    out.push({
      name: "serving weight",
      value: Number(item.serving_weight_grams),
      unit: "g",
    });
  }

  console.log("Nutritionix nutrients:", out);
  return out;
}

export function extractValuesWithUnitsFromOFF(nutrients: Record<string, any>) {
  // build raw list from *_value keys
  let out: { name: string; value: number; unit: string }[] = [];

  const formatName = (k: string) =>
    capitalizeFirstLetter(k.replace(/[-_]/g, " ").trim());

  for (const key of Object.keys(nutrients)) {
    if (!key.toLowerCase().includes("value")) continue;
    const raw = nutrients[key];
    const num = Number(raw);
    if (!Number.isFinite(num)) continue;

    const base = key.replace(/_?value$/i, "");
    const unitKey = `${base}_unit`;

    let unit = "g";
    if (unitKey in nutrients && nutrients[unitKey] != null) {
      unit = String(nutrients[unitKey]);
    } else if (base.startsWith("energy")) {
      unit = "kcal";
    }

    out.push({ name: formatName(base), value: num, unit });
  }

  // Consolidate energy-related entries into a single canonical "Energy kcal" field
  const energyIdxs = out
    .map((v, i) => ({ i, name: v.name }))
    .filter((v) => /^energy/i.test(v.name))
    .map((v) => v.i);

  if (energyIdxs.length > 0) {
    const energyItems = energyIdxs.map((idx) => out[idx]);

    // priority: serving-specific -> explicit energy kcal/energy -> computed -> highest value
    const serving = energyItems.find((e) => /serving/i.test(e.name));
    const explicit =
      energyItems.find((e) => /^energy\s*kcal$/i.test(e.name)) ||
      energyItems.find((e) => /^energy$/i.test(e.name));
    const computed = energyItems.find((e) => /computed/i.test(e.name));
    const chosen =
      serving ||
      explicit ||
      computed ||
      energyItems.sort((a, b) => b.value - a.value)[0];

    // remove all existing energy entries
    out = out.filter((x) => !/^energy/i.test(x.name));

    // push a single normalized energy entry
    out.push({
      name: "Energy kcal",
      value: Number(chosen.value || 0),
      unit: chosen.unit || "kcal",
    });
  }

  // Deduplicate by nutrient name (case-insensitive): keep the entry with the largest numeric value
  const dedup = new Map<
    string,
    { name: string; value: number; unit: string }
  >();
  for (const item of out) {
    const key = (item.name || "").toLowerCase().trim();
    if (!dedup.has(key)) {
      dedup.set(key, item);
    } else {
      const existing = dedup.get(key)!;
      if (Number(item.value || 0) > Number(existing.value || 0)) {
        dedup.set(key, item);
      }
    }
  }

  return Array.from(dedup.values());
}
