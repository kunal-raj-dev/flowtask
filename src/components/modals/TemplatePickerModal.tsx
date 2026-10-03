import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import {
  loadTemplates,
  deleteCustomTemplate,
  instantiateTemplate,
} from '../../utils/templateEngine';
import type { TaskTemplate } from '../../types/task';
import {
  X,
  LayoutTemplate,
  Plus,
  Clock,
  Flag,
  Trash2,
  CheckCircle2,
  ListTodo,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const TemplatePickerModal: React.FC = () => {
  const {
    isTemplatePickerOpen,
    setIsTemplatePickerOpen,
    addTask,
    activeView,
    projects,
  } = useTaskContext();

  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (isTemplatePickerOpen) {
      setTemplates(loadTemplates());
    }
  }, [isTemplatePickerOpen]);

  if (!isTemplatePickerOpen) return null;

  const currentProjectId = activeView.startsWith('project:')
    ? activeView.split(':')[1]
    : 'inbox';
  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleUseTemplate = (tpl: TaskTemplate) => {
    const payload = instantiateTemplate(tpl, currentProjectId);
    addTask(tpl.name, payload);

    confetti({
      particleCount: 35,
      spread: 55,
      origin: { y: 0.7 },
      colors: ['#6366F1', '#EC4899', '#10B981'],
    });

    setIsTemplatePickerOpen(false);
  };

  const handleDeleteCustom = (e: React.MouseEvent, tplId: string) => {
    e.stopPropagation();
    deleteCustomTemplate(tplId);
    setTemplates(loadTemplates());
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'p1':
        return 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'p2':
        return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'p3':
        return 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20';
      default:
        return 'text-stone-600 dark:text-stone-400 bg-stone-500/10 border-stone-500/20';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={() => setIsTemplatePickerOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface-l2)] rounded-xl border border-[var(--border-hairline)] shadow-modal overflow-hidden flex flex-col max-h-[85vh] card-surface animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-hairline)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-[var(--color-brand)] border border-amber-500/20 shadow-xs">
              <LayoutTemplate size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                Workflow Templates
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Pre-configured checklists and workflows to execute operations with zero setup
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTemplatePickerOpen(false)}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {templates.map((tpl) => {
            const isExpanded = expandedTemplateId === tpl.id;
            return (
              <div
                key={tpl.id}
                className="p-4 rounded-lg bg-[var(--bg-surface-l1)]/70 hover:bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] transition-all card-surface"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedTemplateId(isExpanded ? null : tpl.id)}
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--color-brand)] transition-colors">
                        {tpl.name}
                      </h3>
                      {tpl.isCustom && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                          Custom
                        </span>
                      )}
                    </div>
                    {tpl.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-1">
                        {tpl.description}
                      </p>
                    )}

                    {/* Metadata chips */}
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getPriorityStyle(
                          tpl.defaultPriority
                        )}`}
                      >
                        <Flag size={9} className="inline mr-1" />
                        {tpl.defaultPriority.toUpperCase()}
                      </span>

                      {tpl.defaultEstimatedMinutes && (
                        <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1">
                          <Clock size={11} />
                          {tpl.defaultEstimatedMinutes}m
                        </span>
                      )}

                      <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1">
                        <ListTodo size={11} />
                        {tpl.subtaskTitles.length} subtasks
                      </span>

                      {tpl.contextTags?.map((ctx) => (
                        <span
                          key={ctx}
                          className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300"
                        >
                          @{ctx}
                        </span>
                      ))}

                      <span className="text-[11px] text-[var(--color-brand)] hover:underline flex items-center gap-0.5 ml-auto">
                        <span>{isExpanded ? 'Hide Steps' : 'Preview Steps'}</span>
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {tpl.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustom(e, tpl.id)}
                        title="Delete custom template"
                        className="p-2 text-[var(--text-muted)] hover:text-rose-500 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleUseTemplate(tpl)}
                      className="px-3.5 py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-bold text-xs shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>Use Template</span>
                    </button>
                  </div>
                </div>

                {/* Subtask preview accordion */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] space-y-1.5 animate-slide-down">
                    <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Included Steps:
                    </p>
                    {tpl.subtaskTitles.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs text-[var(--text-primary)] pl-2 py-0.5"
                      >
                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/40 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>
            Target Destination:{' '}
            <strong className="text-[var(--text-primary)]">
              {currentProject ? currentProject.name : 'Inbox'}
            </strong>
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            Tip: You can save any task as a template from its detail drawer
          </span>
        </div>
      </div>
    </div>
  );
};
