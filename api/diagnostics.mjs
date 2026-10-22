import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firestoreRateLimit } from '../server/rate-limit.mjs';
import { deploymentOrigin } from '../server/deployment-origin.mjs';

const metrics = new Set(['LCP', 'INP', 'CLS', 'runtime_error', 'unhandled_rejection']);
const views = new Set(['today', 'inbox', 'timeline', 'upcoming', 'projects', 'project', 'dashboard', 'study', 'review', 'kanban', 'matrix', 'all', 'archive', 'trash', 'someday', 'smart', 'other']);
export function createDiagnosticsHandler({ origin, enabled, limit, log = value => console.info(JSON.stringify(value)) }) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (!enabled || !origin) return response.status(503).json({ error: 'Diagnostics are unavailable.' });
    if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });
    if (request.headers.origin !== origin) return response.status(403).json({ error: 'Origin is not permitted.' });
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 512 || Object.keys(body).some(key => !['metric', 'value', 'build', 'view', 'device'].includes(key)) || !metrics.has(body.metric) || !views.has(body.view) || !['desktop', 'mobile'].includes(body.device) || typeof body.build !== 'string' || !/^[a-zA-Z0-9_.-]{1,64}$/.test(body.build) || !Number.isFinite(body.value) || body.value < 0 || body.value > 3600000) return response.status(400).json({ error: 'Invalid diagnostic event.' });
    if (['runtime_error', 'unhandled_rejection'].includes(body.metric) && body.value !== 1) return response.status(400).json({ error: 'Invalid diagnostic event.' });
    try {
      if (!await limit(String(request.headers['x-vercel-forwarded-for'] || request.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim())) { response.setHeader('Retry-After', '60'); return response.status(429).json({ error: 'Retry later.' }); }
      log({ service: 'flowtask-client', metric: body.metric, value: body.value, build: body.build, view: body.view, device: body.device });
      return response.status(202).json({ accepted: true });
    } catch { return response.status(503).json({ error: 'Diagnostics are unavailable.' }); }
  };
}
export default async function handler(request, response) {
  const env = process.env;
  response.setHeader('Cache-Control', 'no-store');
  if (env.DIAGNOSTICS_ENABLED !== 'true' || !env.FIREBASE_ADMIN_PROJECT_ID || !env.FIREBASE_ADMIN_CLIENT_EMAIL || !env.FIREBASE_ADMIN_PRIVATE_KEY) return response.status(503).json({ error: 'Diagnostics are unavailable.' });
  try {
    const app = getApps().find(value => value.name === 'flowtask-admin') || initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n') }) }, 'flowtask-admin');
    return createDiagnosticsHandler({ origin: deploymentOrigin(env), enabled: true, limit: firestoreRateLimit(getFirestore(app), 'diagnostics', 60, 60) })(request, response);
  } catch { return response.status(503).json({ error: 'Diagnostics are unavailable.' }); }
}
