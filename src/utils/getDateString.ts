export function getDateString(date: string) {
  return new Date(date).toISOString().slice(0, 10); // "YYYY-MM-DD"
}
