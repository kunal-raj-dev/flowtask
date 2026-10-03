import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { TaskCard } from '../tasks/TaskCard';
import { VirtualTaskList } from '../tasks/VirtualTaskList';
import {
  CheckCircle2,
  Copy,
  Check,
  Search,
  Download,
  Filter,
  FileText,
} from 'lucide-react';
import { formatLocalDate } from '../../utils/nlpParser';
import { generateWorklogMarkdown } from '../../utils/worklogExporter';
import { audioEngine } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';

interface LogbookViewProps {
  onSelectTask: (taskId: string) => void;
}

export const LogbookView: React.FC<LogbookViewProps> = ({ onSelectTask }) => {
  const { tasks, projects } = useTaskContext();
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeHorizon, setTimeHorizon] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const todayStr = formatLocalDate(new Date());
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const sevenDaysAgoMs = nowMs - 7 * dayMs;
  const thirtyDaysAgoMs = nowMs - 30 * dayMs;

  // Filter completed tasks
  const allCompletedTasks = tasks
    .filter((t) => !t.deletedAt && !t.archivedAt && t.status === 'done')
    .sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt));

  const filteredTasks = allCompletedTasks.filter((t) => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchTags = t.tags?.some((tag) => tag.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchTags) return false;
    }

    // 2. Project
    if (selectedProjectId !== 'all' && t.projectId !== selectedProjectId) {
      return false;
    }

    // 3. Time Horizon
    const completedTime = t.completedAt || t.createdAt;
    if (timeHorizon === 'today') {
      const compDateStr = formatLocalDate(new Date(completedTime));
      if (compDateStr !== todayStr) return false;
    } else if (timeHorizon === 'week') {
      if (completedTime < sevenDaysAgoMs) return false;
    } else if (timeHorizon === 'month') {
      if (completedTime < thirtyDaysAgoMs) return false;
    }

    return true;
  });

  const totalFilteredMinutes = filteredTasks.reduce(
    (acc, t) => acc + (t.timeSpentMinutes || 0),
    0
  );
  const totalFilteredHours = (totalFilteredMinutes / 60).toFixed(1);

  // Group filtered tasks by relative periods
  const todayTasks = filteredTasks.filter(
    (t) => formatLocalDate(new Date(t.completedAt || t.createdAt)) === todayStr
  );
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterdayDate);

  const yesterdayTasks = filteredTasks.filter(
    (t) => formatLocalDate(new Date(t.completedAt || t.createdAt)) === yesterdayStr
  );
  const earlierTasks = filteredTasks.filter((t) => {
    const dStr = formatLocalDate(new Date(t.completedAt || t.createdAt));
    return dStr !== todayStr && dStr !== yesterdayStr;
  });

  const handleCopyWorklog = () => {
    const text = generateWorklogMarkdown(filteredTasks, projects, { timeHorizon });
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    audioEngine.playCompletionChime();
    confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleDownloadWorklog = () => {
    const text = generateWorklogMarkdown(filteredTasks, projects, { timeHorizon });
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `flowtask-worklog-${todayStr}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    audioEngine.playCompletionChime();
  };

  const renderSection = (title: string, sectionTasks: typeof filteredTasks) => {
    if (sectionTasks.length === 0) return null;
    return (
      <div className="mb-7">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          {title} ({sectionTasks.length})
        </h3>
        <VirtualTaskList
          tasks={sectionTasks}
          className="space-y-2.5"
          renderTask={(task) => (
            <TaskCard key={task.id} task={task} onSelectTask={onSelectTask} />
          )}
        />
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 p-5 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs flex-shrink-0">
            <CheckCircle2 size={24} className="stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Logbook & Accomplishments
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              {allCompletedTasks.length} lifetime completions • {filteredTasks.length} shown ({totalFilteredHours}h logged)
            </p>
          </div>
        </div>

        {allCompletedTasks.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyWorklog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-l1)] text-xs font-semibold text-[var(--text-primary)] shadow-xs transition-all card-surface active:scale-95"
              title="Copy formatted Markdown report to clipboard"
            >
              {copiedSummary ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-stone-400" />}
              <span>{copiedSummary ? 'Copied!' : 'Copy Report'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadWorklog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-l1)] text-xs font-semibold text-[var(--text-primary)] shadow-xs transition-all card-surface active:scale-95"
              title="Download worklog as .md file"
            >
              <Download size={14} className="text-stone-400" />
              <span className="hidden sm:inline">Export .md</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="mb-6 p-3.5 bg-[var(--bg-surface-l2)] rounded-xl border border-[var(--border-hairline)] shadow-sm card-surface space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              id="logbook-search-input"
              name="logbookSearch"
              aria-label="Search accomplishments"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search completed accomplishments, notes, or tags..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] rounded-lg outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--color-brand)] transition-colors"
            />
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter size={14} className="text-[var(--text-muted)] hidden sm:inline" />
            <select
              id="logbook-project-select"
              name="logbookProject"
              aria-label="Filter by project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] rounded-lg outline-none text-[var(--text-primary)] font-medium cursor-pointer focus:border-[var(--color-brand)]"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Time Horizon Pills */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto pt-1 border-t border-[var(--border-hairline)]">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mr-1">
            Horizon:
          </span>
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
          ].map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setTimeHorizon(h.id as any)}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                timeHorizon === h.id
                  ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.04]'
              }`}
            >
              {h.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] font-mono text-[var(--text-muted)]">
            {filteredTasks.length} matches
          </span>
        </div>
      </div>

      {/* Task Sections */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-surface-l2)] rounded-xl border border-[var(--border-hairline)] card-surface">
          <FileText size={36} className="mx-auto mb-2 text-stone-400 opacity-60" />
          {allCompletedTasks.length === 0 ? (
            <>
              <p className="text-sm font-bold text-[var(--text-primary)]">No completed tasks yet</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Tasks you mark as done will appear here automatically.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-[var(--text-primary)]">No completed tasks match your filter</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Try adjusting your search query, project, or time horizon.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {renderSection('Completed Today', todayTasks)}
          {renderSection('Completed Yesterday', yesterdayTasks)}
          {renderSection('Completed Earlier', earlierTasks)}
        </>
      )}
    </div>
  );
};
