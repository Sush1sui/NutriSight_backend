export function convertToGrams(
  nutrition: Array<{ name: string; amount: number; unit: string }>
) {
  return nutrition.map((n) => {
    let amount = n.amount;
    let unit = n.unit.toLowerCase();
    if (unit === "mg") {
      amount = amount / 1000;
      unit = "g";
    } else if (unit === "µg" || unit === "mcg") {
      amount = amount / 1_000_000;
      unit = "g";
    } else if (unit === "kcal" || unit === "cal") {
      // Optionally, keep as kcal or skip, or set to 0g
      // amount = 0;
      // unit = "g";
      // Or just leave as is
      return { ...n };
    } else if (unit !== "g") {
      // For any other units, you can handle or skip as needed
      return { ...n };
    }
    return { ...n, amount, unit };
  });
}
