// Preview URLs are injected by Vercel, never derived from request headers.
// Each deployment accepts only its own exact origin; production uses APP_ORIGIN.
export function deploymentOrigin(env = process.env) {
  let value = env.APP_ORIGIN;
  if (env.VERCEL_ENV === 'preview') {
    if (!/^[a-z0-9][a-z0-9.-]*\.vercel\.app$/i.test(env.VERCEL_URL || '')) return null;
    value = `https://${env.VERCEL_URL}`;
  }
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}
