import React, { useMemo } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { ExternalLink, Bookmark } from 'lucide-react';
import type { WidgetComponentProps } from '../../../types/dashboard';

interface ResourceItem {
  id: string;
  title: string;
  url: string;
  source: string;
}

export const ResourcesWidget: React.FC<WidgetComponentProps> = () => {
  const { tasks = [] } = useTaskContext();

  // Harvest URLs from subtasks and descriptions
  const resources: ResourceItem[] = useMemo(() => {
    const list: ResourceItem[] = [];
    const seen = new Set<string>();

    tasks.forEach((t) => {
      if (t.deletedAt || t.archivedAt) return;
      (t.subtasks || []).forEach((s) => {
        if (s.url && /^https?:\/\//i.test(s.url) && !seen.has(s.url)) {
          seen.add(s.url);
          list.push({
            id: s.id,
            title: s.title || s.url,
            url: s.url,
            source: t.title,
          });
        }
      });
    });

    return list.slice(0, 8);
  }, [tasks]);

  return (
    <div className="flex flex-col h-full">
      {resources.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-xs text-[var(--text-muted)]">
          <Bookmark size={22} className="mb-2 opacity-50" />
          No links or problem URLs found. Add a URL to any subtask to access it here!
        </div>
      ) : (
        <div className="space-y-1.5 flex-1 overflow-y-auto pr-0.5">
          {resources.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--bg-surface-l1)]/40 hover:bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] hover:border-[var(--border-color)] transition-all text-xs group"
            >
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--pastel-sage)] dark:group-hover:text-[var(--pastel-sage)] truncate block">
                  {item.title}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] truncate block">
                  From: {item.source}
                </span>
              </div>
              <ExternalLink size={13} className="text-[var(--text-muted)] group-hover:text-[var(--pastel-sage)] shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
