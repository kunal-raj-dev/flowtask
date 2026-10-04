import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Palette,
  Calendar,
  Database,
  Cloud,
  Volume2,
  VolumeX,
  Check,
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { useTaskContext, type AppTheme } from '../../context/TaskContext';
import { useModal } from '../../context/ModalContext';
import { audioEngine, type SoundProfile } from '../../utils/audioEngine';
import { useAuth } from '../../context/AuthContext';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'workflow' | 'aesthetics' | 'calendar' | 'data' | 'account';

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('workflow');
  const { openModal } = useModal();
  const { user } = useAuth();

  const {
    theme,
    toggleTheme,
    soundEnabled,
    soundProfile,
    settings,
    updateSettings,
    resetSettings,
    calendarIcsUrl,
    setCalendarIcsUrl,
    refreshCalendarEvents,
    syncStatus,
    lastSyncedAt,
    setIsAuthModalOpen,
  } = useTaskContext();

  const [icsInput, setIcsInput] = useState(calendarIcsUrl || '');
  const [isRefreshingCalendar, setIsRefreshingCalendar] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  useEffect(() => {
    setIcsInput(calendarIcsUrl || '');
  }, [calendarIcsUrl]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleApplyCalendarIcs = async () => {
    setCalendarIcsUrl(icsInput.trim());
    setIsRefreshingCalendar(true);
    await refreshCalendarEvents();
    setIsRefreshingCalendar(false);
    triggerSaveToast();
  };

  const triggerSaveToast = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const themes: { id: AppTheme; label: string; bg: string; border: string; desc: string }[] = [
    { id: 'light', label: 'Alabaster Light', bg: 'bg-[#F9FAFB] text-stone-900', border: 'border-stone-300', desc: 'Calm morning light with aurora mesh' },
    { id: 'dark', label: 'Obsidian Dark', bg: 'bg-[#0B0F17] text-stone-100', border: 'border-stone-700', desc: 'Deep space 4-tiered contrast' },
    { id: 'tokyo', label: 'Tokyo Night', bg: 'bg-[#1A1B26] text-purple-200', border: 'border-indigo-500/30', desc: 'Neon cyber evening aesthetic' },
    { id: 'nord', label: 'Nord Cold', bg: 'bg-[#2E3440] text-cyan-100', border: 'border-cyan-500/30', desc: 'Arctic cool blue palette' },
    { id: 'matcha', label: 'Matcha Zen', bg: 'bg-[#18231C] text-emerald-200', border: 'border-emerald-500/30', desc: 'Organic grounding herbal tone' },
    { id: 'sepia', label: 'Solarized Sepia', bg: 'bg-[#FBF7EE] text-[#2C2218]', border: 'border-amber-600/30', desc: 'Editorial warm parchment paper' },
    { id: 'crimson', label: 'Cyber Crimson', bg: 'bg-[#0D080B] text-rose-200', border: 'border-rose-500/30', desc: 'Deep velvet obsidian with ruby neon' },
    { id: 'cobalt', label: 'Deep Cobalt', bg: 'bg-[#060B14] text-cyan-200', border: 'border-cyan-500/30', desc: 'Oceanic midnight abyss with cyan borders' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Content Container */}
      <div
        className="relative z-10 w-full max-w-xl sm:max-w-2xl bg-[var(--bg-surface-l1)] border-l border-[var(--border-hairline)] shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-out animate-slide-left"
        role="dialog"
        aria-modal="true"
        aria-label="Application Settings"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--bg-surface-l1)]/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">Preferences & Settings</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Calibrate capacity, diurnal aesthetics, calendar overlay, and data integrity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveToast && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 animate-fade-in">
                Saved!
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
              title="Close (Esc)"
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border-hairline)] px-4 sm:px-6 bg-[var(--bg-surface-l2)]/40 overflow-x-auto no-scrollbar gap-1 pt-2">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'workflow'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-[var(--bg-surface-l1)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Clock size={14} />
            <span>Workflow & Capacity</span>
          </button>

          <button
            onClick={() => setActiveTab('aesthetics')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'aesthetics'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-[var(--bg-surface-l1)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Palette size={14} />
            <span>Aesthetics & Audio</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'calendar'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-[var(--bg-surface-l1)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Calendar size={14} />
            <span>Calendar Feeds</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'data'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-[var(--bg-surface-l1)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Database size={14} />
            <span>Data & Portability</span>
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'account'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-[var(--bg-surface-l1)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Cloud size={14} />
            <span>Account & Sync</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: WORKFLOW & CAPACITY */}
          {activeTab === 'workflow' && (
            <div className="space-y-6 animate-fade-in">
              {/* Daily Target Capacity */}
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-[var(--text-primary)]">
                      Daily Planned Capacity Target
                    </label>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Guards against planning fallacy and cognitive exhaustion.
                    </p>
                  </div>
                  <span className="text-sm font-bold font-mono px-3 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    {settings.targetWorkCapacityHours.toFixed(1)} hrs
                  </span>
                </div>

                <div className="space-y-1.5 pt-2">
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="0.5"
                    value={settings.targetWorkCapacityHours}
                    onChange={(e) => {
                      updateSettings({ targetWorkCapacityHours: parseFloat(e.target.value) });
                      triggerSaveToast();
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-[var(--text-muted)] font-mono">
                    <span>2h (Minimalist)</span>
                    <span>6h (Recommended Deep Work)</span>
                    <span>10h (Intense)</span>
                  </div>
                </div>
              </div>

              {/* Default Task Duration */}
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div>
                  <label className="text-sm font-bold text-[var(--text-primary)]">
                    Default Task Duration
                  </label>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Fallback time allocated when no ~duration is parsed in the Omnibar.
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[15, 25, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        updateSettings({ defaultTaskDuration: mins });
                        triggerSaveToast();
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        settings.defaultTaskDuration === mins
                          ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {mins} mins
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline Hours Config */}
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div>
                  <label className="text-sm font-bold text-[var(--text-primary)]">
                    Timeline Visual Canvas Hours
                  </label>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Define the daily hourly boundaries for time-blocking in the Timeline view.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">
                      Start Hour (Morning)
                    </label>
                    <select
                      value={settings.timelineStartHour}
                      onChange={(e) => {
                        updateSettings({ timelineStartHour: parseInt(e.target.value, 10) });
                        triggerSaveToast();
                      }}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:border-amber-500 outline-none"
                    >
                      {[5, 6, 7, 8, 9].map((h) => (
                        <option key={h} value={h}>
                          {h}:00 AM
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">
                      End Hour (Night)
                    </label>
                    <select
                      value={settings.timelineEndHour}
                      onChange={(e) => {
                        updateSettings({ timelineEndHour: parseInt(e.target.value, 10) });
                        triggerSaveToast();
                      }}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:border-amber-500 outline-none"
                    >
                      {[20, 21, 22, 23, 24].map((h) => (
                        <option key={h} value={h}>
                          {h === 24 ? '12:00 AM (Midnight)' : `${h - 12}:00 PM`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Guided Onboarding Trigger */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Rerun Guided Setup Ritual
                  </h4>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                    Re-experience the Sunsama-style guided onboarding flow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openModal('onboarding');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs shrink-0"
                >
                  Launch Ritual
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: AESTHETICS & AUDIO */}
          {activeTab === 'aesthetics' && (
            <div className="space-y-6 animate-fade-in">
              {/* Theme Picker */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-[var(--text-primary)]">
                  Color Space & Visual Aura
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {themes.map((th) => {
                    const isSelected = theme === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => {
                          if (theme !== th.id) toggleTheme();
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative ${th.bg} ${th.border} ${
                          isSelected ? 'ring-2 ring-amber-500 shadow-md' : 'opacity-85 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{th.label}</span>
                          {isSelected && (
                            <span className="p-1 rounded-full bg-amber-500 text-stone-950">
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] opacity-75 mt-1">{th.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sound Settings */}
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {soundEnabled ? (
                      <Volume2 className="text-amber-500" size={18} />
                    ) : (
                      <VolumeX className="text-stone-400" size={18} />
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        Haptic & Synthesized Audio FX
                      </h4>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Tactile clicks on completion and focus chimes.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      audioEngine.setSoundEnabled(!soundEnabled);
                      triggerSaveToast();
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      soundEnabled
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
                        : 'bg-stone-200 dark:bg-stone-800 border-transparent text-stone-500'
                    }`}
                  >
                    {soundEnabled ? 'Enabled' : 'Muted'}
                  </button>
                </div>

                {soundEnabled && (
                  <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">Sound Profile</span>
                    <select
                      value={soundProfile}
                      onChange={(e) => {
                        audioEngine.setSoundProfile(e.target.value as SoundProfile);
                        audioEngine.playCompletionChime();
                        triggerSaveToast();
                      }}
                      className="text-xs px-3 py-1.5 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] outline-none font-medium"
                    >
                      <option value="zen">Zen Singing Bowl (Harmonic)</option>
                      <option value="mechanical">Mechanical Switch (Clicky)</option>
                      <option value="bubble">Soft Bubble (Pop)</option>
                      <option value="marimba">Marimba Teak (Acoustic)</option>
                      <option value="typewriter">Retro Typewriter (Vintage)</option>
                      <option value="synth">Cosmic Synth (Retro 80s)</option>
                      <option value="velvet">Velvet Thud (Whisper Soft)</option>
                      <option value="mute">Completely Silent (Mute)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CALENDAR INTEGRATIONS */}
          {activeTab === 'calendar' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">
                      Private .ics Calendar Overlay
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Render client-side meetings directly over your hourly timeline rail.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--text-muted)] block">
                    iCal / Webcal Feed Secret URL
                  </label>
                  <input
                    type="url"
                    value={icsInput}
                    onChange={(e) => setIcsInput(e.target.value)}
                    placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] focus:border-amber-500 text-[var(--text-primary)] outline-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleApplyCalendarIcs}
                    disabled={isRefreshingCalendar}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isRefreshingCalendar ? 'animate-spin' : ''} />
                    <span>{isRefreshingCalendar ? 'Connecting...' : 'Save & Sync Feed'}</span>
                  </button>

                  {calendarIcsUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCalendarIcsUrl('');
                        setIcsInput('');
                        triggerSaveToast();
                      }}
                      className="text-xs text-rose-500 hover:text-rose-600 font-semibold px-2 py-1"
                    >
                      Disconnect Feed
                    </button>
                  )}
                </div>

                {/* Guide links */}
                <div className="p-3 rounded-xl bg-stone-500/5 text-[11px] text-[var(--text-muted)] space-y-1">
                  <p className="font-semibold text-[var(--text-secondary)]">Where to find secret addresses:</p>
                  <p>• Google Calendar: Settings &gt; Click calendar &gt; &quot;Secret address in iCal format&quot;</p>
                  <p>• Outlook / M365: Settings &gt; Calendar &gt; Shared calendars &gt; Publish a calendar</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATA & PORTABILITY */}
          {activeTab === 'data' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">
                    Local-First Data Sovereignity
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Your tasks belong to you. Export or restore at any time.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openModal('exportImport');
                    }}
                    className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] hover:border-amber-500/50 text-left transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Download size={13} className="text-amber-500" />
                        <span>Export JSON / CSV</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Download raw snapshots or spreadsheets
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openModal('exportImport');
                    }}
                    className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] hover:border-amber-500/50 text-left transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Upload size={13} className="text-indigo-500" />
                        <span>Restore Backup</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Import past FlowTask JSON backup files
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Reset Defaults */}
              <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    Reset Settings to Default
                  </h4>
                  <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                    Restores capacity target (6.0h) and default preferences.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetSettings();
                    triggerSaveToast();
                  }}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10 text-xs font-bold transition-all"
                >
                  Reset Defaults
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: ACCOUNT & SYNC */}
          {activeTab === 'account' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        {user ? (user.email || 'Cloud Account') : 'Local-First Anonymous'}
                      </h4>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {user
                          ? `Connected & synced to Firebase cloud (${syncStatus})`
                          : 'Tasks stored securely in your browser IndexedDB'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                      syncStatus === 'synced'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : syncStatus === 'syncing'
                        ? 'bg-amber-500/15 text-amber-600 animate-pulse'
                        : 'bg-stone-500/15 text-stone-500'
                    }`}
                  >
                    {syncStatus}
                  </span>
                </div>

                <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">
                    {lastSyncedAt ? `Last cloud sync: ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Syncing local-first'}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setIsAuthModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 hover:opacity-90 text-xs font-bold transition-all shadow-xs"
                  >
                    {user ? 'Manage Account' : 'Sign in / Cloud Sync'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
