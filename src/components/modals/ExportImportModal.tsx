import React, { useState, useMemo, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { exportToMarkdown, exportToJSON, exportToCSV } from '../../utils/storage';
import { generateDailyStandup } from '../../utils/standupGenerator';
import { generateSnapshotShareUrl } from '../../utils/snapshotShare';
import { validateWorkspaceData } from '../../utils/workspaceValidation';
import { audioEngine } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';
import {
  X,
  Download,
  Upload,
  Copy,
  Check,
  FileText,
  Database,
  MessageSquare,
  Share2,
  Sparkles,
  History,
  Trash2,
  ShieldCheck,
  Clock,
  Plus,
  Table,
} from 'lucide-react';
import {
  getStoredSnapshots,
  loadSnapshotsFromIDB,
  createLocalSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  type LocalSnapshot,
} from '../../utils/backupService';

interface ExportImportModalProps {
  onClose: () => void;
  initialTab?: 'standup' | 'markdown' | 'csv' | 'share' | 'json' | 'import' | 'snapshots';
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  onClose,
  initialTab = 'standup',
}) => {
  const { tasks, projects, importTasks, showToast } = useTaskContext();
  const [activeTab, setActiveTab] = useState<'standup' | 'markdown' | 'csv' | 'share' | 'json' | 'import' | 'snapshots'>(
    initialTab
  );
  const [localSnapshots, setLocalSnapshots] = useState<LocalSnapshot[]>(() => getStoredSnapshots());
  const [copied, setCopied] = useState(false);
  const [standupFormat, setStandupFormat] = useState<'slack' | 'markdown' | 'plain'>('slack');
  const [importJsonText, setImportJsonText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importError, setImportError] = useState('');

  useEffect(() => {
    void loadSnapshotsFromIDB().then((snaps) => {
      if (snaps && snaps.length > 0) {
        setLocalSnapshots(snaps);
      }
    });
  }, []);

  const validationPreview = useMemo(() => {
    if (!importJsonText.trim()) return null;
    try {
      const parsed = JSON.parse(importJsonText);
      const rawTasks = Array.isArray(parsed) ? parsed : (parsed.tasks || []);
      const rawProjects = Array.isArray(parsed) ? [] : (parsed.projects || []);
      if (!Array.isArray(rawTasks)) {
        return { valid: false as const, error: 'Backup JSON must contain a tasks array.' };
      }
      const validated = validateWorkspaceData(rawTasks, rawProjects);
      return {
        valid: true as const,
        tasksCount: validated.tasks.length,
        projectsCount: validated.projects.length,
        data: validated,
      };
    } catch (err: any) {
      return { valid: false as const, error: err.message || 'Invalid JSON format or schema.' };
    }
  }, [importJsonText]);

  const markdownContent = exportToMarkdown(tasks, projects);
  const csvContent = exportToCSV(tasks, projects);
  const jsonContent = exportToJSON(tasks, projects);
  const standupContent = generateDailyStandup(tasks, projects, { format: standupFormat });
  const shareUrl = generateSnapshotShareUrl(
    tasks.filter((t) => t.status !== 'done'),
    'FlowTask Active Sprint Snapshot'
  );

  const handleCopyText = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    audioEngine.playCompletionChime();
    confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    if (!validationPreview || !validationPreview.valid || !validationPreview.data) {
      setImportError('Please provide valid workspace backup JSON before restoring.');
      return;
    }

    try {
      const prevTasks = [...tasks];
      const prevProjects = [...projects];

      if (importMode === 'replace') {
        createLocalSnapshot(tasks, projects, 'Pre-Import Replace Safety Snapshot', 'pre_batch');
      }

      await importTasks(validationPreview.data.tasks, validationPreview.data.projects, importMode === 'replace');
      audioEngine.playCompletionChime();
      confetti({ particleCount: 40, spread: 50 });

      showToast(
        importMode === 'replace' ? 'Workspace replaced from backup' : `Imported ${validationPreview.data.tasks.length} tasks`,
        'Undo',
        () => {
          void importTasks(prevTasks, prevProjects, true).catch((err: Error) => showToast(err.message));
        }
      );
      onClose();
    } catch (err: any) {
      setImportError(err.message || 'Failed to import backup');
    }
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Backups and export"
      className="fixed inset-0 z-50 bg-black/40 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#12151D] rounded-xl p-6 border border-stone-200/80 dark:border-white/10 shadow-2xl dark:shadow-black/70 card-surface relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/5 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shadow-xs">
            <Sparkles size={20} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Workday Portability & Standup
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
              Copy daily standups, export backups, or share zero-auth task snapshots.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 p-1 bg-stone-100/80 dark:bg-white/[0.04] border border-stone-200/60 dark:border-white/5 rounded-xl mb-4 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('standup')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'standup'
                ? 'bg-white dark:bg-[#1A1F2B] text-stone-900 dark:text-stone-100 shadow-sm card-surface'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <MessageSquare size={13} /> Standup
          </button>
          <button
            onClick={() => setActiveTab('share')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'share'
                ? 'bg-white dark:bg-[#1A1F2B] text-stone-900 dark:text-stone-100 shadow-sm card-surface'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Share2 size={13} /> Share Link
          </button>
          <button
            onClick={() => setActiveTab('markdown')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'markdown'
                ? 'bg-white dark:bg-[#1A1F2B] text-stone-900 dark:text-stone-100 shadow-sm card-surface'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <FileText size={13} /> Markdown
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'csv'
                ? 'bg-white dark:bg-[#1A1F2B] text-stone-900 dark:text-stone-100 shadow-sm card-surface'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Table size={13} /> CSV
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'json'
                ? 'bg-white dark:bg-[#1A1F2B] text-stone-900 dark:text-stone-100 shadow-sm card-surface'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Database size={13} /> JSON
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'import'
                ? 'bg-white dark:bg-[#1A1F2B] text-stone-900 dark:text-stone-100 shadow-sm card-surface'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Upload size={13} /> Restore
          </button>
          <button
            onClick={() => {
              setLocalSnapshots(getStoredSnapshots());
              setActiveTab('snapshots');
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'snapshots'
                ? 'bg-white dark:bg-[#1A1F2B] text-stone-900 dark:text-stone-100 shadow-sm card-surface'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <History size={13} /> Revisions
          </button>
        </div>

        {/* 1. Daily Standup Tab */}
        {activeTab === 'standup' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                Format:
              </span>
              <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800/60 p-0.5 rounded-xl text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setStandupFormat('slack')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    standupFormat === 'slack'
                      ? 'bg-white dark:bg-[#1A1F2B] text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Slack / Discord
                </button>
                <button
                  type="button"
                  onClick={() => setStandupFormat('markdown')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    standupFormat === 'markdown'
                      ? 'bg-white dark:bg-[#1A1F2B] text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setStandupFormat('plain')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    standupFormat === 'plain'
                      ? 'bg-white dark:bg-[#1A1F2B] text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Plain Text
                </button>
              </div>
            </div>

            <textarea
              readOnly
              rows={8}
              value={standupContent}
              className="w-full text-xs p-3.5 bg-stone-50/70 dark:bg-[#0E1118] border border-stone-200/80 dark:border-white/10 rounded-lg outline-none font-mono text-stone-800 dark:text-stone-200 resize-none leading-relaxed focus:border-[var(--color-brand)]"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleCopyText(standupContent)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white rounded-lg text-xs font-bold shadow-xs transition-all"
              >
                {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Daily Standup'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Share Snapshot Link Tab */}
        {activeTab === 'share' && (
          <div className="space-y-3">
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              This self-contained link encodes your active tasks directly into a client-side URL fragment. Anyone opening the link can preview and import tasks with <strong>zero sign-up, zero server storage, and complete privacy</strong>.
            </p>

            <textarea
              readOnly
              rows={5}
              value={shareUrl}
              className="w-full text-[11px] p-3 bg-stone-50/70 dark:bg-[#0E1118] border border-stone-200/80 dark:border-white/10 rounded-lg outline-none font-mono text-stone-800 dark:text-stone-200 resize-none leading-relaxed select-all"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleCopyText(shareUrl)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg text-xs font-bold shadow-xs hover:opacity-95 transition-all"
              >
                {copied ? <Check size={14} className="text-emerald-200" /> : <Copy size={14} />}
                <span>{copied ? 'Link Copied!' : 'Copy Share Link'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Markdown Tab */}
        {activeTab === 'markdown' && (
          <div className="space-y-3">
            <textarea
              readOnly
              rows={8}
              value={markdownContent}
              className="w-full text-xs p-3.5 bg-stone-50/70 dark:bg-[#0E1118] border border-stone-200/80 dark:border-white/10 rounded-lg outline-none font-mono text-stone-800 dark:text-stone-200 resize-none leading-relaxed focus:border-[var(--color-brand)]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleCopyText(markdownContent)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-200/80 dark:border-white/10 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors card-surface"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
              </button>
              <button
                onClick={() => handleDownloadFile(markdownContent, 'FlowTask-Export.md', 'text/markdown')}
                className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 rounded-lg text-xs font-bold hover:bg-stone-800 dark:hover:bg-white shadow-xs transition-all"
              >
                <Download size={14} />
                <span>Download .md</span>
              </button>
            </div>
          </div>
        )}

        {/* 3b. CSV Spreadsheet Tab */}
        {activeTab === 'csv' && (
          <div className="space-y-3">
            <textarea
              readOnly
              rows={8}
              value={csvContent}
              className="w-full text-xs p-3.5 bg-stone-50/70 dark:bg-[#0E1118] border border-stone-200/80 dark:border-white/10 rounded-lg outline-none font-mono text-stone-800 dark:text-stone-200 resize-none leading-relaxed focus:border-[var(--color-brand)]"
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Compatible with Microsoft Excel, Apple Numbers, & Google Sheets.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyText(csvContent)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-200/80 dark:border-white/10 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors card-surface"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy CSV'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadFile(csvContent, 'FlowTask-Tasks.csv', 'text/csv;charset=utf-8;')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 rounded-lg text-xs font-bold hover:bg-stone-800 dark:hover:bg-white shadow-xs transition-all"
                >
                  <Download size={14} />
                  <span>Download .csv</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. JSON Backup Tab */}
        {activeTab === 'json' && (
          <div className="space-y-3">
            <textarea
              readOnly
              rows={8}
              value={jsonContent}
              className="w-full text-xs p-3.5 bg-stone-50/70 dark:bg-[#0E1118] border border-stone-200/80 dark:border-white/10 rounded-lg outline-none font-mono text-stone-800 dark:text-stone-200 resize-none leading-relaxed focus:border-[var(--color-brand)]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleCopyText(jsonContent)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-200/80 dark:border-white/10 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors card-surface"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
              </button>
              <button
                onClick={() => handleDownloadFile(jsonContent, 'flowtask-backup.json', 'application/json')}
                className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 rounded-lg text-xs font-bold hover:bg-stone-800 dark:hover:bg-white shadow-xs transition-all"
              >
                <Download size={14} />
                <span>Download JSON Backup</span>
              </button>
            </div>
          </div>
        )}

        {/* 5. Import Tab */}
        {activeTab === 'import' && (
          <form onSubmit={handleImportSubmit} className="space-y-3">
            <textarea
              id="import-backup-textarea"
              name="importBackup"
              aria-label="Paste JSON backup"
              rows={6}
              value={importJsonText}
              onChange={(e) => {
                setImportJsonText(e.target.value);
                setImportError('');
              }}
              placeholder="Paste your JSON backup data here..."
              className="w-full text-xs p-3.5 bg-stone-50/70 dark:bg-[#0E1118] border border-stone-200/80 dark:border-white/10 rounded-lg outline-none font-mono text-stone-800 dark:text-stone-200 resize-none leading-relaxed focus:border-[var(--color-brand)]"
            />

            {/* Validation Feedback & Preview */}
            {validationPreview && (
              validationPreview.valid ? (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold">
                      Validated: {validationPreview.tasksCount} task{validationPreview.tasksCount === 1 ? '' : 's'} and {validationPreview.projectsCount} project{validationPreview.projectsCount === 1 ? '' : 's'} ready
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-stone-50 dark:bg-white/[0.03] border border-stone-200/70 dark:border-white/5 space-y-2 text-xs">
                    <span className="font-bold text-stone-900 dark:text-stone-100 block">Restore Strategy:</span>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="merge"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="mt-0.5 accent-amber-600"
                      />
                      <div>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">Merge with existing tasks</span>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400">
                          Adds backup tasks alongside your current workspace without removing existing items.
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="mt-0.5 accent-amber-600"
                      />
                      <div>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          Replace workspace (pre-action safety snapshot created automatically)
                        </span>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400">
                          Replaces current tasks and projects. A safety rollback snapshot is automatically captured first.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <X size={14} className="shrink-0 mt-0.5" />
                  <span>{validationPreview.error}</span>
                </div>
              )
            )}

            {importError && (
              <p className="text-xs text-rose-500 font-semibold">{importError}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                disabled={!validationPreview || !validationPreview.valid}
                className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 rounded-lg text-xs font-bold hover:bg-stone-800 dark:hover:bg-white disabled:opacity-40 shadow-xs transition-all"
              >
                <Upload size={14} />
                <span>{importMode === 'replace' ? 'Replace Workspace' : 'Merge Data'}</span>
              </button>
            </div>
          </form>
        )}

        {/* 6. Local Snapshots & Revisions Tab */}
        {activeTab === 'snapshots' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                  Point-in-Time Rolling Snapshots
                </p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Automatic daily checkpoints & manual rollback points stored locally.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  createLocalSnapshot(tasks, projects, undefined, 'manual');
                  setLocalSnapshots(getStoredSnapshots());
                  audioEngine.playCompletionChime();
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white text-xs font-bold shadow-xs transition-all shrink-0"
              >
                <Plus size={13} />
                <span>Take Snapshot</span>
              </button>
            </div>

            <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
              {localSnapshots.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  No snapshots recorded yet. Automatic daily snapshots will appear here.
                </div>
              ) : (
                localSnapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-3 rounded-lg bg-stone-50 dark:bg-white/[0.03] border border-stone-200/70 dark:border-white/5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {snap.label}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                            snap.trigger === 'auto_daily'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : snap.trigger === 'pre_batch'
                              ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                              : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                          }`}
                        >
                          {snap.trigger === 'auto_daily'
                            ? 'Daily Auto'
                            : snap.trigger === 'pre_batch'
                            ? 'Pre-Action'
                            : 'Manual'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-stone-400 font-mono mt-0.5">
                        <Clock size={10} />
                        <span>{new Date(snap.timestamp).toLocaleString()}</span>
                        <span>•</span>
                        <span>{snap.taskCount} tasks</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          const prevTasks = [...tasks];
                          const prevProjects = [...projects];
                          createLocalSnapshot(tasks, projects, 'Pre-Restore Auto-Backup', 'pre_batch');
                          const restored = restoreSnapshot(snap.id);
                          if (restored) {
                            try { await importTasks(restored.tasks, restored.projects, true); } catch (error) { setImportError((error as Error).message); return; }
                            audioEngine.playCompletionChime();
                            confetti({ particleCount: 40, spread: 50 });
                            showToast(`Restored snapshot "${snap.label}"`, 'Undo', () => {
                              void importTasks(prevTasks, prevProjects, true).catch(error => showToast(error.message));
                            });
                            onClose();
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-stone-900 dark:bg-white text-white dark:text-stone-950 font-bold text-[11px] shadow-xs hover:opacity-90 transition-opacity flex items-center gap-1"
                      >
                        <ShieldCheck size={12} />
                        <span>Restore</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteSnapshot(snap.id);
                          setLocalSnapshots(getStoredSnapshots());
                        }}
                        title="Delete snapshot"
                        className="p-1 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
