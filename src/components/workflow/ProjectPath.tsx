import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Circle, Plus, SkipForward } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import type { Project, ProjectMilestone, Task } from '../../types/task';

const STARTER_PATHS = {
  study: ['Gather course material', 'Learn the key concepts', 'Practice and revise', 'Check exam readiness'],
  build: ['Define the first useful version', 'Build the core flow', 'Test and refine', 'Ship and review'],
} as const;

export function ProjectPath({ project, tasks, onSelectTask }: { project: Project; tasks: Task[]; onSelectTask: (id: string) => void }) {
  const { updateProject, updateTask } = useTaskContext();
  const [draft, setDraft] = useState('');
  const milestones = useMemo(() => [...(project.milestones || [])].sort((a, b) => a.order - b.order), [project.milestones]);
  const activeTasks = tasks.filter(task => task.status !== 'done' && !task.deletedAt && !task.archivedAt);
  const save = (next: ProjectMilestone[]) => updateProject(project.id, { milestones: next });
  const add = (title: string) => {
    const clean = title.trim();
    if (!clean || milestones.length >= 100) return;
    save([...milestones, { id: crypto.randomUUID(), title: clean, order: milestones.length }]);
    setDraft('');
  };
  const applyStarter = (key: keyof typeof STARTER_PATHS) => {
    if (milestones.length) return;
    save(STARTER_PATHS[key].map((title, order) => ({ id: crypto.randomUUID(), title, order })));
  };
  const move = (index: number, direction: -1 | 1) => {
    const next = [...milestones];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    save(next.map((milestone, order) => ({ ...milestone, order })));
  };
  const assigned = (id: string) => tasks.filter(task => task.milestoneId === id && !task.deletedAt && !task.archivedAt);

  return <section className="project-path" aria-labelledby="project-path-title">
    <div className="project-path-heading">
      <div><p className="desk-eyebrow">A path through the work</p><h2 id="project-path-title">Milestones</h2><p>Keep the outcome visible and choose the next useful step.</p></div>
      {milestones.length > 0 && <span>{milestones.filter(m => m.completedAt || m.skippedAt).length}/{milestones.length} complete or skipped</span>}
    </div>

    {milestones.length === 0 && <div className="project-path-starters">
      <button type="button" onClick={() => applyStarter('study')}>Start a study path <span>Course or exam</span></button>
      <button type="button" onClick={() => applyStarter('build')}>Start a build path <span>Feature or release</span></button>
    </div>}

    {milestones.map((milestone, index) => {
      const milestoneTasks = assigned(milestone.id);
      const nextTask = milestoneTasks.find(task => task.status !== 'done');
      const closed = Boolean(milestone.completedAt || milestone.skippedAt);
      return <article className={`project-milestone${closed ? ' is-closed' : ''}`} key={milestone.id}>
        <div className="project-milestone-marker" aria-hidden="true">{milestone.completedAt ? <Check size={15}/> : <Circle size={13}/>}</div>
        <div className="project-milestone-content">
          <div className="project-milestone-title-row">
            <input aria-label={`Milestone ${index + 1} title`} defaultValue={milestone.title} maxLength={500} onBlur={event => {
              const title = event.currentTarget.value.trim();
              if (title && title !== milestone.title) save(milestones.map(item => item.id === milestone.id ? { ...item, title } : item));
              else if (!title) event.currentTarget.value = milestone.title;
            }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/>
            <div className="project-milestone-actions">
              <button type="button" aria-label={`Move ${milestone.title} earlier`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15}/></button>
              <button type="button" aria-label={`Move ${milestone.title} later`} disabled={index === milestones.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15}/></button>
              <button type="button" aria-label={milestone.skippedAt ? `Restore ${milestone.title}` : `Skip ${milestone.title}`} onClick={() => save(milestones.map(item => item.id === milestone.id ? { ...item, skippedAt: item.skippedAt ? undefined : Date.now(), completedAt: undefined } : item))}><SkipForward size={15}/></button>
              <button type="button" aria-label={milestone.completedAt ? `Reopen ${milestone.title}` : `Complete ${milestone.title}`} onClick={() => save(milestones.map(item => item.id === milestone.id ? { ...item, completedAt: item.completedAt ? undefined : Date.now(), skippedAt: undefined } : item))}><Check size={15}/></button>
            </div>
          </div>
          <div className="project-milestone-meta">
            <label>Target date <input aria-label={`${milestone.title} target date`} type="date" value={milestone.dueDate || ''} onChange={event => save(milestones.map(item => item.id === milestone.id ? { ...item, dueDate: event.target.value || undefined } : item))}/></label>
            <span>{milestoneTasks.filter(task => task.status === 'done').length}/{milestoneTasks.length} tasks</span>
            {milestone.skippedAt && <span>Skipped</span>}
          </div>
          {nextTask && <button className="project-milestone-next" type="button" onClick={() => onSelectTask(nextTask.id)}>Next task · {nextTask.title}</button>}
          <div className="project-milestone-assignments">
            {milestoneTasks.map(task => <span key={task.id} className={task.status === 'done' ? 'is-done' : ''}>{task.title}</span>)}
            <label>Link a task<select aria-label={`Link a task to ${milestone.title}`} value="" onChange={event => { if (event.target.value) updateTask(event.target.value, { milestoneId: milestone.id }); }}>
              <option value="">Choose a project task…</option>
              {activeTasks.filter(task => task.projectId === project.id && (!task.milestoneId || task.milestoneId === milestone.id)).map(task => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select></label>
          </div>
        </div>
      </article>;
    })}

    {milestones.length < 100 && <form className="project-path-add" onSubmit={event => { event.preventDefault(); add(draft); }}>
      <input aria-label="New project milestone" value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} placeholder="Add the next checkpoint"/>
      <button type="submit" disabled={!draft.trim()}><Plus size={15}/> Add milestone</button>
    </form>}
  </section>;
}
