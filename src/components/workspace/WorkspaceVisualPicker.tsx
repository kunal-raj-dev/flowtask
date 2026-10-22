import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, ImagePlus, Search, Star } from "lucide-react";
import type { MediaAsset } from "../../types/studio";
import { useTaskContext } from "../../context/TaskContext";
import { mediaService } from "../../services/mediaService";
import { recommendWorkspaceVisuals, curateWorkspaceVisuals, WORKSPACE_VISUAL_CATEGORIES, WORKSPACE_VISUAL_STYLES, workspaceVisualCategoryLabel, workspaceVisualStyleLabel, type WorkspaceVisualCategory, type WorkspaceVisualContext, type WorkspaceVisualStyle } from "../../utils/workspaceVisuals";
import { Dialog } from "../ui/Dialog";

type FocalPoint = { x: number; y: number };
interface Props {
  isOpen: boolean;
  onClose: () => void;
  value?: string;
  assets: MediaAsset[];
  loading?: boolean;
  catalogError?: string;
  focalPoint?: FocalPoint;
  context?: WorkspaceVisualContext;
  onSelect: (assetId: string | undefined, focalPoint?: FocalPoint) => void;
}
interface LibraryState { favorites: string[]; recent: string[]; }
const EMPTY_STATE: LibraryState = { favorites: [], recent: [] };
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const WorkspaceVisualPicker: React.FC<Props> = ({ isOpen, onClose, value, assets: allAssets, loading = false, catalogError, focalPoint, context = { kind: "dashboard" }, onSelect }) => {
  const { workspaceId } = useTaskContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const storageKey = `flowtask-workspace-visuals:${workspaceId}`;
  const readLibraryState = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
      return { favorites: Array.isArray(parsed?.favorites) ? parsed.favorites.filter((id: unknown) => typeof id === "string") : [], recent: Array.isArray(parsed?.recent) ? parsed.recent.filter((id: unknown) => typeof id === "string").slice(0, 12) : [] };
    } catch { return EMPTY_STATE; }
  };
  const [category, setCategory] = useState<WorkspaceVisualCategory>("recommended");
  const [visualStyle, setVisualStyle] = useState<WorkspaceVisualStyle>("all");
  const [show, setShow] = useState<"library" | "favorites" | "recent">("library");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(value || "");
  const [position, setPosition] = useState<FocalPoint>(focalPoint || allAssets.find(asset => asset.id === value)?.focalPoint || { x: 50, y: 50 });
  const [libraryState, setLibraryState] = useState<LibraryState>(readLibraryState);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(libraryState)); } catch { /* The picker remains usable if browser storage is unavailable. */ } }, [libraryState, storageKey]);

  const selectedAsset = allAssets.find(asset => asset.id === selectedId);
  const projectName = context.projectName || "", outcome = context.outcome || "", taskTagsKey = (context.taskTags || []).join("\u001f");
  const recommendations = useMemo(() => recommendWorkspaceVisuals(allAssets, { kind: context.kind, projectName, outcome, taskTags: taskTagsKey ? taskTagsKey.split("\u001f") : [] }), [allAssets, context.kind, projectName, outcome, taskTagsKey]);
  const visibleAssets = useMemo(() => {
    let assets: MediaAsset[];
    if (show === "favorites") assets = libraryState.favorites.map(id => allAssets.find(asset => asset.id === id)).filter((asset): asset is MediaAsset => !!asset);
    else if (show === "recent") assets = libraryState.recent.map(id => allAssets.find(asset => asset.id === id)).filter((asset): asset is MediaAsset => !!asset);
    else if (category === "recommended") assets = query.trim() || visualStyle !== "all" ? allAssets : curateWorkspaceVisuals(allAssets, context).map(item => item.asset);
    else if (category === "all") assets = allAssets;
    else if (category === "focus") assets = allAssets.filter(asset => !asset.id.startsWith("local:") && !asset.category.startsWith("study-") && !asset.category.startsWith("code-") && !asset.category.startsWith("writing-") && !asset.category.startsWith("design-") && !asset.category.startsWith("planning-") && !asset.category.startsWith("personal-"));
    else assets = allAssets.filter(asset => asset.category === category);
    if (visualStyle !== "all") {
      assets = assets.filter(asset => visualStyle === "personal"
        ? asset.id.startsWith("local:") || asset.category === "personal"
        : asset.visualStyle === visualStyle);
    }
    const needle = query.trim().toLowerCase();
    if (needle) assets = assets.filter(asset => [asset.title, asset.category, workspaceVisualStyleLabel(asset.visualStyle), ...(asset.contexts || []), ...(asset.moods || [])].join(" ").toLowerCase().includes(needle));
    if (category === "recommended" && show === "library") assets = assets.slice(0, 12);
    return assets;
  }, [show, libraryState.favorites, libraryState.recent, category, visualStyle, allAssets, query, context]);
  const reasons = useMemo(() => new Map(recommendations.map(item => [item.asset.id, item.reason])), [recommendations]);

  const remember = (id: string) => setLibraryState(current => ({ ...current, recent: [id, ...current.recent.filter(item => item !== id)].slice(0, 12) }));
  const toggleFavorite = (id: string) => setLibraryState(current => ({ ...current, favorites: current.favorites.includes(id) ? current.favorites.filter(item => item !== id) : [id, ...current.favorites] }));
  const choose = () => {
    if (!selectedId) return;
    remember(selectedId); onSelect(selectedId, position); onClose();
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setError(""); setUploading(true);
    try {
      const asset = await mediaService.importFile(file, workspaceId);
      window.dispatchEvent(new Event("flowtask:media-changed"));
      setSelectedId(asset.id); setPosition({ x: 50, y: 50 }); setShow("library"); setCategory("all");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This image could not be added."); }
    finally { setUploading(false); }
  };

  return <Dialog isOpen={isOpen} onClose={onClose} title="Choose a workspace image" description="Curated covers and your personal images stay on the surfaces where they help." size="xl" className="workspace-visual-picker" footer={<><button type="button" className="desk-button" onClick={onClose}>Cancel</button>{value && <button type="button" className="desk-button" onClick={() => { onSelect(undefined); onClose(); }}>No cover</button>}<button type="button" className="desk-button primary" disabled={!selectedId || !selectedAsset} onClick={choose}>Use image</button></>}>
    <div className="workspace-visual-tools">
      <label className="workspace-visual-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search images or moods" aria-label="Search workspace images"/></label>
      <button type="button" className="desk-button" disabled={uploading} onClick={() => inputRef.current?.click()}><ImagePlus size={16}/>{uploading ? "Adding image…" : "Upload image"}</button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" aria-label="Upload a workspace image" onChange={event => { void upload(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}/>
      <a className="workspace-visual-credits" href="/media/workspace/CREDITS.md" target="_blank" rel="noreferrer">Credits &amp; licenses</a>
    </div>
    {error && <p className="workspace-visual-error" role="alert">{error}</p>}
    {catalogError && <p className="workspace-visual-hint" role="status">Some built-in images are unavailable. Upload a personal image or try again when online.</p>}
    {value && !allAssets.some(asset => asset.id === value) && <p className="workspace-visual-hint" role="status">This saved personal image is not available on this device. Choose another image to replace it.</p>}
    <div className="workspace-visual-filters" role="tablist" aria-label="Workspace image collections">
      <button type="button" role="tab" aria-selected={show === "library" && category === "recommended"} onClick={() => { setShow("library"); setCategory("recommended"); }}>Recommended</button>
      <button type="button" role="tab" aria-selected={show === "library" && category !== "recommended"} onClick={() => { setShow("library"); setCategory("all"); }}>All</button>
      <button type="button" role="tab" aria-selected={show === "favorites"} onClick={() => setShow("favorites")}><Star size={13}/>Favorites</button>
      <button type="button" role="tab" aria-selected={show === "recent"} onClick={() => setShow("recent")}><Clock3 size={13}/>Recent</button>
    </div>
    <label className="workspace-visual-style-filter"><span>Use case</span><select aria-label="Filter by use case" value={category === "recommended" ? "all" : category} onChange={event => { setShow("library"); setCategory(event.target.value as WorkspaceVisualCategory); }}><option value="all">Any purpose</option>{WORKSPACE_VISUAL_CATEGORIES.filter(([id]) => !["recommended", "all"].includes(id)).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label className="workspace-visual-style-filter"><span>Visual style</span><select aria-label="Filter by visual style" value={visualStyle} onChange={event => setVisualStyle(event.target.value as WorkspaceVisualStyle)}>{WORKSPACE_VISUAL_STYLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <p className="workspace-visual-context">{show === "favorites" ? "Your saved images" : show === "recent" ? "Images used recently on this device" : category === "recommended" ? context.kind === "project" && context.projectName ? `Suggestions based on “${context.projectName}” and its task tags. Nothing changes until you choose an image.` : "A calm selection for planning, reflection and your daily desk." : `${workspaceVisualCategoryLabel(category)} · Choose a cover that helps you recognize this space.`}</p>
    <div className="workspace-visual-layout" data-has-preview={selectedAsset ? true : undefined}>
      <div className="workspace-visual-grid" aria-label="Workspace image results">
        {visibleAssets.map(asset => {
          const isSelected = selectedId === asset.id;
          const imageSrc = asset.thumbnail || asset.variants?.[0]?.src || asset.src;
          return <article className="workspace-visual-card" key={asset.id} data-selected={isSelected || undefined}>
            <button type="button" className="workspace-visual-card-select" aria-label={`Select ${asset.title}`} aria-pressed={isSelected} onClick={() => { setSelectedId(asset.id); setPosition(asset.id === value && focalPoint ? focalPoint : asset.focalPoint || { x: 50, y: 50 }); }}>
              <img src={imageSrc} alt="" loading="lazy" width={asset.width || 400} height={asset.height || 225} onError={event => { event.currentTarget.dataset.broken = "true"; }}/>
              <span>{asset.title}</span>
            </button>
            <button type="button" className="workspace-visual-favorite" aria-label={`${libraryState.favorites.includes(asset.id) ? "Remove" : "Add"} ${asset.title} ${libraryState.favorites.includes(asset.id) ? "from" : "to"} favorites`} aria-pressed={libraryState.favorites.includes(asset.id)} onClick={() => toggleFavorite(asset.id)}><Star size={15} fill={libraryState.favorites.includes(asset.id) ? "currentColor" : "none"}/></button>
            <small className="workspace-visual-style-label">{workspaceVisualStyleLabel(asset.visualStyle || (asset.category === "personal" ? "personal" : undefined))}</small>
            {category === "recommended" && show === "library" && reasons.has(asset.id) && <small>{reasons.get(asset.id)}</small>}
          </article>;
        })}
        {!visibleAssets.length && <div className="workspace-visual-empty"><strong>{loading ? "Loading your image library…" : query ? "No matching images" : show === "favorites" ? "No favorites yet" : show === "recent" ? "No recent images yet" : "This collection is empty"}</strong><span>{loading ? "Your covers and device images will appear here." : "Try another collection or add a personal image."}</span></div>}
      </div>
      {selectedAsset && <aside className="workspace-visual-preview" aria-label="Selected image preview">
        <div className="workspace-visual-preview-image"><img src={selectedAsset.variants?.at(-1)?.src || selectedAsset.src} alt="" width={selectedAsset.width || 1672} height={selectedAsset.height || 941} style={{ objectPosition: `${position.x}% ${position.y}%` }} onError={event => { event.currentTarget.dataset.broken = "true"; }}/></div>
        <strong>{selectedAsset.title}</strong><small>{selectedAsset.category === "personal" ? "Personal image · stored on this device" : workspaceVisualCategoryLabel(selectedAsset.category)}</small>
        <label>Horizontal position <input type="range" min="0" max="100" value={position.x} onChange={event => setPosition(current => ({ ...current, x: clamp(Number(event.target.value)) }))}/></label>
        <label>Vertical position <input type="range" min="0" max="100" value={position.y} onChange={event => setPosition(current => ({ ...current, y: clamp(Number(event.target.value)) }))}/></label>
        <p>Crop preview follows the image’s focal point. Task content stays on solid, readable surfaces.</p>
      </aside>}
    </div>
  </Dialog>;
};
import '../../styles/workspace-visual-picker.css';
