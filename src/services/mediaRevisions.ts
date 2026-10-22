let revisions: Promise<Record<string, string>> | undefined;
export function revisionedMediaUrl(src: string | undefined, map: Record<string, string>): string | undefined {
  if (!src?.startsWith('/media/')) return src;
  const pathname = src.split('?')[0];
  return map[pathname] ? `${pathname}?v=${map[pathname]}` : src;
}
export function loadMediaRevisions(): Promise<Record<string, string>> {
  revisions ??= (async () => {
    const cache = typeof caches !== 'undefined' ? await caches.open('flowtask-media-manifest-v1').catch(() => null) : null;
    let response: Response | undefined;
    try {
      const fresh = await fetch('/media-revisions.json', { cache: 'no-cache', signal: AbortSignal.timeout(4000) });
      if (!fresh.ok) throw new Error('Manifest unavailable');
      response = fresh;
      await cache?.put('/media-revisions.json', fresh.clone());
    } catch { response = (await cache?.match('/media-revisions.json')) || undefined; }
    if (!response) return {};
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, hash]) => key.startsWith('/media/') && typeof hash === 'string' && /^[a-f0-9]{12}$/.test(hash)));
  })().catch(() => ({}));
  return revisions;
}
