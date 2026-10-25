import { shortcutHintsEnabled, MOD_KEY } from '../../services/shortcutRegistry';
import { useTaskStore } from '../../store/useTaskStore';
import React from 'react';
import { Menu, Search, Plus, Timer, Cloud, Sparkles, Volume2, VolumeX, Compass } from 'lucide-react';
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

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({ viewTitle, isSidebarCollapsed, onToggleSidebar, onOpenFocus, onOpenAuth, onQuickAdd, onOpenCommandPalette, onOpenCopilot, syncStatus, user, isAnonymous }) => {
  const hints = useTaskStore(state => shortcutHintsEnabled(state.settings));
  const [soundEnabled, setSoundEnabled] = React.useState(() => audioEngine.getEnabled());
  const active = useFocusStore(state => state.focusSession);
  const saving = useWorkspaceSelector(snapshot => snapshot.saving);
  const status = saving ? 'Saving…' : syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Upload pending' : syncStatus === 'error' ? 'Needs attention' : syncStatus === 'conflict' ? 'Review conflict' : syncStatus === 'offline' ? 'Saved · offline' : 'On this device';
  const name = user && !isAnonymous ? user.displayName || user.email || 'Account' : '';
  return <header className="product-header hidden lg:flex">
    <div className="product-header-location">
      <button className="product-icon-button" onClick={onToggleSidebar} aria-label={hints ? "Toggle Sidebar ([)" : "Toggle Sidebar"} aria-expanded={!isSidebarCollapsed}><Menu size={18}/></button>
      <span className="product-header-brand">FlowTask</span><span aria-hidden="true" className="product-header-divider">/</span><span className="product-header-title">{viewTitle}</span>
    </div>
    <div className="product-header-tools">
      <button className="product-search" aria-label="Search and commands" onClick={onOpenCommandPalette}><Search size={16}/><span>Search everything</span>{hints && <kbd>{MOD_KEY} K</kbd>}</button>
      <button
        type="button"
        className="product-icon-button"
        onClick={() => useModalStore.getState().openModal('captureHUD')}
        aria-label="Open Quick-Capture HUD (Alt+Space)"
        title="Quick-Capture HUD (Alt+Space)"
      >
        <Sparkles size={16} className="text-amber-500" />
      </button>
      <button
        type="button"
        className="product-icon-button"
        onClick={() => {
          const next = !audioEngine.getEnabled();
          audioEngine.setEnabled(next);
          setSoundEnabled(next);
        }}
        aria-label={soundEnabled ? "Mute audio earcons" : "Unmute audio earcons"}
        title={soundEnabled ? "Audio earcons enabled" : "Audio muted"}
      >
        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} className="text-[var(--text-muted)]" />}
      </button>
      {onOpenCopilot && <button className="product-icon-button product-assistant" onClick={onOpenCopilot} aria-label="Open Copilot Omnibar" title="Plan with your local assistant"><Compass size={18}/></button>}
      {active ? <FocusMiniPlayer variant="desktop"/> : <button className="desk-button product-focus-button" onClick={onOpenFocus}><Timer size={16}/>Focus</button>}
      <button className="desk-button primary product-add-button" onClick={onQuickAdd} aria-label="New Task"><Plus size={16}/><span>New task</span></button>
      <button className="product-account" onClick={onOpenAuth} aria-label={name ? `User Account: ${name}, Cloud status: ${syncStatus}` : 'Saved on this device. Account and backup options'} title="Account, saving and cloud sync">
        <Cloud size={16}/><span className="product-account-name">{name || status}</span>{name && <span className="product-status-text">{status}</span>}
      </button>
    </div>
  </header>;
};
