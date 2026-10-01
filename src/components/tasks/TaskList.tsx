import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Task } from '../../types/task';
import { TaskCard } from './TaskCard';
import { Omnibar } from './Omnibar';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { Inbox, Lightbulb, Folder, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

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
  const {
    tasks,
    activeView,
    projects,
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    deleteTask,
  } = useTaskContext();

  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);

  let viewTitle = 'Tasks';
  let viewSubtitle = '';
  let ViewIcon = Folder;
  let gradientBg = 'from-stone-700 to-stone-900';
  let filtered: Task[] = [];
  let completed: Task[] = [];

  if (activeView === 'inbox') {
    viewTitle = 'Inbox';
    viewSubtitle = 'Capture thoughts quickly and organize them later';
    ViewIcon = Inbox;
    gradientBg = 'from-blue-500 to-indigo-600';
    filtered = tasks.filter((t) => t.status !== 'done' && t.projectId === 'inbox' && !t.dueDate);
    completed = tasks.filter((t) => t.status === 'done' && t.projectId === 'inbox');
  } else if (activeView === 'someday') {
    viewTitle = 'Someday / Maybe';
    viewSubtitle = 'Ideas, low-pressure backlog, and things to consider eventually';
    ViewIcon = Lightbulb;
    gradientBg = 'from-amber-400 to-yellow-500';
    filtered = tasks.filter((t) => t.status !== 'done' && (t.projectId === 'ideas' || !t.dueDate));
    completed = tasks.filter((t) => t.status === 'done' && t.projectId === 'ideas');
  } else if (activeView.startsWith('project:')) {
    const projId = activeView.split(':')[1];
    const project = projects.find((p) => p.id === projId);
    viewTitle = project ? project.name : 'Project';
    viewSubtitle = 'Project workspace';
    ViewIcon = Folder;
    gradientBg = 'from-purple-500 to-indigo-600';
    filtered = tasks.filter((t) => t.status !== 'done' && t.projectId === projId);
    completed = tasks.filter((t) => t.status === 'done' && t.projectId === projId);
  }

  const { focusedTaskId } = useKeyboardNavigation({
    tasks: filtered,
    onSelectTask,
    onToggleStatus: toggleTaskStatus,
    onTogglePinToday: toggleTaskPinToday,
    onUpdateTask: updateTask,
    onDeleteTask: deleteTask,
    enabled: true,
  });

  return (
    <div className="max-w-3xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className={`p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br ${gradientBg} text-white shadow-sm card-surface flex-shrink-0`}>
          <ViewIcon size={20} className="stroke-[2.2]" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight">
            {viewTitle}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">{viewSubtitle}</p>
        </div>
      </div>

      <Omnibar onOpenBrainDump={onOpenBrainDump} />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/20 rounded-2xl border border-[var(--border-hairline)]">
          <CheckCircle2 size={36} className="mx-auto mb-2 text-stone-300 dark:text-stone-700" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">No active tasks</p>
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
              isKeyboardFocused={focusedTaskId === task.id}
            />
          ))}
        </div>
      )}

      {/* Completed Accordion for this View */}
      {completed.length > 0 && (
        <div className="pt-4 border-t border-[var(--border-hairline)] mt-8">
          <button
            type="button"
            onClick={() => setIsCompletedCollapsed((prev) => !prev)}
            className="flex items-center justify-between w-full text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-1 group"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Completed ({completed.length})</span>
            </span>
            <span className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] flex items-center gap-1 font-normal">
              {isCompletedCollapsed ? 'Show' : 'Hide'}
              {isCompletedCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </span>
          </button>

          {!isCompletedCollapsed && (
            <div className="space-y-2 mt-3 animate-slide-down">
              {completed.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSelectTask={onSelectTask}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
