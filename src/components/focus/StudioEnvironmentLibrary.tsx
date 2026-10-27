import { ArrowRight, ArrowUpRight, Check, Headphones, Leaf } from 'lucide-react';
import { FEATURED_ROOMS, roomImage } from '../../services/featuredRooms';
import { resolveAsset } from '../../services/studioCatalog';
import type { FocusRecipe, MediaAsset } from '../../types/studio';

/** A room preview first; the full catalog and saved rituals remain one click away. */
export function StudioEnvironmentLibrary({
  scene, scenes, recipes, savedRecipes, recipeId, onChooseScene, onChooseRecipe,
  onBrowseRooms, onBrowseRecipes,
}: {
  scene?: MediaAsset;
  scenes: MediaAsset[];
  recipes: FocusRecipe[];
  savedRecipes: FocusRecipe[];
  recipeId: string;
  onChooseScene: (id: string) => void;
  onChooseRecipe: (recipe: FocusRecipe) => void;
  onBrowseRooms: () => void;
  onBrowseRecipes: () => void;
}) {
  const featured = FEATURED_ROOMS.find(room => room.id === scene?.id);
  const cover = scene && (scene.kind === 'video' ? scene.poster || scene.thumbnail : scene.variants?.find(variant => variant.width >= 960)?.src || scene.src);
  const renderRecipe = (recipe: FocusRecipe) => {
    const image = resolveAsset(recipe.sceneId, scenes);
    return <button key={recipe.id} aria-pressed={recipeId === recipe.id} onClick={() => onChooseRecipe(recipe)}>
      {image ? <img src={image.thumbnail || image.poster || image.src} alt="" loading="lazy" /> : <span className="studio-ritual-symbol" aria-hidden="true"><Leaf size={17} /></span>}
      <span>{recipe.name}<small>{recipe.timer.mode === 'stopwatch' ? 'Your own pace' : `${recipe.timer.focusMinutes} min focus · ${recipe.timer.shortBreakMinutes} min rest`}</small></span>
      {recipeId === recipe.id && <Check size={13} />}
    </button>;
  };

  return <aside className={`studio-lobby-library ${savedRecipes.length ? 'has-saved' : ''}`} aria-label="Choose your focus environment">
    <button className="studio-room-feature" aria-label="Browse rooms" onClick={onBrowseRooms}>
      {cover ? <img src={cover} alt="" /> : <span className="studio-room-placeholder" aria-hidden="true"><Leaf size={42} strokeWidth={1} /></span>}
      <span className="studio-room-feature-copy"><small>YOUR SOMEWHERE, RIGHT HERE</small><strong>{scene?.title || 'Find your quiet corner'}</strong><span>{featured?.mood || 'A little distance from the everyday.'}</span></span>
      <span className="studio-room-feature-link" aria-hidden="true"><ArrowUpRight size={19} /></span>
    </button>
    <div className="studio-environment-content">
      <div className="studio-lobby-section-heading"><h3>A change of scene</h3><button onClick={onBrowseRooms}>All rooms<ArrowRight size={13} /></button></div>
      <div className="studio-lobby-rooms">{FEATURED_ROOMS.slice(0, 3).map(room => <button key={room.id} aria-label={`Choose ${room.title} room`} aria-pressed={scene?.id === room.id} onClick={() => onChooseScene(room.id)}>
        <img src={roomImage(room.id, true)} alt="" loading="lazy" />
        <span>{room.title}</span>{scene?.id === room.id && <Check size={12} />}
      </button>)}</div>
      <div className="studio-lobby-section-heading"><h3>A ritual to settle into</h3><button onClick={onBrowseRecipes}>All rituals<ArrowRight size={13} /></button></div>
      <div className="studio-lobby-recipes">{recipes.filter(recipe => recipe.builtIn).slice(0, 3).map(renderRecipe)}</div>
      {savedRecipes.length > 0 && <><div className="studio-lobby-section-heading studio-saved-heading"><h3>Saved for your flow</h3></div><div className="studio-lobby-recipes studio-saved-recipes">{savedRecipes.map(renderRecipe)}</div></>}
      <p className="studio-lobby-note"><Headphones size={13} />Your sound begins when your session does.</p>
    </div>
  </aside>;
}
