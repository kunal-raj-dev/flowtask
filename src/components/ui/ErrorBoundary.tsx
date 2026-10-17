import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, DownloadCloud } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { getDatabase } from '../../services/dbService';
import { createWorkspaceBackup } from '../../utils/workspaceBackup';
import { downloadJson } from '../../utils/fileExporter';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  recoveryIds: string[];
  recoveryId: string;
  recoveryError: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    recoveryIds: [], recoveryId: 'local', recoveryError: '',
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FlowTask ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
    void getDatabase().then(db => db.getAllKeys('workspaces')).then(keys => {
      const recoveryIds = keys.map(String);
      this.setState({ recoveryIds, recoveryId: recoveryIds.includes('local') ? 'local' : recoveryIds[0] || 'local' });
    }).catch(() => this.setState({ recoveryError: 'Device storage could not be read. Try reopening the app before exporting.' }));
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHardReset = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
    } catch (e) {
      console.warn('Cache clearing error:', e);
    }
    window.location.reload();
  };

  private handleExportEmergencyBackup = async () => {
    try {
      const db = await getDatabase();
      const record = await db.get('workspaces', this.state.recoveryId);
      if (!record) throw new Error('No saved workspace was found on this device.');
      downloadJson(createWorkspaceBackup(record), `flowtask-recovery-${this.state.recoveryId}.json`);
      this.setState({ recoveryError: '' });
    } catch (err) {
      this.setState({ recoveryError: 'Could not export the saved workspace: ' + String(err) });
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full bg-[#FAF9F6] dark:bg-[#090B0F] text-[#1C1917] dark:text-[#F5F5F4] flex flex-col items-center justify-center p-6 selection:bg-amber-500/20 font-sans">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#12151C] border border-stone-200 dark:border-stone-800 shadow-xl flex flex-col items-center text-center space-y-5">
            {/* Brand Emblem */}
            <BrandLogo size={40} showWordmark={true} />

            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mt-2">
              <AlertTriangle size={24} strokeWidth={2} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold tracking-tight">Something unexpected happened</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-sm">
                FlowTask could not display this screen. Reload, or download the last workspace saved on this device.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full text-left p-3 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-[11px] font-mono text-stone-600 dark:text-stone-300 max-h-24 overflow-y-auto break-all">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="w-full space-y-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleHardReset}
                className="w-full py-2 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800/80 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Trash2 size={13} />
                <span>Clear Cache & Clean Reload</span>
              </button>

              {this.state.recoveryIds.length > 1 && <label className="block text-xs text-left">Workspace to recover<select className="block w-full p-2 mt-1 rounded border" value={this.state.recoveryId} onChange={event => this.setState({ recoveryId: event.target.value })}>{this.state.recoveryIds.map(id => <option key={id} value={id}>{id === 'local' ? 'Guest workspace' : `Account ${id}`}</option>)}</select></label>}
              {this.state.recoveryError && <p role="alert" className="text-xs">{this.state.recoveryError}</p>}
              <button
                type="button"
                onClick={this.handleExportEmergencyBackup}
                className="w-full py-1.5 px-4 rounded-xl text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <DownloadCloud size={12} />
                <span>Download Emergency Backup (JSON)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
