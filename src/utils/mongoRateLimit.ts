import Rate from "../models/Rate";

/**
 * Get the current value for a key. If the record exists but is older than windowSeconds, returns 0.
 */
export async function getKeyValue(
  key: string,
  windowSeconds: number
): Promise<number> {
  const doc = await Rate.findOne({ key }).exec();
  if (!doc) return 0;

  // If expireAt is set and already passed, treat as expired
  if (doc.expireAt && doc.expireAt.getTime() <= Date.now()) return 0;

  // If no expireAt, fall back to createdAt/window logic
  if (!doc.expireAt) {
    const ageMs = Date.now() - doc.createdAt.getTime();
    if (ageMs > windowSeconds * 1000) return 0;
  }

  return doc.count;
}

/**
 * Increment the counter for a key respecting the sliding window.
 * If the existing document is older than windowSeconds, reset to 1.
 * Returns the new count.
 */
export async function incrementKey(
  key: string,
  windowSeconds: number
): Promise<number> {
  const now = new Date();
  const expireAt = new Date(now.getTime() + windowSeconds * 1000);

  // Try to increment when the document exists and is not expired (has no expireAt or expireAt > now)
  const incResult = await Rate.findOneAndUpdate(
    {
      key,
      $or: [{ expireAt: { $exists: false } }, { expireAt: { $gt: now } }],
    },
    { $inc: { count: 1 } },
    { new: true }
  ).exec();

  if (incResult) return incResult.count;

  // Otherwise insert or reset the document with count=1 and set expireAt
  const upsertResult = await Rate.findOneAndUpdate(
    { key },
    { $set: { count: 1, createdAt: now, expireAt } },
    { upsert: true, new: true }
  ).exec();

  return upsertResult ? upsertResult.count : 1;
}

export default { getKeyValue, incrementKey };
