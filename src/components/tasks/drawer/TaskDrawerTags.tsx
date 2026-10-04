import React, { useState } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import type { Task } from '../../../types/task';
import { Badge } from '../../ui/Badge';
import { Tag, X, ChevronUp, ChevronDown } from 'lucide-react';

interface TaskDrawerTagsProps {
  task: Task;
}

export const TaskDrawerTags: React.FC<TaskDrawerTagsProps> = ({ task }) => {
  const { updateTask } = useTaskContext();
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const totalTagsCount = (task.tags?.length || 0) + (task.contextTags?.length || 0);

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('@')) {
      const clean = trimmed.slice(1).toLowerCase();
      const existing = task.contextTags || [];
      if (!existing.includes(clean)) {
        updateTask(task.id, { contextTags: [...existing, clean] });
      }
    } else {
      const clean = trimmed.replace(/^#/, '').toLowerCase();
      const existing = task.tags || [];
      if (!existing.includes(clean)) {
        updateTask(task.id, { tags: [...existing, clean] });
      }
    }
    setNewTagInput('');
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsTagsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-l2)]/60 hover:bg-[var(--bg-surface-l2)] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-[var(--color-brand)]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Tags & Contexts
          </span>
          {totalTagsCount > 0 && (
            <Badge variant="neutral" size="xs">
              {totalTagsCount}
            </Badge>
          )}
        </div>
        {isTagsExpanded ? (
          <ChevronUp size={15} className="text-[var(--text-muted)]" />
        ) : (
          <ChevronDown size={15} className="text-[var(--text-muted)]" />
        )}
      </button>

      {isTagsExpanded && (
        <div className="p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)] space-y-3 text-xs">
          {/* Current Tag Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {task.tags?.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--bg-surface-l1)] text-stone-700 dark:text-stone-300 border border-[var(--border-subtle)]"
              >
                <span>#{t}</span>
                <button
                  type="button"
                  onClick={() => {
                    const updated = (task.tags || []).filter((x) => x !== t);
                    updateTask(task.id, { tags: updated.length > 0 ? updated : undefined });
                  }}
                  className="hover:text-rose-500 transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}

            {task.contextTags?.map((ctx) => (
              <span
                key={ctx}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20"
              >
                <span>@{ctx}</span>
                <button
                  type="button"
                  onClick={() => {
                    const updated = (task.contextTags || []).filter((x) => x !== ctx);
                    updateTask(task.id, { contextTags: updated.length > 0 ? updated : undefined });
                  }}
                  className="hover:text-rose-500 transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}

            {(!task.tags || task.tags.length === 0) &&
              (!task.contextTags || task.contextTags.length === 0) && (
                <span className="text-[11px] text-[var(--text-muted)] italic">
                  No tags added yet.
                </span>
              )}
          </div>

          {/* Add Tag Form */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="task-tag-input"
              name="taskTag"
              aria-label="Add tag or context"
              type="text"
              placeholder="Add tag (e.g. #backend or @calls)..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="flex-1 bg-[var(--bg-surface-l1)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-lg px-3 py-1.5 outline-none card-surface"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!newTagInput.trim()}
              className="px-3 py-1.5 bg-stone-900 dark:bg-white text-white dark:text-stone-950 text-xs font-semibold rounded-lg disabled:opacity-40 transition-all card-surface cursor-pointer"
            >
              Add
            </button>
          </div>

          {/* Quick Helper Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] text-[var(--text-muted)] font-medium">Quick add:</span>
            {['@computer', '@calls', '@errands', '@desk', '@focus'].map((chip) => {
              const tagClean = chip.slice(1);
              const isPresent = (task.contextTags || []).includes(tagClean);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    const existing = task.contextTags || [];
                    if (isPresent) {
                      updateTask(task.id, { contextTags: existing.filter((x) => x !== tagClean) });
                    } else {
                      updateTask(task.id, { contextTags: [...existing, tagClean] });
                    }
                  }}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border transition-colors ${
                    isPresent
                      ? 'bg-teal-600 text-white border-teal-600 font-bold'
                      : 'bg-[var(--bg-surface-l1)] text-teal-700 dark:text-teal-300 border-teal-500/20 hover:bg-teal-500/10'
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
