/**
 * Converts a nutrient value and unit to grams.
 * Supported units: g, mg, µg, kg, oz, lb, st, ml, iu, l, dl, cl, tbsp, tsp, cup, pint, quart, gal
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
    case "l":
      // Use density if provided, otherwise return as l
      if (name && getDensity(name)) {
        let density = undefined;
        for (const [key, dens] of Object.entries(densityMap)) {
          if (name.toLowerCase().includes(key)) {
            density = dens;
            break;
          }
        }
        if (density) {
          return { value: value * 1000 * density, unit: "g" };
        }
      }
      return { value, unit: "l" };
    case "dl":
      if (name && getDensity(name)) {
        let density = undefined;
        for (const [key, dens] of Object.entries(densityMap)) {
          if (name.toLowerCase().includes(key)) {
            density = dens;
            break;
          }
        }
        if (density) {
          return { value: value * 100 * density, unit: "g" };
        }
      }
      return { value, unit: "dl" };

    case "cl":
      if (name && getDensity(name)) {
        let density = undefined;
        for (const [key, dens] of Object.entries(densityMap)) {
          if (name.toLowerCase().includes(key)) {
            density = dens;
            break;
          }
        }
        if (density) {
          return { value: value * 10 * density, unit: "g" };
        }
      }
      return { value, unit: "cl" };

    case "tbsp":
      if (name && getDensity(name)) {
        let density = undefined;
        for (const [key, dens] of Object.entries(densityMap)) {
          if (name.toLowerCase().includes(key)) {
            density = dens;
            break;
          }
        }
        if (density) {
          return { value: value * 15 * density, unit: "g" };
        }
      }
      return { value, unit: "tbsp" };

    case "tsp":
      if (name && getDensity(name)) {
        let density = undefined;
        for (const [key, dens] of Object.entries(densityMap)) {
          if (name.toLowerCase().includes(key)) {
            density = dens;
            break;
          }
        }
        if (density) {
          return { value: value * 5 * density, unit: "g" };
        }
      }
      return { value, unit: "tsp" };

    case "cup":
      if (name && getDensity(name)) {
        let density = undefined;
        for (const [key, dens] of Object.entries(densityMap)) {
          if (name.toLowerCase().includes(key)) {
            density = dens;
            break;
          }
        }
        if (density) {
          return { value: value * 240 * density, unit: "g" }; // US cup
        }
      }
      return { value, unit: "cup" };

    case "pint":
      if (name && getDensity(name)) {
        let density = undefined;
        for (const [key, dens] of Object.entries(densityMap)) {
          if (name.toLowerCase().includes(key)) {
            density = dens;
            break;
          }
        }
        if (density) {
          return { value: value * 473 * density, unit: "g" }; // US pint
        }
      }
      return { value, unit: "pint" };

    case "quart":
      if (name && getDensity(name)) {
        let density = undefined;
        for (const [key, dens] of Object.entries(densityMap)) {
          if (name.toLowerCase().includes(key)) {
            density = dens;
            break;
          }
        }
        if (density) {
          return { value: value * 946 * density, unit: "g" }; // US quart
        }
      }
      return { value, unit: "quart" };

    case "gal":
      if (name && getDensity(name)) {
        let density = undefined;
        for (const [key, dens] of Object.entries(densityMap)) {
          if (name.toLowerCase().includes(key)) {
            density = dens;
            break;
          }
        }
        if (density) {
          return { value: value * 3785 * density, unit: "g" }; // US gallon
        }
      }
      return { value, unit: "gal" };
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
  olive: 0.92,
  "olive oil": 0.92,
  "vegetable oil": 0.92,
  "coconut oil": 0.92,
  "corn oil": 0.92,
  "canola oil": 0.92,
  "sunflower oil": 0.92,
  "soybean oil": 0.92,
  "peanut oil": 0.92,
  "sesame oil": 0.92,
  "grape juice": 1.05,
  "orange juice": 1.04,
  "apple juice": 1.05,
  "lemon juice": 1.03,
  vinegar: 1.01,
  cream: 0.97,
  yogurt: 1.03,
  "maple syrup": 1.32,
  molasses: 1.4,
  mayonnaise: 0.94,
  ketchup: 1.2,
  "soy sauce": 1.2,
  wine: 0.99,
  beer: 1.01,
  whiskey: 0.94,
  brandy: 0.95,
  rum: 0.95,
  "ice cream": 0.56,
  butter: 0.911,
  margarine: 0.9,
  egg: 1.03,
  "egg white": 1.04,
  "egg yolk": 1.03,
  "chocolate syrup": 1.4,
  "condensed milk": 1.13,
  "evaporated milk": 1.08,
  custard: 1.07,
  jam: 1.35,
  jelly: 1.35,
  mustard: 1.01,
  "salad dressing": 0.93,
  salsa: 1.03,
  "tomato paste": 1.3,
  "tomato sauce": 1.06,
  "pureed fruit": 1.05,
  "fruit juice": 1.04,
  "sports drink": 1.03,
  "energy drink": 1.11,
  cola: 1.04,
  "soft drink": 1.04,
  tea: 1.0,
  coffee: 1.0,
};

export function getDensity(substance: string): number | undefined {
  return densityMap[substance.toLowerCase()];
}
