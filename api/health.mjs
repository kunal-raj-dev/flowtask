import { deploymentOrigin } from '../server/deployment-origin.mjs';

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET' && request.method !== 'HEAD') return response.status(405).json({ error: 'Use GET.' });
  const configured = Boolean(deploymentOrigin() && process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  return response.status(configured ? 200 : 503).json({ service: 'flowtask', configured, build: String(process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'development').slice(0, 64) });
}
