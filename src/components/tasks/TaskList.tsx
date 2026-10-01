import React from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Task } from '../../types/task';
import { TaskCard } from './TaskCard';
import { Omnibar } from './Omnibar';
import { Inbox, Lightbulb, Folder, CheckCircle2 } from 'lucide-react';

interface TaskListProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onOpenBrainDump: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  onSelectTask,
  onStartFocus,
  onOpenBrainDump,
}) => {
  const { tasks, activeView, projects } = useTaskContext();

  let viewTitle = 'Tasks';
  let viewSubtitle = '';
  let ViewIcon = Folder;
  let gradientBg = 'from-stone-700 to-stone-900';
  let filtered: Task[] = [];

  if (activeView === 'inbox') {
    viewTitle = 'Inbox';
    viewSubtitle = 'Capture thoughts quickly and organize them later';
    ViewIcon = Inbox;
    gradientBg = 'from-blue-500 to-indigo-600';
    filtered = tasks.filter((t) => t.status !== 'done' && t.projectId === 'inbox' && !t.dueDate);
  } else if (activeView === 'someday') {
    viewTitle = 'Someday / Maybe';
    viewSubtitle = 'Ideas, low-pressure backlog, and things to consider eventually';
    ViewIcon = Lightbulb;
    gradientBg = 'from-amber-400 to-yellow-500';
    filtered = tasks.filter((t) => t.status !== 'done' && (t.projectId === 'ideas' || !t.dueDate));
  } else if (activeView.startsWith('project:')) {
    const projId = activeView.split(':')[1];
    const project = projects.find((p) => p.id === projId);
    viewTitle = project ? project.name : 'Project';
    viewSubtitle = 'Project workspace';
    ViewIcon = Folder;
    gradientBg = 'from-purple-500 to-indigo-600';
    filtered = tasks.filter((t) => t.status !== 'done' && t.projectId === projId);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2.5 rounded-2xl bg-gradient-to-br ${gradientBg} text-white shadow-sm card-surface`}>
          <ViewIcon size={22} className="stroke-[2.2]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
            {viewTitle}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">{viewSubtitle}</p>
        </div>
      </div>

      <Omnibar onOpenBrainDump={onOpenBrainDump} />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/20 rounded-2xl border border-[var(--border-hairline)]">
          <CheckCircle2 size={36} className="mx-auto mb-2 text-stone-300 dark:text-stone-700" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">No tasks here</p>
          <p className="text-xs mt-1 text-[var(--text-secondary)]">Add a task using the bar above or press 'N'.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onSelectTask={onSelectTask}
              onStartFocus={onStartFocus}
            />
          ))}
        </div>
      )}
    </div>
  );
};
