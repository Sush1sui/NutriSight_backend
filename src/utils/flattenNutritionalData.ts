export function flattenNutritionalData(
  arr: Record<string, number>[]
): Record<string, number> {
  return Object.assign({}, ...arr);
}
