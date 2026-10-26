import { FocusInsights } from './FocusInsights';
import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useWorkspaceSelector } from '../../services/workspaceStore';
import { LogbookView } from './LogbookView';
import { InsightsView } from './InsightsView';
import { generateDailyStandup } from '../../utils/standupGenerator';
import { exportToCSV, exportToMarkdown, downloadFile } from '../../utils/fileExporter';
import { audioEngine } from '../../utils/audioEngine';
import { calculateEstimationBiasRatio } from '../../services/workBlockService';
import { useModal } from '../../context/ModalContext';
import { Sparkles, Calendar } from 'lucide-react';
import {
  Compass,
  CheckCircle2,
  TrendingUp,
  FileText,
  Download,
  Copy,
  Check,
  Sunset,
} from 'lucide-react';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Button } from '../ui/Button';

interface ReviewViewProps {
  initialTab?: 'logbook' | 'insights' | 'reviews' | 'standup' | 'export';
  onSelectTask: (taskId: string) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({ onSelectTask, initialTab = 'logbook' }) => {
  const {
    tasks,
    projects,
    setIsWeeklyReviewOpen,
    setIsEveningShutdownOpen,
    showToast,
    downloadWorkspaceBackup,
  } = useTaskContext();

  const workspaceReviews = useWorkspaceSelector((s) => s?.record?.reviews);
  const sortedReviews = React.useMemo(() => {
    if (!workspaceReviews) return [];
    return [...workspaceReviews].sort((a, b) => b.reviewedAt - a.reviewedAt);
  }, [workspaceReviews]);

  const { openModal } = useModal();
  const bias = React.useMemo(() => calculateEstimationBiasRatio(tasks), [tasks]);
  const [activeTab, setActiveTab] = useState<'logbook' | 'insights' | 'reviews' | 'standup' | 'export'>(initialTab);
  const [copiedStandup, setCopiedStandup] = useState(false);

  const handleCopyStandup = async () => {
    const md = generateDailyStandup(tasks, projects);
    try {
      await navigator.clipboard.writeText(md);
      setCopiedStandup(true);
      audioEngine.playTaskComplete();
      showToast('Standup digest copied to clipboard!');
      setTimeout(() => setCopiedStandup(false), 2500);
    } catch {
      showToast('Failed to copy to clipboard');
    }
  };

  const handleDownloadExport = (type: 'csv' | 'json' | 'markdown') => {
    let content = '';
    let filename = '';
    let mimeType = '';

    const timestamp = new Date().toISOString().split('T')[0];

    if (type === 'json') {
      downloadWorkspaceBackup();
      showToast('Downloaded full workspace JSON backup');
      return;
    }
    if (type === 'csv') {
      content = exportToCSV(tasks, projects);
      filename = `flowtask_report_${timestamp}.csv`;
      mimeType = 'text/csv;charset=utf-8;';
    } else {
      content = exportToMarkdown(tasks, projects);
      filename = `flowtask_report_${timestamp}.md`;
      mimeType = 'text/markdown;charset=utf-8;';
    }

    downloadFile(content, filename, mimeType);
    showToast(`Exported ${type.toUpperCase()} report`);
  };

  return (
    <div className="max-w-5xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8">
      {/* Review Hub Header */}
      <div className="workspace-page-header mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
            <Compass size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Review & Insights
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Review completed work, focused time, and the shape of your week
            </p>
          </div>
        </div>

        {/* Guided Ritual Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Sparkles size={14} className="text-amber-500" />}
            onClick={() => openModal('cleanSlate')}
          >
            Clean Slate
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Sunset size={14} className="text-amber-500" />}
            onClick={() => setIsEveningShutdownOpen(true)}
          >
            Evening Shutdown
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Compass size={14} className="text-teal-500" />}
            onClick={() => setIsWeeklyReviewOpen(true)}
          >
            Weekly Review
          </Button>
        </div>
      </div>

      {/* Estimation Bias Calibration Card */}
      {bias.completedCount >= 1 && (
        <div className="mb-6 p-4 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <TrendingUp size={16} />
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                Estimation Bias Ratio: {bias.ratio.toFixed(2)}x ({bias.completedCount} calibrated {bias.completedCount === 1 ? 'task' : 'tasks'})
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {bias.ratio > 1.15
                  ? `You typically take ${Math.round((bias.ratio - 1) * 100)}% longer than planned. Adding small buffer blocks will keep your schedule resilient.`
                  : bias.ratio < 0.85
                  ? 'You often finish faster than planned! Excellent momentum.'
                  : 'Your time estimates are accurately calibrated within 15% of actual duration.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="mb-6 overflow-x-auto no-scrollbar py-0.5">
        <SegmentedControl<'logbook' | 'insights' | 'reviews' | 'standup' | 'export'>
          items={[
            { id: 'logbook', label: 'Logbook', icon: <CheckCircle2 size={14} /> },
            { id: 'insights', label: 'Insights', icon: <TrendingUp size={14} /> },
            { id: 'reviews', label: 'Past Reviews', icon: <Compass size={14} /> },
            { id: 'standup', label: 'Daily Standup', icon: <FileText size={14} /> },
            { id: 'export', label: 'Export Reports', icon: <Download size={14} /> },
          ]}
          value={activeTab}
          onChange={(tab) => setActiveTab(tab)}
        />
      </div>

      {/* Tab Panels */}
      {activeTab === 'logbook' ? (
        <LogbookView onSelectTask={onSelectTask} />
      ) : activeTab === 'insights' ? (
        <><FocusInsights /><InsightsView onSelectTask={onSelectTask} /></>
      ) : activeTab === 'reviews' ? (
        <div className="p-6 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-subtle space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Saved Weekly Reflections ({sortedReviews.length})
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Durable record of your past weekly reflections, focus metrics, and priorities.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<Compass size={14} />}
              onClick={() => setIsWeeklyReviewOpen(true)}
            >
              Start New Review
            </Button>
          </div>

          {sortedReviews.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] space-y-2">
              <Compass size={32} className="mx-auto text-[var(--text-muted)]" />
              <p className="text-xs font-semibold text-[var(--text-primary)]">No past reviews logged yet.</p>
              <p className="text-[11px] text-[var(--text-secondary)]">Complete a weekly review to save your reflection and metrics here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedReviews.map((rev) => {
                const isDaily = rev.type === 'daily_shutdown';
                const compCount = rev.completedTasksCount ?? rev.completedTaskIds?.length ?? 0;
                const focusSec = rev.focusSecondsRecorded ?? rev.totalFocusSeconds ?? 0;
                const noteText = rev.notes || rev.reflection;

                return (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/60 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs border-b border-[var(--border-hairline)]/50 pb-2">
                      <span className="font-bold flex items-center gap-1.5">
                        {isDaily ? <Sunset size={14} className="text-amber-500" /> : <Calendar size={13} className="text-[var(--color-brand)]" />}
                        <span>{isDaily ? 'Daily Shutdown' : 'Weekly Review'}{rev.periodStart ? ` · ${rev.periodStart}` : ''}{rev.periodEnd && rev.periodEnd !== rev.periodStart ? ` – ${rev.periodEnd}` : ''}</span>
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        Reviewed on {new Date(rev.reviewedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)]">
                        <span className="text-[10px] text-[var(--text-muted)] block">Completed Tasks</span>
                        <span className="font-bold">{compCount}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)]">
                        <span className="text-[10px] text-[var(--text-muted)] block">Measured Focus</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">{(focusSec / 3600).toFixed(1)} hrs</span>
                      </div>
                      {rev.interruptedSessionsCount ? (
                        <div className="p-2 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)]">
                          <span className="text-[10px] text-[var(--text-muted)] block">In-Progress Work</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{rev.interruptedSessionsCount} sessions ({Math.round((rev.interruptedSecondsRecorded || 0) / 60)}m)</span>
                        </div>
                      ) : null}
                      {rev.totalEstimatedMinutes !== undefined && !isDaily ? (
                        <div className="p-2 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)]">
                          <span className="text-[10px] text-[var(--text-muted)] block">Estimated Effort</span>
                          <span className="font-bold">{(rev.totalEstimatedMinutes / 60).toFixed(1)} hrs</span>
                        </div>
                      ) : null}
                    </div>

                    {noteText && (
                      <div className="text-xs">
                        <span className="font-semibold text-[11px] text-[var(--text-secondary)] block mb-0.5">Reflection</span>
                        <p className="p-2 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] italic">
                          "{noteText}"
                        </p>
                      </div>
                    )}

                    {rev.nextPriorities && rev.nextPriorities.length > 0 && (
                      <div className="text-xs">
                        <span className="font-semibold text-[11px] text-[var(--text-secondary)] block mb-1">Weekly Anchors</span>
                        <ul className="space-y-1">
                          {rev.nextPriorities.map((pri, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-[11px] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] flex-shrink-0" />
                              <span>{pri}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'standup' ? (
        <div className="p-6 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Daily Standup Digest
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Automated standup report formatted for Slack, Discord, and asynchronous updates.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={copiedStandup ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopyStandup}
            >
              {copiedStandup ? 'Copied!' : 'Copy Markdown'}
            </Button>
          </div>

          <pre className="p-4 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] font-mono whitespace-pre-wrap overflow-x-auto">
            {generateDailyStandup(tasks, projects)}
          </pre>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-subtle">
          <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">
            Download your reports
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mb-6">
            Keep a backup or take your task and time reports with you.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/50 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">CSV Spreadsheet Report</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Open your task report in Excel or Google Sheets.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={() => handleDownloadExport('csv')}
              >
                Download CSV Report
              </Button>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/50 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">JSON Backup</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Complete versioned workspace snapshot with all tasks, subtasks, projects, and metadata.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={() => handleDownloadExport('json')}
              >
                Download JSON Backup
              </Button>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/50 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">Markdown Report</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Formatted task outline organized by project for documentation or knowledge bases.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={() => handleDownloadExport('markdown')}
              >
                Download Markdown Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
