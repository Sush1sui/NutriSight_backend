export function getDateString(date: string) {
  // Extract date portion from ISO string (before 'T')
  // This preserves the date in the user's original timezone
  // e.g., "2025-11-09T02:00:00+08:00" -> "2025-11-09"
  const isoMatch = date.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1]; // Return the YYYY-MM-DD part directly
  }

  // Fallback: if not ISO format, try parsing (shouldn't happen in your app)
  return new Date(date).toISOString().slice(0, 10);
}
