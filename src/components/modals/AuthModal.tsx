import React from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
  LogOut,
  Sparkles,
  ShieldCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTaskContext } from '../../context/TaskContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, isAnonymous, isConfigured, signInWithGoogle, signOutUser, loading, authError, clearAuthError } = useAuth();
  const { syncStatus, lastSyncedAt, forceSyncToCloud, tasks, projects, importLocalWorkspace, showToast, downloadWorkspaceBackup } = useTaskContext();

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Account and sync" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-modal overflow-hidden z-10 transition-all card-surface animate-slide-down">
        {/* Header */}
        <div className="relative p-6 pb-5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shadow-xs">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Cloud Synchronization
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Real-time multi-device database & offline backup
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {user && <div className="p-4 border rounded-lg text-sm space-y-3"><p>Your device workspace is kept separately. Importing adds tasks whose IDs are not already in this account.</p><button className="underline" onClick={() => void importLocalWorkspace().catch(error => showToast(error.message))}>Import device workspace into this account</button><button className="underline block" onClick={downloadWorkspaceBackup}>Download account backup</button></div>}
          {/* Auth Error Banner */}
          {authError && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Authentication Notice</p>
                <p className="mt-0.5 leading-relaxed">{authError}</p>
              </div>
              <button
                onClick={clearAuthError}
                className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Real-time Status Card */}
          <div className="p-4 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Sync Status
              </span>
              <div className="flex items-center gap-2">
                {syncStatus === 'synced' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Cloud Synced
                  </span>
                )}
                {syncStatus === 'syncing' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Syncing Changes...
                  </span>
                )}
                {syncStatus === 'offline' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    <CloudOff className="w-3 h-3" />
                    Offline (Queued)
                  </span>
                )}
                {syncStatus === 'local' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-500/15 text-stone-700 dark:text-stone-400 border border-stone-500/30">
                    Local Storage
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div className="p-3 rounded-md bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] card-surface">
                <span className="text-[var(--text-muted)] block text-[11px]">Active Tasks</span>
                <span className="text-base font-bold text-[var(--text-primary)] mt-0.5 block font-mono">
                  {tasks.length} tasks
                </span>
              </div>
              <div className="p-3 rounded-md bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] card-surface">
                <span className="text-[var(--text-muted)] block text-[11px]">Projects</span>
                <span className="text-base font-bold text-[var(--text-primary)] mt-0.5 block font-mono">
                  {projects.length} projects
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-1">
              <span>
                {lastSyncedAt
                  ? `Last verified: ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : 'Automatic IndexedDB caching active'}
              </span>
              <button
                onClick={() => forceSyncToCloud()}
                className="font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Sync Now
              </button>
            </div>
          </div>

          {/* Account Profile / Sign In Section */}
          <div className="p-4 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] space-y-4">
            {user && !isAnonymous ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-10 h-10 rounded-full border border-amber-500/30 object-cover shadow-xs"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                        {user.displayName?.[0] || user.email?.[0] || 'U'}
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                        {user.displayName || 'Signed In User'}
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)]">{user.email}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    <ShieldCheck className="w-3 h-3" />
                    Verified
                  </span>
                </div>

                <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Your tasks and custom projects are tied to this Google account. Sign in with this account on any browser or phone to access your synced flow.
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-[var(--border-hairline)]">
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                    UID: {user.uid.slice(0, 10)}...
                  </span>
                  <button
                    onClick={() => signOutUser()}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">
                      Guest Session (Anonymous Mode)
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                      You are using FlowTask without signing in. Your data is protected locally and synced to your private anonymous cloud partition.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>
                    Link your Google account to sync seamlessly across phones, laptops, and prevent data loss if browser cookies are cleared.
                  </span>
                </div>

                {isConfigured ? (
                  <button
                    onClick={() => signInWithGoogle()}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg font-medium text-xs text-stone-800 dark:text-white bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 shadow-xs hover:bg-stone-50 dark:hover:bg-stone-750 transition-all cursor-pointer card-surface active:scale-[0.99]"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-3 rounded-lg bg-[var(--bg-surface-l2)] text-xs text-[var(--text-muted)] text-center border border-[var(--border-hairline)]">
                    Firebase configuration detected in offline demo mode.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Privacy & Architecture Note */}
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              IndexedDB Multi-Tab Sync
            </span>
            <span className="flex items-center gap-1">
              Google Cloud Firestore <ExternalLink className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[var(--bg-surface-l1)] border-t border-[var(--border-hairline)] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.08] transition-colors shadow-xs card-surface cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
