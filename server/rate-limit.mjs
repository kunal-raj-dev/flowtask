import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';

/** Atomic across serverless instances. Buckets expire automatically through Firestore TTL. */
export function firestoreRateLimit(database, category, maximum, seconds) {
  return async function limit(key) {
    const now = Date.now();
    const window = Math.floor(now / (seconds * 1000));
    const id = createHash('sha256').update(`${category}:${window}:${key}`).digest('hex');
    const ref = database.doc(`serviceRateLimits/${id}`);
    return database.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const count = snapshot.exists ? Number(snapshot.data().count) || 0 : 0;
      if (count >= maximum) return false;
      transaction.set(ref, { count: count + 1, expiresAt: Timestamp.fromMillis((window + 2) * seconds * 1000) });
      return true;
    });
  };
}
