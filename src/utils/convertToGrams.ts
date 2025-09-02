/**
 * Converts a nutrient value and unit to grams.
 * Supported units: g, mg, µg, kg, oz, lb, st, ml, iu
 * For ml, provide density (g/ml) for conversion.
 */
export function convertToGrams(
  value: number,
  unit: string,
  nutrientType?: string,
  name?: string
): { value: number; unit: string } {
  if (!unit) return { value, unit: "g" };
  const normalizedUnit = unit.trim().toLowerCase();
  switch (normalizedUnit) {
    case "g":
      return { value, unit: "g" };
    case "mg":
      return { value: value / 1000, unit: "g" };
    case "µg":
    case "mcg":
      return { value: value / 1000000, unit: "g" };
    case "kg":
      return { value: value * 1000, unit: "g" };
    case "iu":
      if (nutrientType) {
        switch (nutrientType.toLowerCase()) {
          case "vitamin a":
            return { value: value * 0.0000003, unit: "g" };
          case "vitamin d":
            return { value: value * 0.000000025, unit: "g" };
          case "vitamin e":
            return { value: value * 0.00067, unit: "g" };
          default:
            return { value, unit: "iu" };
        }
      }
      return { value, unit: "iu" };
    case "oz":
      return { value: value * 28.3495, unit: "g" };
    case "lb":
      return { value: value * 453.592, unit: "g" };
    case "st":
      return { value: value * 6350.29, unit: "g" };
    case "ml":
      // Use density if provided, otherwise return as ml
      if (name && getDensity(name)) {
        let density = undefined;
        for (const [key, dens] of Object.entries(densityMap)) {
          if (name.toLowerCase().includes(key)) {
            density = dens;
            break;
          }
        }
        if (density) {
          return { value: value * density, unit: "g" };
        }
      }
      return { value, unit: "ml" };
    default:
      return { value, unit }; // Unrecognized unit, return as is
  }
}

const densityMap: { [key: string]: number } = {
  water: 1.0,
  milk: 1.03,
  oil: 0.92,
  honey: 1.42,
  syrup: 1.33,
  alcohol: 0.79,
};

export function getDensity(substance: string): number | undefined {
  return densityMap[substance.toLowerCase()];
}
