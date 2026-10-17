import { useEffect, useState } from 'react';
import { loadCatalog } from '../services/studioCatalog';
import type { MediaAsset } from '../types/studio';
let pending: Promise<MediaAsset[]> | undefined;
let loaded: MediaAsset[] = [];
/** Widgets share catalog metadata; they never enumerate or create URLs for personal blobs. */
export function useBuiltInScenes() {
  const [scenes, setScenes] = useState(loaded);
  useEffect(() => {
    let alive = true;
    pending ??= loadCatalog('/media/backgrounds/catalog.json').then(value => { loaded = value.filter(a => a.kind !== 'video'); return loaded; }).catch(() => { pending = undefined; return loaded; });
    void pending.then(value => { if (alive) setScenes(value); });
    return () => { alive = false; };
  }, []);
  return scenes;
}
