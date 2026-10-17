import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export function createDeleteAccountHandler({ auth, database, origin, now = () => Date.now() }) {
  return async function deleteAccount(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    const reply = (status, error) => response.status(status).json({ error });
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return reply(405, 'Use POST.'); }
    if (!origin) return reply(503, 'Account deletion is not configured for this installation.');
    if (request.headers.origin !== origin) return reply(403, 'This request must come from FlowTask.');
    if (request.body?.confirmation !== 'DELETE') return reply(400, 'Type DELETE to confirm.');
    const bearer = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
    if (!bearer) return reply(401, 'Sign in again to delete your account.');
    let token;
    try { token = await auth.verifyIdToken(bearer); } catch { return reply(401, 'Sign in again to delete your account.'); }
    if (!Number.isFinite(token.auth_time) || now() / 1000 - token.auth_time > 300 || token.auth_time > now() / 1000 + 30) return reply(401, 'Re-authenticate within five minutes before deleting your account.');
    const root = database.doc(`users/${token.uid}`);
    try {
      // This write barrier remains through partial failures and blocks old ID tokens.
      // Keep authentication available during a partial data-deletion failure so the owner can retry.
      // The Firestore barrier rejects all client writes while cleanup runs.
      const expiresAt = Timestamp.fromMillis((Math.max(now() / 1000 + 3600, Number(token.exp) || 0) + 600) * 1000);
      await root.set({ deletionPending: true });
      for (const subcollection of await root.listCollections()) await database.recursiveDelete(subcollection);
      // No task, note, email or media remains. Enable TTL on expiresAt at deployment.
      await root.set({ deletionPending: true, expiresAt });
      try { await auth.deleteUser(token.uid); } catch (e) {
        if (e.code !== 'auth/user-not-found') {
          // A partial failure stays locked until a successful retry, without an expiring barrier.
          await root.set({ deletionPending: true });
          throw e;
        }
      }
      return response.status(200).json({ deleted: true });
    } catch {
      return reply(503, 'Deletion is incomplete. Your account is locked against new writes; retry shortly or contact the site operator.');
    }
  };
}
export default async function handler(request, response) {
  const { FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY, APP_ORIGIN } = process.env;
  if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) return response.status(503).json({ error: 'Account deletion is not configured for this installation.' });
  try {
    const app = getApps().find(a => a.name === 'flowtask-admin') || initializeApp({ credential: cert({ projectId: FIREBASE_ADMIN_PROJECT_ID, clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n') }) }, 'flowtask-admin');
    return await createDeleteAccountHandler({ auth: getAuth(app), database: getFirestore(app), origin: APP_ORIGIN })(request, response);
  } catch { return response.status(503).json({ error: 'Account deletion is unavailable. Please try again later.' }); }
}
