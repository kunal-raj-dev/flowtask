import React from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { TaskStatus } from '../../types/task';
import { Kanban, Plus, Circle, Clock, CheckCircle2 } from 'lucide-react';

interface KanbanViewProps {
  onSelectTask: (taskId: string) => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  onSelectTask,
}) => {
  const { tasks, updateTask, addTask } = useTaskContext();

  const columns: {
    status: TaskStatus;
    title: string;
    icon: React.ElementType;
    color: string;
    badgeBg: string;
  }[] = [
    {
      status: 'todo',
      title: 'To Do',
      icon: Circle,
      color: 'text-stone-500',
      badgeBg: 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300',
    },
    {
      status: 'in_progress',
      title: 'In Progress',
      icon: Clock,
      color: 'text-amber-500',
      badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
    },
    {
      status: 'done',
      title: 'Completed',
      icon: CheckCircle2,
      color: 'text-emerald-500',
      badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
    },
  ];

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      updateTask(taskId, {
        status,
        completedAt: status === 'done' ? Date.now() : undefined,
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAddTaskToColumn = (status: TaskStatus) => {
    const title = window.prompt(`Add new task to ${status.replace('_', ' ').toUpperCase()}:`);
    if (title && title.trim()) {
      addTask(title.trim(), { status });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm card-surface">
            <Kanban size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Kanban Board
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Drag and drop tasks between workflow stages
            </p>
          </div>
        </div>
      </div>

      {/* Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1 items-start">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          const ColIcon = col.icon;

          return (
            <div
              key={col.status}
              onDrop={(e) => handleDrop(e, col.status)}
              onDragOver={handleDragOver}
              className="bg-[var(--bg-surface-l1)]/60 rounded-3xl p-4 border border-[var(--border-hairline)] flex flex-col min-h-[520px] backdrop-blur-xs shadow-xs"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3.5 px-1">
                <div className="flex items-center gap-2">
                  <ColIcon size={16} className={col.color} />
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    {col.title}
                  </h3>
                  <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border border-[var(--border-subtle)] shadow-xs ${col.badgeBg}`}>
                    {colTasks.length}
                  </span>
                </div>

                <button
                  onClick={() => handleAddTaskToColumn(col.status)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
                  title={`Add to ${col.title}`}
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Tasks List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-xs text-[var(--text-muted)] border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl bg-[var(--bg-surface-l2)]/30">
                    Drop cards here
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                      onClick={() => onSelectTask(task.id)}
                      className="p-3.5 bg-[var(--bg-surface-l2)] rounded-2xl border border-[var(--border-hairline)] shadow-card hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-elevated hover:-translate-y-[1px] cursor-grab active:cursor-grabbing transition-all space-y-2 card-surface"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--text-primary)] leading-snug">
                          {task.title}
                        </span>
                        {task.priority !== 'p4' && (
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border shadow-xs ${
                              task.priority === 'p1'
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                : task.priority === 'p2'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                            }`}
                          >
                            {task.priority}
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-1.5 border-t border-[var(--border-hairline)]">
                        <span>{task.dueDate || 'No date'}</span>
                        {task.subtasks && task.subtasks.length > 0 && (
                          <span>
                            {task.subtasks.filter((s) => s.completed).length}/
                            {task.subtasks.length} subtasks
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
