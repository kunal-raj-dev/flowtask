import { useEffect, useMemo, useState } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { DEFAULT_STUDIO, type FocusRecipe, type MediaAsset, type StudioPreferences } from '../types/studio';
import { loadCatalog, BUILT_IN_RECIPES } from '../services/studioCatalog';
import { mediaService } from '../services/mediaService';

export function useStudioPreferences() {
  const { workspacePreferences = {}, setWorkspacePreference } = useTaskContext();
  const saved = workspacePreferences?.studio as Partial<StudioPreferences> | undefined;
  const preferences = useMemo(() => ({ ...DEFAULT_STUDIO, ...saved, timer: { ...DEFAULT_STUDIO.timer, ...saved?.timer } }), [saved]);
  const recipes = useMemo(() => [...BUILT_IN_RECIPES.map(r => ({...r, favorite: saved?.favoriteRecipes?.includes(r.id) || false})), ...((workspacePreferences?.focusRecipes || []) as FocusRecipe[])], [workspacePreferences?.focusRecipes, saved?.favoriteRecipes]);
  const update = (patch: Partial<StudioPreferences>) => setWorkspacePreference?.('studio', { ...preferences, ...patch });
  return { preferences, update, recipes, saveRecipes: (values: FocusRecipe[]) => {
    setWorkspacePreference?.('focusRecipes', values.filter(r => !r.builtIn));
    update({favoriteRecipes: values.filter(r => r.builtIn && r.favorite).map(r=>r.id)});
  } };
}
export function useMediaCatalog() {
  const { workspaceId } = useTaskContext();
  const [scenes, setScenes] = useState<MediaAsset[]>([]), [workspaceVisuals, setWorkspaceVisuals] = useState<MediaAsset[]>([]), [audio, setAudio] = useState<MediaAsset[]>([]);
  const [personal, setPersonal] = useState<MediaAsset[]>([]), [error, setError] = useState(''), [catalogLoading,setCatalogLoading]=useState(true), [personalLoading,setPersonalLoading]=useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void Promise.allSettled([
      loadCatalog('/media/backgrounds/catalog.json', abort.signal),
      loadCatalog('/media/audio/catalog.json', abort.signal),
      loadCatalog('/media/workspace/catalog.json', abort.signal),
    ]).then(results => {
      if (abort.signal.aborted) return;
      if (results[0].status === 'fulfilled') setScenes(results[0].value);
      if (results[1].status === 'fulfilled') setAudio(results[1].value);
      if (results[2].status === 'fulfilled') setWorkspaceVisuals(results[2].value);
      if (results.some(r => r.status === 'rejected')) { setError('Some media is unavailable. Your timer and offline noise still work.'); window.dispatchEvent(new CustomEvent('flowtask:media-error')); }
      setCatalogLoading(false);
    });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    let active = true; const urls: string[] = [];
    void mediaService.list(workspaceId).then(records => {
      if (!active) return;
      setPersonal(records.map(r => {
        const src = URL.createObjectURL(r.blob); urls.push(src);
        const thumbnail = r.thumbnail ? URL.createObjectURL(r.thumbnail) : undefined; if (thumbnail) urls.push(thumbnail);
        return { id: r.id, title: r.title, category: r.kind === 'audio' ? 'music' : 'personal', src, thumbnail,
          width: r.width, height: r.height, kind: r.kind === 'image' ? 'image' as const : undefined, genre: 'Personal', license: 'Personal file • this device only', creator: 'You', altText: r.kind === 'image' ? `Personal image: ${r.title}` : undefined };
      }));
    }).catch(() => { if (active) setError('Personal media storage is unavailable on this device.'); }).finally(() => { if (active) setPersonalLoading(false); });
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [workspaceId, revision]);
  useEffect(() => { const refresh = () => setRevision(r => r + 1); window.addEventListener('flowtask:media-changed', refresh); return () => window.removeEventListener('flowtask:media-changed', refresh); }, []);
  const allScenes = useMemo(() => [...scenes, ...personal.filter(a => a.category === 'personal')], [scenes, personal]);
  const allAudio = useMemo(() => [...audio, ...personal.filter(a => a.category === 'music')], [audio, personal]);
  const visuals = useMemo(() => [...workspaceVisuals, ...scenes.filter(a => a.kind !== 'video'), ...personal.filter(a => a.category === 'personal')], [workspaceVisuals, scenes, personal]);
  return { scenes: allScenes, workspaceVisuals, visuals, audio: allAudio, error, loading: catalogLoading || personalLoading, refreshPersonal: () => window.dispatchEvent(new Event('flowtask:media-changed')) };
}
