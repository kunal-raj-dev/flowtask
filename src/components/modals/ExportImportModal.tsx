import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { exportToMarkdown, exportToJSON } from '../../utils/storage';
import { X, Download, Upload, Copy, Check, FileText, Database } from 'lucide-react';

interface ExportImportModalProps {
  onClose: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({ onClose }) => {
  const { tasks, projects, importTasks } = useTaskContext();
  const [activeTab, setActiveTab] = useState<'markdown' | 'json' | 'import'>('markdown');
  const [copied, setCopied] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState('');

  const markdownContent = exportToMarkdown(tasks, projects);
  const jsonContent = exportToJSON(tasks, projects);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
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

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    try {
      const parsed = JSON.parse(importJsonText);
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        throw new Error('Invalid JSON format: missing "tasks" array');
      }
      importTasks(parsed.tasks, parsed.projects);
      onClose();
    } catch (err: any) {
      setImportError(err.message || 'Invalid JSON');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#12151D] rounded-3xl p-6 border border-stone-200/80 dark:border-white/10 shadow-2xl dark:shadow-black/70 card-surface relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-white/5 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/30 dark:to-teal-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <Database size={20} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Data Portability & Backups
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
              Export to Markdown or backup/restore as JSON. 100% private & local.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1.5 p-1 bg-stone-100/80 dark:bg-white/[0.04] border border-stone-200/60 dark:border-white/5 rounded-2xl mb-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('markdown')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'markdown'
                ? 'bg-white dark:bg-[#1A1F2B] text-stone-900 dark:text-stone-100 shadow-sm card-surface'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <FileText size={14} /> Markdown Export
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'json'
                ? 'bg-white dark:bg-[#1A1F2B] text-stone-900 dark:text-stone-100 shadow-sm card-surface'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Database size={14} /> JSON Backup
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'import'
                ? 'bg-white dark:bg-[#1A1F2B] text-stone-900 dark:text-stone-100 shadow-sm card-surface'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Upload size={14} /> Import Data
          </button>
        </div>

        {/* Markdown Tab */}
        {activeTab === 'markdown' && (
          <div className="space-y-3">
            <textarea
              readOnly
              rows={8}
              value={markdownContent}
              className="w-full text-xs p-3.5 bg-stone-50/70 dark:bg-[#0E1118] border border-stone-200/80 dark:border-white/10 rounded-2xl outline-none font-mono text-stone-800 dark:text-stone-200 resize-none leading-relaxed focus:border-indigo-500/50"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleCopyMarkdown}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200/80 dark:border-white/10 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors card-surface"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
              </button>
              <button
                onClick={() => handleDownloadFile(markdownContent, 'FlowTask-Export.md', 'text/markdown')}
                className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 rounded-xl text-xs font-bold hover:bg-stone-800 dark:hover:bg-white shadow-sm transition-all"
              >
                <Download size={14} />
                <span>Download .md</span>
              </button>
            </div>
          </div>
        )}

        {/* JSON Backup Tab */}
        {activeTab === 'json' && (
          <div className="space-y-3">
            <textarea
              readOnly
              rows={8}
              value={jsonContent}
              className="w-full text-xs p-3.5 bg-stone-50/70 dark:bg-[#0E1118] border border-stone-200/80 dark:border-white/10 rounded-2xl outline-none font-mono text-stone-800 dark:text-stone-200 resize-none leading-relaxed focus:border-indigo-500/50"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleDownloadFile(jsonContent, 'flowtask-backup.json', 'application/json')}
                className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 rounded-xl text-xs font-bold hover:bg-stone-800 dark:hover:bg-white shadow-sm transition-all"
              >
                <Download size={14} />
                <span>Download JSON Backup</span>
              </button>
            </div>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <form onSubmit={handleImportSubmit} className="space-y-3">
            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste your JSON backup data here..."
              className="w-full text-xs p-3.5 bg-stone-50/70 dark:bg-[#0E1118] border border-stone-200/80 dark:border-white/10 rounded-2xl outline-none font-mono text-stone-800 dark:text-stone-200 resize-none leading-relaxed focus:border-indigo-500/50"
            />
            {importError && (
              <p className="text-xs text-rose-500 font-semibold">{importError}</p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                disabled={!importJsonText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 rounded-xl text-xs font-bold hover:bg-stone-800 dark:hover:bg-white disabled:opacity-40 shadow-sm transition-all"
              >
                <Upload size={14} />
                <span>Restore Data</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
