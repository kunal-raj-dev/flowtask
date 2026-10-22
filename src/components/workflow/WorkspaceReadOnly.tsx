import type { WorkspaceRecord } from '../../types/workspace';

export function WorkspaceReadOnly({ record }: { record: WorkspaceRecord }) {
  const tasks = record.tasks.filter(task => !task.deletedAt && !task.archivedAt);
  return <main className="workspace-readonly-preview">
    <p className="desk-eyebrow">FLOWTASK · DEVICE PREVIEW</p><h1>Your workspace, safely in view.</h1>
    <p>Edits continue in the other tab. This preview follows its saved changes. Choose Use this tab above to move editing here.</p>
    <div className="readonly-summary"><span>{tasks.filter(task => task.status !== 'done').length} active tasks</span><span>{record.projects.filter(project => project.id !== 'inbox').length} projects</span></div>
    <section aria-label="Saved task preview">{tasks.slice(0, 50).map(task => <article key={task.id}><span>{task.status === 'done' ? '✓' : '○'}</span><div><strong>{task.title}</strong><small>{task.status === 'done' ? 'Completed' : task.status === 'in_progress' ? 'In progress' : 'To do'}{task.plannedDate ? ` · ${task.plannedDate}` : ''}</small></div></article>)}{!tasks.length && <p>Your saved tasks will appear here.</p>}{tasks.length > 50 && <p>Showing the first 50 saved tasks. Move editing here to browse the full workspace.</p>}</section>
  </main>;
}
