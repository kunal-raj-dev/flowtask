import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Project } from '../../types/task';
import { Search, Check } from 'lucide-react';

interface MoveToProjectPickerProps {
  projects: Project[];
  currentProjectId?: string;
  onSelectProject: (projectId: string) => void;
  onClose: () => void;
  title?: string;
}

export const MoveToProjectPicker: React.FC<MoveToProjectPickerProps> = ({
  projects,
  currentProjectId,
  onSelectProject,
  onClose,
  title = 'Move to project',
}) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter(
      (p) => !p.isArchived && !p.archivedAt && (!q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    );
  }, [projects, search]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={title}
      data-overlay-open="true"
      className="w-full min-w-0 p-2 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] shadow-modal space-y-2 card-surface"
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && !event.nativeEvent.isComposing) {
          if (event.target === inputRef.current && ['Home', 'End'].includes(event.key)) return;
          const buttons = [...(containerRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
          event.preventDefault();
          event.stopPropagation();
          buttons[next]?.focus();
        } else if (event.key === 'Enter' && event.target === inputRef.current && filteredProjects.length === 1) {
          event.preventDefault();
          event.stopPropagation();
          if (filteredProjects[0].id !== currentProjectId) {
            onSelectProject(filteredProjects[0].id);
            onClose();
          }
        }
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-[var(--border-hairline)]">
        <Search size={13} className="text-[var(--text-muted)] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          aria-label="Search projects"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search project…"
          className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
        />
      </div>

      <div className="max-h-52 overflow-y-auto space-y-0.5" role="group" aria-label="Projects">
        {filteredProjects.length === 0 ? (
          <p className="text-[11px] text-[var(--text-muted)] text-center py-2">
            No projects found
          </p>
        ) : (
          filteredProjects.map((proj) => {
            const isCurrent = proj.id === currentProjectId;
            return (
              <button
                key={proj.id}
                type="button"
                disabled={isCurrent}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => {
                  onSelectProject(proj.id);
                  onClose();
                }}
                className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  isCurrent
                    ? 'bg-amber-500/15 text-[var(--text-primary)] font-semibold'
                    : 'hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: proj.color || '#64748B' }}
                  />
                  <span className="truncate">{proj.name}</span>
                </div>
                {isCurrent && (
                  <Check size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
