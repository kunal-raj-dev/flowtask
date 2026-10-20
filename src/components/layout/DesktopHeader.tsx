import React from 'react';
import { Menu, Search, Plus, Timer, Settings, Cloud, Sparkles } from 'lucide-react';
import { Button, Kbd } from '../ui';
import { FocusMiniPlayer } from '../focus/FocusMiniPlayer';
import { audioEngine } from '../../utils/audioEngine';

export interface DesktopHeaderProps {
  viewTitle: string;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenFocus: () => void;
  onOpenAuth: () => void;
  onQuickAdd: () => void;
  onOpenCommandPalette: () => void;
  onOpenCopilot?: () => void;
  onOpenSettings: () => void;
  syncStatus: string;
  user: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  isAnonymous: boolean;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  viewTitle,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenFocus,
  onOpenAuth,
  onQuickAdd,
  onOpenCommandPalette,
  onOpenCopilot,
  onOpenSettings,
  syncStatus,
  user,
  isAnonymous,
}) => {
  return (
    <header
      className="hidden lg:flex items-center justify-between px-6 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/75 backdrop-blur-xl sticky top-0 z-20 transition-all shrink-0"
      style={{ borderBottomColor: `color-mix(in srgb, var(--color-brand) 12%, var(--border-hairline))` }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Zen Sidebar Collapse/Expand Toggle */}
        <button
          type="button"
          onClick={() => {
            audioEngine.playToggleSound(isSidebarCollapsed);
            onToggleSidebar();
          }}
          title="Toggle Sidebar ([)"
          aria-label="Toggle Sidebar ([)"
          aria-expanded={!isSidebarCollapsed}
          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
        >
          <Menu size={17} strokeWidth={1.75} />
        </button>

        {/* Breadcrumb Title */}
        <div className="flex items-center gap-2 truncate">
          <span className="text-xs font-semibold text-[var(--text-muted)] tracking-wider uppercase shrink-0">
            FlowTask
          </span>
          <span className="text-xs text-[var(--text-muted)] shrink-0">/</span>
          <span className="font-bold text-sm tracking-tight text-[var(--text-primary)] truncate">
            {viewTitle}
          </span>
        </div>
      </div>

      {/* Center: Persistent Focus Session Mini-Player or Quick Launcher */}
      <div className="flex items-center gap-3">
        <FocusMiniPlayer variant="desktop" />
        <button
          type="button"
          onClick={onOpenFocus}
          title="Launch Focus Mode & Pomodoro Timer"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:text-amber-600 dark:hover:text-amber-400 bg-[var(--bg-surface-l2)] hover:bg-amber-500/10 border border-[var(--border-hairline)] hover:border-amber-500/30 transition-all shadow-2xs active:scale-95"
        >
          <Timer size={13} strokeWidth={1.75} className="text-amber-500" />
          <span>Focus</span>
        </button>
      </div>

      {/* Right: Quick Tools */}
      <div className="flex items-center gap-1.5">
        {/* Authoritative User Account & Cloud Sync Capsule */}
        <button
          type="button"
          onClick={onOpenAuth}
          title={
            user && !isAnonymous
              ? `Signed in as ${user.displayName || user.email} (${syncStatus === 'synced' ? 'Cloud Synced' : syncStatus}). Click for account & sync.`
              : `Local Mode (${syncStatus}). Click to sign in and enable cloud sync.`
          }
          aria-label={
            user && !isAnonymous
              ? `User Account: ${user.displayName || user.email}, Cloud status: ${syncStatus}`
              : 'Saved on this device. Account and backup options'
          }
          className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-hairline)] hover:border-amber-500/30 transition-all shadow-2xs cursor-pointer group active:scale-95"
        >
          {user && !isAnonymous ? (
            <div className="relative shrink-0 flex items-center justify-center">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-5 h-5 rounded-full object-cover ring-1 ring-[var(--border-hairline)]"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
                  {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1.5 ring-[var(--bg-surface-l1)] ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500 ring-emerald-500/20'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-500 animate-spin'
                    : syncStatus === 'offline'
                    ? 'bg-amber-500'
                    : 'bg-stone-400'
                }`}
              />
            </div>
          ) : (
            <div className="relative shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-stone-200/80 dark:bg-stone-800 text-[var(--text-secondary)]">
              <Cloud size={11} strokeWidth={2} />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-[var(--bg-surface-l1)] ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-500 animate-spin'
                    : syncStatus === 'offline'
                    ? 'bg-amber-500'
                    : 'bg-stone-400'
                }`}
              />
            </div>
          )}

          <span className="text-[11px] font-medium truncate max-w-[110px] xl:max-w-[150px]">
            {user && !isAnonymous ? user.displayName || user.email?.split('@')[0] : 'Saved on device'}
          </span>

          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1 ${
              syncStatus === 'synced'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : syncStatus === 'syncing'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : syncStatus === 'offline'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : 'bg-stone-500/10 text-[var(--text-secondary)] border-stone-500/20'
            }`}
          >
            {syncStatus === 'synced'
              ? 'Cloud'
              : syncStatus === 'syncing'
              ? 'Syncing'
              : syncStatus === 'offline'
              ? 'Offline'
              : 'Local'}
          </span>
        </button>

        {/* New Task Summoner */}
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={13} strokeWidth={1.75} />}
          onClick={onQuickAdd}
          title="Quick Add Task"
          aria-label="New Task"
        >
          New Task
        </Button>

        {/* Command Palette / Search Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          title="Search and commands (Ctrl+K or ⌘K)"
          aria-label="Search and commands"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-subtle cursor-pointer group active:scale-95"
        >
          <Search size={14} strokeWidth={1.75} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
          <span className="hidden xl:inline text-xs text-[var(--text-muted)] font-medium">Search & jump to...</span>
          <Kbd size="xs" className="hidden lg:inline-flex opacity-85">⌘K</Kbd>
        </button>

        {/* Copilot Natural Language Omnibar Trigger */}
        {onOpenCopilot && (
          <button
            type="button"
            onClick={onOpenCopilot}
            title="FlowTask Copilot (Ctrl+J or ⌘J)"
            aria-label="Open Copilot Omnibar"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/25 transition-all shadow-subtle cursor-pointer group active:scale-95"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span className="hidden xl:inline text-xs font-semibold">Copilot</span>
            <Kbd size="xs" className="hidden lg:inline-flex opacity-85">⌘J</Kbd>
          </button>
        )}

        {/* Application Settings & Preferences */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Preferences & Settings (Ctrl+,)"
          aria-label="Preferences and Settings"
          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
        >
          <Settings size={16} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
};
