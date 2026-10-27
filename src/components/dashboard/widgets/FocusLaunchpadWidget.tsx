import { useTaskAvailabilityClock } from '../../../hooks/useTaskAvailabilityClock';
import React from 'react';
import { Play, ArrowUpRight } from 'lucide-react';
import { useTaskContext } from '../../../context/TaskContext';
import { ModalContext } from '../../../context/ModalContext';
import { useStudioPreferences } from '../../../hooks/useStudio';
import { useBuiltInScenes } from '../../../hooks/useBuiltInScenes';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { isFocusTask } from '../../../utils/taskSelectors';
import type { WidgetComponentProps } from '../../../types/dashboard';
export const FocusLaunchpadWidget: React.FC<WidgetComponentProps> = ({ widget }) => {
  const modal = React.useContext(ModalContext), { focusSession, tasks, projects = [] } = useTaskContext(), { recipes, update, preferences } = useStudioPreferences(), scenes = useBuiltInScenes(), today = useTodayStr();
  const availabilityNow = useTaskAvailabilityClock(tasks);
  const entries = [...recipes.filter(r => r.favorite), ...recipes.filter(r => !r.favorite)].slice(0,Number(widget.config.maxRecipes || 3));
  const task = tasks.find(t => isFocusTask(t, today, { tasks, projects, now: availabilityNow }));
  const open = () => modal?.openModal('pomodoro');
  return <div className="desk-focus-recipes">
    {focusSession && <button className="desk-active-session" onClick={open}><span><strong>{focusSession.taskTitle || 'Your focus session'}</strong><small>{focusSession.state === 'paused' ? 'Paused · Ready when you are' : 'Session in progress'}</small></span><ArrowUpRight size={17}/></button>}
    {entries.map(recipe => { const scene = scenes.find(s => s.id === recipe.sceneId); return <button className="desk-recipe" key={recipe.id} onClick={() => {
      if (focusSession) { open(); return; }
      update({ recipeId:recipe.id,sceneId:recipe.sceneId,breakSceneId:recipe.breakSceneId||recipe.sceneId,layers:recipe.layers,musicId:recipe.musicId,musicVolume:recipe.musicVolume,timer:recipe.timer,taskSource:recipe.taskSource==='project'&&!preferences.projectId?'top3':recipe.taskSource });
      modal?.openModal('pomodoro',{taskId:task?.id||null,initialPhase:recipe.initialPhase});
    }}><span className="desk-recipe-art">{scene?.thumbnail && <img src={scene.thumbnail} alt="" loading="lazy"/>}</span><span className="desk-recipe-info"><strong>{recipe.name}</strong><small>{recipe.timer.mode === 'stopwatch' ? 'Open-ended' : recipe.timer.focusMinutes+' min'} · {recipe.layers.length ? 'Ambient sound' : 'Quiet space'}</small></span><Play size={15}/></button>; })}
    <button className="desk-text-action" onClick={open}>Find your flow<ArrowUpRight size={14}/></button>
  </div>;
};
