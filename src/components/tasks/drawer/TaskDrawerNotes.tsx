import React, { useState, useEffect, useRef, useContext } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { WorkspaceStoreContext } from '../../../services/workspaceStore';
import { noteFromTaskDescription } from '../../../services/notesService';
import { openNote } from '../../../hooks/useNotes';
import type { Task } from '../../../types/task';
import { Eye, Edit3, BookOpen, ExternalLink } from 'lucide-react';

interface TaskDrawerNotesProps {
  task: Task;
}

export const TaskDrawerNotes: React.FC<TaskDrawerNotesProps> = ({ task }) => {
  const { updateTask, showToast } = useTaskContext();
  const store = useContext(WorkspaceStoreContext);
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
  const [localNotes, setLocalNotes] = useState(task.description || '');
  const lastTaskIdRef = useRef(task.id);
  const lastCommittedRef = useRef(task.description || '');

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if task changes or external update happens
  useEffect(() => {
    if (lastTaskIdRef.current !== task.id) {
      lastTaskIdRef.current = task.id;
      lastCommittedRef.current = task.description || '';
      setLocalNotes(task.description || '');
    } else if (task.description !== lastCommittedRef.current) {
      lastCommittedRef.current = task.description || '';
      setLocalNotes(task.description || '');
    }
  }, [task.id, task.description]);

  // Flush pending changes on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalNotes(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      lastCommittedRef.current = val;
      updateTask(task.id, { description: val });
    }, 300);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (localNotes !== (task.description || '')) {
      lastCommittedRef.current = localNotes;
      updateTask(task.id, { description: localNotes });
    }
  };

  const handleTogglePreview = () => {
    if (!isMarkdownPreview && localNotes !== (task.description || '')) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      lastCommittedRef.current = localNotes;
      updateTask(task.id, { description: localNotes });
    }
    setIsMarkdownPreview((prev) => !prev);
  };

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
            className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l3)] dark:bg-white/[0.08] font-mono text-[11px] text-[var(--color-brand)] font-semibold"
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
                <span className="text-[var(--color-brand)] font-bold">•</span>
                <span>{renderFormattedInline(line.slice(2))}</span>
              </div>
            );
          }
          if (line.startsWith('- [ ] ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2 text-[var(--text-secondary)]">
                <span className="w-3 h-3 rounded border border-[var(--border-color)] dark:border-[var(--border-color)] inline-block mt-0.5 shrink-0" />
                <span>{renderFormattedInline(line.slice(6))}</span>
              </div>
            );
          }
          if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2 text-[var(--text-muted)] line-through">
                <span className="w-3 h-3 rounded bg-[var(--pastel-sage)] text-[var(--bg-main)] flex items-center justify-center text-[9px] mt-0.5 shrink-0">
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
          onClick={handleTogglePreview}
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
          className="w-full min-h-[100px] p-3.5 bg-[var(--bg-surface-l1)]/50 border border-[var(--border-hairline)] rounded-xl cursor-pointer hover:border-[var(--border-color)] dark:hover:border-[var(--border-color)] transition-colors card-surface"
          title="Click to edit notes"
        >
          {renderMarkdownNotes(localNotes)}
        </div>
      ) : (
        <textarea
          id="task-notes-textarea"
          name="taskNotes"
          aria-label="Task notes and description"
          rows={5}
          value={localNotes}
          onChange={handleNotesChange}
          onBlur={handleBlur}
          placeholder="Add details, links, checklists (- [ ]), or code (`code`)..."
          className="w-full text-xs p-3.5 bg-[var(--bg-surface-l1)]/50 text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-xl outline-none focus:border-[var(--border-color)] dark:focus:border-[var(--border-color)] resize-none leading-relaxed card-surface font-mono"
        />
      )}

      {task.originNoteId ? (
        <div className="flex items-center justify-between text-xs pt-1 px-1">
          <span className="text-[var(--text-secondary)] font-medium">Linked to source Note</span>
          <button
            type="button"
            onClick={() => openNote(task.originNoteId!)}
            className="flex items-center gap-1 text-[var(--color-brand)] hover:underline font-semibold"
          >
            <span>Open Note</span>
            <ExternalLink size={12} />
          </button>
        </div>
      ) : localNotes.trim().length > 0 && store ? (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => {
              try {
                const noteId = noteFromTaskDescription(store, task.id);
                showToast?.('Converted task description to linked Note.');
                openNote(noteId);
              } catch (e) {
                showToast?.((e as Error).message);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] hover:border-[var(--color-brand-border)] transition-colors"
          >
            <BookOpen size={12} />
            <span>Extract to Note</span>
          </button>
        </div>
      ) : null}
    </div>
  );
};

