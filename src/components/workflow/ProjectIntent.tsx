import { useState } from 'react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { useModal } from '../../context/ModalContext';
import { useMediaCatalog, useStudioPreferences } from '../../hooks/useStudio';
import { formatSecondsToHumanReadable } from '../../utils/focusTimeFormat';
import type { Project } from '../../types/task';
import { ProjectPath } from './ProjectPath';
export function ProjectIntent({ project }: { project: Project }) {
  const ctx=useTaskContext(), {openModal}=useModal(), media=useMediaCatalog(), {preferences,update,recipes}=useStudioPreferences();
  const [outcome,setOutcome]=useState(project.outcome||'');
  const tasks=ctx.tasks.filter(t=>t.projectId===project.id&&!t.deletedAt&&!t.archivedAt);
  const active=tasks.filter(t=>t.status!=='done'), done=tasks.length-active.length;
  const remaining=active.reduce((n,t)=>n+Math.max(0,(t.estimatedMinutes||ctx.settings.defaultTaskDuration)-(t.timeSpentMinutes||0)),0);
  const cover=media.scenes.find(a=>a.id===project.coverAssetId);
  const save=(patch:Partial<Project>)=>ctx.updateProject(project.id,patch);
  const openTask=(id:string)=>ctx.setSelectedTaskId(id);
  return <section className="desk-project-overview">
    {cover && <img className="desk-project-cover" src={cover.variants?.[0]?.src||cover.poster||cover.src} alt="" loading="lazy"/>}
    <div className="desk-project-summary"><div><p className="desk-eyebrow">The outcome</p><p className="desk-project-outcome">{project.outcome||'Give this project a clear destination.'}</p><div className="desk-project-metrics"><span>{done}/{tasks.length} tasks completed</span><span>{formatSecondsToHumanReadable(remaining*60)} remaining estimate</span>{project.targetDate&&<span>Target · {new Date(project.targetDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}</div></div>
      <button className="desk-button primary" onClick={()=>{const recipe=recipes.find(r=>r.id===project.focusRecipeId);update({...preferences,...(recipe?{recipeId:recipe.id,sceneId:recipe.sceneId,breakSceneId:recipe.breakSceneId||recipe.sceneId,layers:recipe.layers,musicId:recipe.musicId,musicVolume:recipe.musicVolume,timer:recipe.timer}:{}),taskSource:'project',projectId:project.id});openModal('pomodoro',{taskId:active[0]?.id||null,initialPhase:recipe?.initialPhase});}}>Focus on this project<ArrowUpRight size={15}/></button>
    </div>
    <ProjectPath project={project} tasks={tasks} onSelectTask={id=>openTask(id)}/>
    <details className="desk-project-details"><summary>Project details<ChevronDown size={15}/></summary><div className="desk-settings-fields"><label>What will success look like?<input maxLength={500} value={outcome} onChange={e=>setOutcome(e.target.value)} onBlur={()=>{if(outcome!==project.outcome)save({outcome});}} placeholder="A concrete outcome to work towards"/></label><div className="desk-project-fields"><label>Target date<input aria-label="Project target date" type="date" value={project.targetDate||''} onChange={e=>save({targetDate:e.target.value||undefined})}/></label><label>Cover<select aria-label="Project cover" value={project.coverAssetId||''} onChange={e=>save({coverAssetId:e.target.value||undefined})}><option value="">No cover</option>{project.coverAssetId&&!cover&&<option value={project.coverAssetId}>Saved cover · unavailable here</option>}{media.scenes.filter(a=>a.kind!=='video').map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label><label>Focus recipe<select aria-label="Project focus recipe" value={project.focusRecipeId||''} onChange={e=>save({focusRecipeId:e.target.value||undefined})}><option value="">Current Studio setup</option>{recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Soft work-in-progress limit<input type="number" min={1} max={50} aria-label="Project WIP limit" value={project.wipLimit||''} onChange={e=>save({wipLimit:e.target.value?Math.min(50,Math.max(1,Number(e.target.value))):undefined})}/></label></div></div></details>
  </section>;
}
