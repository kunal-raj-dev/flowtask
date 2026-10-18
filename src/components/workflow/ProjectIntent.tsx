import { useState } from 'react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { useModal } from '../../context/ModalContext';
import { useStudioPreferences } from '../../hooks/useStudio';
import { formatSecondsToHumanReadable } from '../../utils/focusTimeFormat';
import type { Project } from '../../types/task';
import { ProjectPath } from './ProjectPath';
import { WorkspaceVisualPicker } from '../workspace/WorkspaceVisualPicker';
import type { MediaAsset } from '../../types/studio';
export function ProjectIntent({ project, visualAssets, mediaLoading = false, mediaError }: { project: Project; visualAssets: MediaAsset[]; mediaLoading?: boolean; mediaError?: string }) {
  const ctx=useTaskContext(), {openModal}=useModal(), {preferences,update,recipes}=useStudioPreferences();
  const [outcome,setOutcome]=useState(project.outcome||''), [coverPickerOpen,setCoverPickerOpen]=useState(false);
  const tasks=ctx.tasks.filter(t=>t.projectId===project.id&&!t.deletedAt&&!t.archivedAt);
  const active=tasks.filter(t=>t.status!=='done'), done=tasks.length-active.length;
  const remaining=active.reduce((n,t)=>n+Math.max(0,(t.estimatedMinutes||ctx.settings.defaultTaskDuration)-(t.timeSpentMinutes||0)),0);
  const cover=visualAssets.find(a=>a.id===project.coverAssetId);
  const visualContext={kind:'project' as const,projectName:project.name,outcome:project.outcome,taskTags:tasks.flatMap(task=>task.tags||[])};
  const save=(patch:Partial<Project>)=>ctx.updateProject(project.id,patch);
  const openTask=(id:string)=>ctx.setSelectedTaskId(id);
  return <section className="desk-project-overview">
    {cover && <img className="desk-project-cover" src={cover.variants?.[0]?.src||cover.poster||cover.src} alt="" loading="lazy" width={cover.width||960} height={cover.height||540} style={{objectPosition:`${project.coverFocalPoint?.x??cover.focalPoint?.x??50}% ${project.coverFocalPoint?.y??cover.focalPoint?.y??50}%`}}/>}
    {project.coverAssetId&&!cover&&!mediaLoading&&<div className="desk-project-cover desk-project-cover-missing" role="status"><span>Personal project image unavailable on this device.</span><button type="button" className="desk-button" onClick={()=>setCoverPickerOpen(true)}>Choose replacement</button></div>}
    <div className="desk-project-summary"><div><p className="desk-eyebrow">The outcome</p><p className="desk-project-outcome">{project.outcome||'Give this project a clear destination.'}</p><div className="desk-project-metrics"><span>{done}/{tasks.length} tasks completed</span><span>{formatSecondsToHumanReadable(remaining*60)} remaining estimate</span>{project.targetDate&&<span>Target · {new Date(project.targetDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}</div></div>
      <button className="desk-button primary" onClick={()=>{const recipe=recipes.find(r=>r.id===project.focusRecipeId);update({...preferences,...(recipe?{recipeId:recipe.id,sceneId:recipe.sceneId,breakSceneId:recipe.breakSceneId||recipe.sceneId,layers:recipe.layers,musicId:recipe.musicId,musicVolume:recipe.musicVolume,timer:recipe.timer}:{}),taskSource:'project',projectId:project.id});openModal('pomodoro',{taskId:active[0]?.id||null,initialPhase:recipe?.initialPhase});}}>Focus on this project<ArrowUpRight size={15}/></button>
    </div>
    <ProjectPath project={project} tasks={tasks} onSelectTask={id=>openTask(id)}/>
    <details className="desk-project-details"><summary>Project details<ChevronDown size={15}/></summary><div className="desk-settings-fields"><label>What will success look like?<input maxLength={500} value={outcome} onChange={e=>setOutcome(e.target.value)} onBlur={()=>{if(outcome!==project.outcome)save({outcome});}} placeholder="A concrete outcome to work towards"/></label><div className="desk-project-fields"><label>Target date<input aria-label="Project target date" type="date" value={project.targetDate||''} onChange={e=>save({targetDate:e.target.value||undefined})}/></label><div className="desk-project-cover-field"><span>Project image</span>{project.coverAssetId&&!cover&&!mediaLoading&&<small role="status">Saved personal image is unavailable on this device.</small>}<button type="button" className="desk-button" onClick={()=>setCoverPickerOpen(true)}>{cover?'Change image':project.coverAssetId?'Choose replacement':'Choose image'}</button>{project.coverAssetId&&<button type="button" className="desk-button" onClick={()=>save({coverAssetId:undefined,coverFocalPoint:undefined})}>Remove image</button>}</div><label>Focus recipe<select aria-label="Project focus recipe" value={project.focusRecipeId||''} onChange={e=>save({focusRecipeId:e.target.value||undefined})}><option value="">Current Studio setup</option>{recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Soft work-in-progress limit<input type="number" min={1} max={50} aria-label="Project WIP limit" value={project.wipLimit||''} onChange={e=>save({wipLimit:e.target.value?Math.min(50,Math.max(1,Number(e.target.value))):undefined})}/></label></div></div></details>
    {coverPickerOpen&&<WorkspaceVisualPicker isOpen={coverPickerOpen} onClose={()=>setCoverPickerOpen(false)} assets={visualAssets} loading={mediaLoading} catalogError={mediaError} value={project.coverAssetId} focalPoint={project.coverFocalPoint} context={visualContext} onSelect={(coverAssetId,coverFocalPoint)=>save({coverAssetId,coverFocalPoint:coverAssetId?coverFocalPoint:undefined})}/>}
  </section>;
}
