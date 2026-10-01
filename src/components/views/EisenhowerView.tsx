import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Priority } from '../../types/task';
import { Grid2X2, Plus, ArrowUpRight, Flame, Target, Zap, Coffee } from 'lucide-react';
import { formatLocalDate } from '../../utils/nlpParser';

interface EisenhowerViewProps {
  onSelectTask: (taskId: string) => void;
}

export const EisenhowerView: React.FC<EisenhowerViewProps> = ({
  onSelectTask,
}) => {
  const { tasks, updateTask, addTask, toggleTaskStatus } = useTaskContext();
  const [mobileQuadrant, setMobileQuadrant] = useState<Priority>('p1');

  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const todayStr = formatLocalDate(new Date());

  const quadrants: {
    priority: Priority;
    title: string;
    subtitle: string;
    icon: React.ElementType;
    color: string;
    badgeColor: string;
    bgAccent: string;
  }[] = [
    {
      priority: 'p1',
      title: 'Do First (Urgent & Important)',
      subtitle: 'Crises, immediate deadlines, pressing problems',
      icon: Flame,
      color: 'text-red-500',
      badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      bgAccent: 'border-red-500/20',
    },
    {
      priority: 'p2',
      title: 'Schedule (Important, Not Urgent)',
      subtitle: 'Strategic goals, deep work, health, relationships',
      icon: Target,
      color: 'text-amber-500',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      bgAccent: 'border-amber-500/20',
    },
    {
      priority: 'p3',
      title: 'Delegate / Quick Wins (Urgent, Not Important)',
      subtitle: 'Interruptive requests, quick administrative tasks',
      icon: Zap,
      color: 'text-blue-500',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      bgAccent: 'border-blue-500/20',
    },
    {
      priority: 'p4',
      title: 'Don\'t Do / Someday (Neither)',
      subtitle: 'Time wasters, low-yield ideas, backlog items',
      icon: Coffee,
      color: 'text-stone-400',
      badgeColor: 'bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20',
      bgAccent: 'border-stone-500/20',
    },
  ];

  const handleDrop = (e: React.DragEvent, priority: Priority) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      updateTask(taskId, { priority });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleQuickAdd = (priority: Priority) => {
    const title = window.prompt(`Add new task to ${priority.toUpperCase()}:`);
    if (title && title.trim()) {
      addTask(title.trim(), { priority });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm card-surface flex-shrink-0">
            <Grid2X2 size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Eisenhower Priority Matrix
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Categorize and focus by urgency and importance
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Quadrant Switcher */}
      <div className="md:hidden flex items-center p-1 bg-stone-200/70 dark:bg-white/[0.06] rounded-2xl border border-[var(--border-hairline)] mb-4 shadow-inner">
        {quadrants.map((q) => {
          const count = activeTasks.filter((t) => t.priority === q.priority).length;
          const isActive = mobileQuadrant === q.priority;
          const shortTitle =
            q.priority === 'p1'
              ? 'Do First'
              : q.priority === 'p2'
              ? 'Schedule'
              : q.priority === 'p3'
              ? 'Delegate'
              : 'Backlog';
          return (
            <button
              key={q.priority}
              type="button"
              onClick={() => setMobileQuadrant(q.priority)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-white dark:bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-sm card-surface'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{shortTitle}</span>
              <span className="text-[10px] font-mono font-bold opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {quadrants.map((q) => {
          const Icon = q.icon;
          const quadTasks = activeTasks.filter((t) => t.priority === q.priority);

          const isVisibleOnMobile = mobileQuadrant === q.priority;
          return (
            <div
              key={q.priority}
              onDrop={(e) => handleDrop(e, q.priority)}
              onDragOver={handleDragOver}
              className={`${
                isVisibleOnMobile ? 'flex' : 'hidden md:flex'
              } bg-[var(--bg-surface-l2)] rounded-3xl border border-[var(--border-hairline)] p-4 sm:p-5 flex-col shadow-card card-surface min-h-[260px] md:min-h-[280px] transition-all`}
            >
              {/* Quadrant Header */}
              <div className="flex items-start justify-between pb-3.5 mb-3.5 border-b border-[var(--border-hairline)]">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-[var(--bg-surface-l1)]">
                    <Icon size={16} className={q.color} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      {q.title}
                    </h3>
                    <p className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
                      {q.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border shadow-xs ${q.badgeColor}`}>
                    {quadTasks.length}
                  </span>
                  <button
                    onClick={() => handleQuickAdd(q.priority)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                    title="Add task to this quadrant"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Quadrant Task List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {quadTasks.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-xs text-[var(--text-muted)] border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl bg-[var(--bg-surface-l1)]/20">
                    Drop tasks here
                  </div>
                ) : (
                  quadTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                      onClick={() => onSelectTask(task.id)}
                      className="group p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/50 hover:bg-[var(--bg-surface-l2)] shadow-subtle cursor-grab active:cursor-grabbing transition-all flex items-center justify-between gap-2.5 card-surface hover:-translate-y-[0.5px]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskStatus(task.id);
                          }}
                          className="w-4 h-4 rounded-[5px] border border-stone-300 dark:border-stone-600 hover:border-amber-500 flex-shrink-0 transition-colors"
                        />
                        <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {task.title}
                        </span>
                      </div>

                      {/* Quick promote to Today */}
                      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {task.dueDate !== todayStr && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTask(task.id, { dueDate: todayStr });
                            }}
                            title="Move to Today"
                            aria-label="Move to Today"
                            className="p-1.5 text-[var(--text-muted)] hover:text-amber-500 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                          >
                            <ArrowUpRight size={14} />
                          </button>
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
