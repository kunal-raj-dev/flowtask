import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { LogbookView } from './LogbookView';
import { InsightsView } from './InsightsView';
import { generateDailyStandup } from '../../utils/standupGenerator';
import { exportToCSV, exportToJSON, exportToMarkdown } from '../../utils/storage';
import { audioEngine } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';
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
  onSelectTask: (taskId: string) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({ onSelectTask }) => {
  const {
    tasks,
    projects,
    setIsWeeklyReviewOpen,
    setIsEveningShutdownOpen,
    showToast,
  } = useTaskContext();

  const [activeTab, setActiveTab] = useState<'logbook' | 'insights' | 'standup' | 'export'>('logbook');
  const [copiedStandup, setCopiedStandup] = useState(false);

  const handleCopyStandup = async () => {
    const md = generateDailyStandup(tasks, projects);
    try {
      await navigator.clipboard.writeText(md);
      setCopiedStandup(true);
      audioEngine.playTaskComplete();
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.5 } });
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

    if (type === 'csv') {
      content = exportToCSV(tasks, projects);
      filename = `flowtask_export_${timestamp}.csv`;
      mimeType = 'text/csv;charset=utf-8;';
    } else if (type === 'json') {
      content = exportToJSON(tasks, projects, 2);
      filename = `flowtask_export_${timestamp}.json`;
      mimeType = 'application/json;charset=utf-8;';
    } else {
      content = exportToMarkdown(tasks, projects);
      filename = `flowtask_export_${timestamp}.md`;
      mimeType = 'text/markdown;charset=utf-8;';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${type.toUpperCase()} file`);
  };

  return (
    <div className="max-w-5xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8">
      {/* Review Hub Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
            <Compass size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Review & Insights
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Reflect on completed work, analyze focus velocity, and export reports
            </p>
          </div>
        </div>

        {/* Guided Ritual Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
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

      {/* Tabs Switcher */}
      <div className="mb-6">
        <SegmentedControl<'logbook' | 'insights' | 'standup' | 'export'>
          items={[
            { id: 'logbook', label: 'Logbook', icon: <CheckCircle2 size={14} /> },
            { id: 'insights', label: 'Insights & Velocity', icon: <TrendingUp size={14} /> },
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
        <InsightsView onSelectTask={onSelectTask} />
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
            Worklog & Workspace Exporters
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mb-6">
            Export your workspace records to standard portable formats. Protected against spreadsheet formula injection.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/50 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">CSV Spreadsheet</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  RFC-4180 compliant with formula injection protection. Ideal for Excel and Google Sheets.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={() => handleDownloadExport('csv')}
              >
                Download CSV
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
                Download JSON (v2)
              </Button>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/50 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">Markdown Document</h3>
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
                Download Markdown
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
