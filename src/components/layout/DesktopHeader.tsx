import { shortcutHintsEnabled, MOD_KEY } from '../../services/shortcutRegistry';
import { useTaskStore } from '../../store/useTaskStore';
import React from 'react';
import { Menu, Search, Plus, Timer, Cloud, Sparkles, Volume2, VolumeX, Compass, MoreHorizontal, Settings } from 'lucide-react';
import { audioEngine } from '../../utils/audioEngine';
import { useModalStore } from '../../store/useModalStore';
import { FocusMiniPlayer } from '../focus/FocusMiniPlayer';
import { useFocusStore } from '../../store/useFocusStore';
import { useWorkspaceSelector } from '../../services/workspaceStore';
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

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({ viewTitle, isSidebarCollapsed, onToggleSidebar, onOpenFocus, onOpenAuth, onQuickAdd, onOpenCommandPalette, onOpenCopilot, onOpenSettings, syncStatus, user, isAnonymous }) => {
  const hints = useTaskStore(state => shortcutHintsEnabled(state.settings));
  const [soundEnabled, setSoundEnabled] = React.useState(() => audioEngine.getEnabled());
  const active = useFocusStore(state => state.focusSession);
  const utilityId = React.useId();
  const saving = useWorkspaceSelector(snapshot => snapshot.saving);
  const status = saving ? 'Saving…' : syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Upload pending' : syncStatus === 'error' ? 'Needs attention' : syncStatus === 'conflict' ? 'Review conflict' : syncStatus === 'offline' ? 'Saved · offline' : 'On this device';
  const name = user && !isAnonymous ? user.displayName || user.email || 'Account' : '';
  const isSyncOk = syncStatus === 'synced' || syncStatus === 'offline' || !user;

  return (
    <header className="product-header hidden lg:flex backdrop-blur-md">
      <div className="product-header-location">
        <button
          className="product-icon-button hover:scale-105 active:scale-95 transition-transform"
          onClick={onToggleSidebar}
          aria-label={hints ? "Toggle Sidebar ([)" : "Toggle Sidebar"}
          aria-expanded={!isSidebarCollapsed}
        >
          <Menu size={18} />
        </button>
        <span className="product-header-brand font-semibold">FlowTask</span>
        <span aria-hidden="true" className="product-header-divider opacity-40">/</span>
        <span className="product-header-title">{viewTitle}</span>
      </div>
      <div className="product-header-tools">
        <button
          className="product-search transition-all hover:border-[var(--border-strong)] hover:shadow-2xs cursor-pointer"
          aria-label="Search and commands"
          onClick={onOpenCommandPalette}
        >
          <Search size={15} className="text-[var(--text-muted)]" />
          <span className="text-xs">Search everything…</span>
          {hints && (
            <kbd className="ml-auto px-1.5 py-0.5 rounded bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[10px] font-mono text-[var(--text-secondary)] shadow-2xs">
              {MOD_KEY} K
            </kbd>
          )}
        </button>
        <button className="product-icon-button product-more-button" popoverTarget={utilityId} aria-label="Workspace tools" title="Workspace tools"><MoreHorizontal size={18} /></button>
        <div id={utilityId} popover="auto" className="product-tools-popover" onClick={event => { if ((event.target as HTMLElement).closest('button')) event.currentTarget.hidePopover?.(); }}>
        <p>Workspace tools</p>
        <button
          type="button"
          onClick={() => useModalStore.getState().openModal('captureHUD')}
          aria-label="Open Quick-Capture HUD (Alt+Space)"
          title="Quick-Capture HUD (Alt+Space)"
        >
          <Sparkles size={16} className="text-amber-500" />
          <span>Quick capture</span>{hints && <kbd>Alt Space</kbd>}
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !audioEngine.getEnabled();
            audioEngine.setEnabled(next);
            setSoundEnabled(next);
          }}
          aria-label={soundEnabled ? "Mute audio earcons" : "Unmute audio earcons"}
          title={soundEnabled ? "Audio earcons enabled" : "Audio muted"}
        >
          {soundEnabled ? <Volume2 size={16} className="text-amber-500" /> : <VolumeX size={16} className="text-[var(--text-muted)]" />}
          <span>{soundEnabled ? 'Mute interface sounds' : 'Enable interface sounds'}</span>
        </button>
        <button type="button" onClick={onOpenSettings}><Settings size={16} /><span>Settings</span>{hints && <kbd>{MOD_KEY} ,</kbd>}</button>
        </div>
        {onOpenCopilot && (
          <button
            className="product-icon-button product-assistant hover:scale-105 active:scale-95 transition-transform"
            onClick={onOpenCopilot}
            aria-label="Open Copilot Omnibar"
            title="Plan with your local assistant"
          >
            <Compass size={18} className="text-violet-500" />
          </button>
        )}
        {active ? (
          <FocusMiniPlayer variant="desktop" />
        ) : (
          <button
            className="desk-button product-focus-button enabled:active:scale-[0.96] transition-transform cursor-pointer shadow-2xs"
            onClick={onOpenFocus}
            aria-label="Focus"
            title="Open Focus Studio"
          >
            <Timer size={16} className="text-amber-500" />
            <span>Focus Studio</span>
          </button>
        )}
        <button
          className="desk-button primary product-add-button enabled:active:scale-[0.96] transition-transform cursor-pointer shadow-xs"
          onClick={onQuickAdd}
          aria-label="New Task"
        >
          <Plus size={16} />
          <span>New task</span>
        </button>
        <button
          className="product-account hover:bg-[var(--bg-surface-hover)] transition-all cursor-pointer"
          onClick={onOpenAuth}
          aria-label={name ? `User Account: ${name}, Cloud status: ${syncStatus}` : 'Saved on this device. Account and backup options'}
          title="Account, saving and cloud sync"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              saving
                ? 'bg-amber-400 animate-pulse'
                : isSyncOk
                ? 'bg-emerald-500'
                : 'bg-rose-500'
            }`}
          />
          <Cloud size={15} />
          <span className="product-account-name">{name || status}</span>
          {name && <span className="product-status-text">{status}</span>}
        </button>
      </div>
    </header>
  );
};
