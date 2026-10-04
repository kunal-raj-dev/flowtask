import React, { useState } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import type { Task } from '../../../types/task';
import { Eye, Edit3 } from 'lucide-react';

interface TaskDrawerNotesProps {
  task: Task;
}

export const TaskDrawerNotes: React.FC<TaskDrawerNotesProps> = ({ task }) => {
  const { updateTask } = useTaskContext();
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);

  const renderBoldCode = (text: string): React.ReactNode => {
    const tokenRegex = /(\*\*[^*]+\*\*)|(`[^`]+`)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="font-semibold text-[var(--text-primary)]">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            className="px-1.5 py-0.5 rounded bg-stone-200/60 dark:bg-white/[0.08] font-mono text-[11px] text-[var(--color-brand)] font-semibold"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  const renderFormattedInline = (text: string): React.ReactNode => {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderBoldCode(text.substring(lastIndex, match.index)));
      }
      if (match[1] && match[2]) {
        parts.push(
          <a
            key={match.index}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--color-brand)] hover:underline inline-flex items-center gap-0.5 font-medium underline-offset-2"
          >
            {match[1]}
          </a>
        );
      } else if (match[3]) {
        parts.push(
          <a
            key={match.index}
            href={match[3]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--color-brand)] hover:underline inline-flex items-center gap-0.5 font-medium underline-offset-2"
          >
            {match[3]}
          </a>
        );
      }
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(renderBoldCode(text.substring(lastIndex)));
    }

    return parts;
  };

  const renderMarkdownNotes = (text: string) => {
    if (!text.trim()) {
      return (
        <p className="text-xs text-[var(--text-muted)] italic py-2">
          No notes added yet. Click &quot;Edit Notes&quot; to add details, checklists, or links...
        </p>
      );
    }

    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 text-xs text-[var(--text-primary)] leading-relaxed py-1">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-xs text-[var(--text-primary)] pt-1">
                {line.slice(4)}
              </h4>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h3 key={idx} className="font-bold text-sm text-[var(--text-primary)] pt-1.5">
                {line.slice(3)}
              </h3>
            );
          }
          if (line.startsWith('# ')) {
            return (
              <h2 key={idx} className="font-bold text-base text-[var(--text-primary)] pt-2">
                {line.slice(2)}
              </h2>
            );
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-amber-500 font-bold">•</span>
                <span>{renderFormattedInline(line.slice(2))}</span>
              </div>
            );
          }
          if (line.startsWith('- [ ] ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2 text-[var(--text-secondary)]">
                <span className="w-3 h-3 rounded border border-stone-400 dark:border-stone-600 inline-block mt-0.5 shrink-0" />
                <span>{renderFormattedInline(line.slice(6))}</span>
              </div>
            );
          }
          if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2 text-[var(--text-muted)] line-through">
                <span className="w-3 h-3 rounded bg-emerald-500 text-white flex items-center justify-center text-[9px] mt-0.5 shrink-0">
                  ✓
                </span>
                <span>{renderFormattedInline(line.slice(6))}</span>
              </div>
            );
          }
          if (line.trim() === '') {
            return <div key={idx} className="h-1.5" />;
          }
          return <p key={idx}>{renderFormattedInline(line)}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="p-4 bg-[var(--bg-surface-l2)]/60 rounded-xl border border-[var(--border-subtle)] space-y-2 card-surface">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
          Notes & Description
        </label>
        <button
          type="button"
          onClick={() => setIsMarkdownPreview((prev) => !prev)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] transition-colors"
          title={isMarkdownPreview ? 'Switch to raw edit mode' : 'Switch to formatted markdown preview'}
        >
          {isMarkdownPreview ? (
            <>
              <Edit3 size={11} />
              <span>Edit Notes</span>
            </>
          ) : (
            <>
              <Eye size={11} />
              <span>Preview</span>
            </>
          )}
        </button>
      </div>

      {isMarkdownPreview ? (
        <div
          onClick={() => setIsMarkdownPreview(false)}
          className="w-full min-h-[100px] p-3.5 bg-[var(--bg-surface-l1)]/50 border border-[var(--border-hairline)] rounded-xl cursor-pointer hover:border-stone-400 dark:hover:border-stone-600 transition-colors card-surface"
          title="Click to edit notes"
        >
          {renderMarkdownNotes(task.description || '')}
        </div>
      ) : (
        <textarea
          id="task-notes-textarea"
          name="taskNotes"
          aria-label="Task notes and description"
          rows={5}
          value={task.description || ''}
          onChange={(e) => updateTask(task.id, { description: e.target.value })}
          placeholder="Add details, links, checklists (- [ ]), or code (`code`)..."
          className="w-full text-xs p-3.5 bg-[var(--bg-surface-l1)]/50 text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-xl outline-none focus:border-stone-400 dark:focus:border-stone-600 resize-none leading-relaxed card-surface font-mono"
        />
      )}
    </div>
  );
};
