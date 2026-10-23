/** Marketing entry at the root; explicit app links keep their existing destinations. */
export function isLandingLocation(location: Pick<Location, 'pathname' | 'search' | 'hash'>): boolean {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/welcome') return true;
  if (path !== '/' && path !== '/index.html') return false;
  const query = new URLSearchParams(location.search);
  return !query.has('view') && !query.has('action') && !location.hash.startsWith('#snapshot=');
}

/** Consumed legacy shortcuts stay inside the planner on the next refresh. */
export function canonicalWorkspaceUrl(href: string): URL {
  const url = new URL(href);
  if (['/', '/index.html'].includes(url.pathname.replace(/\/+$/, '') || '/')) url.pathname = '/app';
  return url;
}

/** Keep the configured dashboard start view distinct from the Daily Desk. */
export function resolveStartView(value: unknown): 'today' | 'dashboard' | 'inbox' | 'upcoming' | 'timeline' {
  return value === 'dashboard' || value === 'inbox' || value === 'upcoming' || value === 'timeline' ? value : 'today';
}
