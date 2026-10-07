import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, DownloadCloud } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FlowTask ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
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

  private handleExportEmergencyBackup = () => {
    try {
      const data: Record<string, unknown> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('flowtask_')) {
          try {
            data[key] = JSON.parse(localStorage.getItem(key) || 'null');
          } catch {
            data[key] = localStorage.getItem(key);
          }
        }
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowtask-emergency-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not export emergency backup: ' + String(err));
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
                FlowTask ran into a rendering issue. Your data is safely stored in your local storage.
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
