import { useFocusTrap } from '../../hooks/useFocusTrap';
import { FocusSettings } from '../settings/FocusSettings';
import { BUILD_ID, BUILD_LABEL } from '../../utils/buildInfo';
import { WorkspaceSettings } from '../settings/WorkspaceSettings';
import { PrivacyControls } from '../settings/PrivacyControls';
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sliders,
  Calendar,
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  Sparkles,
  LayoutGrid,
  Palette,
  Timer,
  Volume2,
  HardDrive,
  FileSpreadsheet,
  CheckCircle2,
  Keyboard,
  Bell,
} from 'lucide-react';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { AestheticsSettingsContent } from '../settings/AestheticsSettingsContent';
import { useTaskContext } from '../../context/TaskContext';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import {
  MIN_CAPACITY_HOURS,
  MAX_CAPACITY_HOURS,
  CAPACITY_PRESETS,
  DURATION_PRESETS,
  BUFFER_PRESETS,
  type AutoArchiveCompleted,
  type DefaultTaskPriority,
} from '../../types/settings';
import { exportToCSV, downloadCsv } from '../../utils/fileExporter';
import { requestPersistentStorage } from '../../services/dbService';
import { ShortcutsGuide } from '../common/ShortcutsGuide';

export type CanonicalSettingsTab = 'workflow' | 'appearance' | 'notifications' | 'data';
export type SettingsTab =
  | CanonicalSettingsTab
  | 'aesthetics'
  | 'calendar'
  | 'data'
  | 'account'
  | 'focus'
  | 'sound'
  | 'workspace'
  | 'shortcuts'
  | 'about';

export function normalizeSettingsTab(tab?: string): CanonicalSettingsTab {
  if (!tab) return 'workflow';
  switch (tab) {
    case 'appearance':
    case 'aesthetics':
    case 'sound':
      return 'appearance';
    case 'notifications':
      return 'notifications';
    case 'data':
    case 'account':
    case 'about':
      return 'data';
    case 'workflow':
    case 'workspace':
    case 'focus':
    case 'calendar':
    case 'shortcuts':
    default:
      return 'workflow';
  }
}

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

const ALL_START_HOURS = Array.from({ length: 23 }, (_, i) => i); // 0 to 22
const ALL_END_HOURS = Array.from({ length: 24 }, (_, i) => i + 1); // 1 to 24

const formatHourLabel = (h: number) => {
  if (h === 0 || h === 24) return '12:00 AM (Midnight)';
  if (h === 12) return '12:00 PM (Noon)';
  if (h < 12) return `${h}:00 AM`;
  return `${h - 12}:00 PM`;
};

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ isOpen, onClose, initialTab }) => {
  const dialogRoot = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRoot, onClose, isOpen);
  const resolveInitialTab = (tab?: SettingsTab): SettingsTab => {
    if (!tab) return 'workflow';
    if (tab === 'appearance') return 'aesthetics';
    return tab;
  };
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => resolveInitialTab(initialTab));
  const { openModal } = useModal();
  const { user } = useAuth();

  const {
    tasks,
    projects,
    settings,
    updateSettings,
    resetSettings,
    calendarIcsUrl,
    setCalendarIcsUrl,
    refreshCalendarEvents,
    calendarEvents,
    syncStatus,
    lastSyncedAt,
    setIsAuthModalOpen,
    forceSyncToCloud,
    downloadWorkspaceBackup,
    workspacePreferences = {},
    importCalendarFile, removeImportedCalendar,
  } = useTaskContext();

  const todayStr = useTodayStr();
  const [icsInput, setIcsInput] = useState(calendarIcsUrl || '');
  const [isRefreshingCalendar, setIsRefreshingCalendar] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [icsFileUploadMsg, setIcsFileUploadMsg] = useState('');
  const [storageRequestBusy, setStorageRequestBusy] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const lastBackupAt = typeof workspacePreferences?._lastBackupAt === 'number' ? workspacePreferences._lastBackupAt : null;

  const requestStorageProtection = async () => {
    setStorageRequestBusy(true);
    setStorageMessage('');
    try {
      const granted = await requestPersistentStorage();
      const [estimate, persisted] = await Promise.all([
        navigator.storage?.estimate?.() || Promise.resolve({ usage: 0, quota: 0 }),
        navigator.storage?.persisted?.() || Promise.resolve(granted),
      ]);
      const usageMB = Math.round(((estimate.usage || 0) / (1024 * 1024)) * 10) / 10;
      const quotaMB = Math.round(((estimate.quota || 0) / (1024 * 1024)) * 10) / 10;
      setStorageStats({ usageMB, quotaMB, percent: quotaMB > 0 ? Math.min(100, Math.round((usageMB / quotaMB) * 100)) : 0, persisted: Boolean(persisted) });
      setStorageMessage(persisted ? 'This browser granted storage protection. Keep regular backups for recovery.' : 'This browser did not grant storage protection. Download a backup to keep a separate copy.');
    } catch {
      setStorageMessage('Storage protection is unavailable in this browser. Download a backup to keep a separate copy.');
    } finally {
      setStorageRequestBusy(false);
    }
  };

  // Storage Stats State
  const [storageStats, setStorageStats] = useState<{
    usageMB: number;
    quotaMB: number;
    percent: number;
    persisted: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      Promise.all([
        navigator.storage.estimate(),
        navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
      ])
        .then(([estimate, persisted]) => {
          const usageMB = Math.round(((estimate.usage || 0) / (1024 * 1024)) * 10) / 10;
          const quotaMB = Math.round(((estimate.quota || 0) / (1024 * 1024)) * 10) / 10;
          const percent = quotaMB > 0 ? Math.min(100, Math.round((usageMB / quotaMB) * 100)) : 0;
          setStorageStats({ usageMB, quotaMB, percent, persisted: Boolean(persisted) });
        })
        .catch(() => {});
    }
  }, [activeTab]);

  const groups: Array<{ id: SettingsTab; name: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
    { id: 'workspace', name: 'Workspace', icon: LayoutGrid },
    { id: 'aesthetics', name: 'Appearance', icon: Palette },
    { id: 'focus', name: 'Focus', icon: Timer },
    { id: 'sound', name: 'Sound', icon: Volume2 },
    { id: 'workflow', name: 'Workflow', icon: Sliders },
    { id: 'shortcuts', name: 'Shortcuts', icon: Keyboard },
    { id: 'calendar', name: 'Calendar', icon: Calendar },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'data', name: 'Data', icon: HardDrive },
    { id: 'account', name: 'Account', icon: ShieldCheck },
    { id: 'about', name: 'About', icon: Sparkles },
  ];

  // Sync activeTab when initialTab prop changes
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    if (initialTab) {
      setActiveTab(resolveInitialTab(initialTab));
    }
  }

  // Capacity & Duration local states
  const [capacityInput, setCapacityInput] = useState(settings.targetWorkCapacityHours.toString());
  const [isCustomDurationOpen, setIsCustomDurationOpen] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState(settings.defaultTaskDuration.toString());

  // Sync capacity input when settings change
  const [prevCapacityHours, setPrevCapacityHours] = useState(settings.targetWorkCapacityHours);
  if (settings.targetWorkCapacityHours !== prevCapacityHours) {
    setPrevCapacityHours(settings.targetWorkCapacityHours);
    setCapacityInput(settings.targetWorkCapacityHours.toString());
  }

  // Sync duration input when settings change
  const [prevDefaultDuration, setPrevDefaultDuration] = useState(settings.defaultTaskDuration);
  if (settings.defaultTaskDuration !== prevDefaultDuration) {
    setPrevDefaultDuration(settings.defaultTaskDuration);
    setCustomDurationInput(settings.defaultTaskDuration.toString());
    const isPreset = (DURATION_PRESETS as readonly number[]).includes(settings.defaultTaskDuration);
    if (!isPreset) {
      setIsCustomDurationOpen(true);
    }
  }

  // Sync calendar URL input when calendarIcsUrl changes
  const [prevCalendarIcsUrl, setPrevCalendarIcsUrl] = useState(calendarIcsUrl);
  if (calendarIcsUrl !== prevCalendarIcsUrl) {
    setPrevCalendarIcsUrl(calendarIcsUrl);
    setIcsInput(calendarIcsUrl || '');
  }

  // Handle Escape key
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

  // Capacity handlers
  const handleCapacityInputChange = (val: string) => {
    setCapacityInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= MIN_CAPACITY_HOURS && parsed <= MAX_CAPACITY_HOURS) {
      updateSettings({ targetWorkCapacityHours: parsed });
      triggerSaveToast();
    }
  };

  const handleCapacityInputBlur = () => {
    const parsed = parseFloat(capacityInput);
    if (isNaN(parsed) || parsed < MIN_CAPACITY_HOURS || parsed > MAX_CAPACITY_HOURS) {
      setCapacityInput(settings.targetWorkCapacityHours.toString());
    } else {
      const rounded = Math.round(parsed * 10) / 10;
      setCapacityInput(rounded.toString());
      updateSettings({ targetWorkCapacityHours: rounded });
      triggerSaveToast();
    }
  };

  const handleCapacityPreset = (hours: number) => {
    setCapacityInput(hours.toString());
    updateSettings({ targetWorkCapacityHours: hours });
    triggerSaveToast();
  };

  const getCapacityGuidance = (hours: number) => {
    if (hours < 4) return { text: 'Minimalist & recovery pacing', color: 'text-stone-600 dark:text-stone-300' };
    if (hours <= 7) return { text: 'Optimal cognitive balance for deep work & retention', color: 'text-emerald-700 dark:text-emerald-300' };
    if (hours <= 10) return { text: 'Intensive workday sprint / high output', color: 'text-[var(--pastel-amber)]' };
    if (hours <= 14) return { text: 'Exam marathon & deep study sprint mode', color: 'text-indigo-700 dark:text-indigo-300' };
    return { text: 'Extended marathon crunch — schedule recovery & hydration', color: 'text-rose-700 dark:text-rose-300' };
  };

  // Duration handlers
  const isPresetDuration = (DURATION_PRESETS as readonly number[]).includes(settings.defaultTaskDuration);

  const handleDurationPreset = (mins: number) => {
    setIsCustomDurationOpen(false);
    setCustomDurationInput(mins.toString());
    updateSettings({ defaultTaskDuration: mins });
    triggerSaveToast();
  };

  const handleCustomDurationCommit = (valStr: string) => {
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed >= 5 && parsed <= 480) {
      updateSettings({ defaultTaskDuration: parsed });
      setCustomDurationInput(parsed.toString());
      triggerSaveToast();
    } else {
      setCustomDurationInput(settings.defaultTaskDuration.toString());
    }
  };

  // Timeline Hour Handlers with start < end invariant
  const handleStartHourChange = (s: number) => {
    if (s >= settings.timelineEndHour) {
      const newEnd = Math.min(24, s + 4);
      updateSettings({ timelineStartHour: s, timelineEndHour: newEnd });
    } else {
      updateSettings({ timelineStartHour: s });
    }
    triggerSaveToast();
  };

  const handleEndHourChange = (e: number) => {
    if (e <= settings.timelineStartHour) {
      const newStart = Math.max(0, e - 4);
      updateSettings({ timelineStartHour: newStart, timelineEndHour: e });
    } else {
      updateSettings({ timelineEndHour: e });
    }
    triggerSaveToast();
  };

  // Direct CSV Export
  const handleDownloadCsv = () => {
    const csv = exportToCSV(tasks, projects);
    downloadCsv(csv, `flowtask-tasks-${todayStr}.csv`);
    triggerSaveToast();
  };

  // Handle local .ics file upload
  const handleIcsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIcsFileUploadMsg('Importing calendar…');
    void importCalendarFile(file).then(count => {
      setIcsFileUploadMsg(`Imported ${file.name}. ${count} events today. Other dates appear when you browse the plan.`);
      triggerSaveToast();
    }).catch(error => setIcsFileUploadMsg(error instanceof Error ? error.message : 'The calendar could not be imported.'));
    e.currentTarget.value = '';

  };

  if (!isOpen) return null;

  const sliderMax = Math.max(16, Math.min(MAX_CAPACITY_HOURS, Math.ceil(settings.targetWorkCapacityHours)));

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
        className="settings-drawer relative z-10 w-full max-w-xl sm:max-w-2xl md:max-w-3xl bg-[var(--bg-surface-l1)] border-l border-[var(--border-hairline)] shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-out animate-slide-left"
        ref={dialogRoot} tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={activeTab === 'aesthetics' || activeTab === 'appearance' ? 'Appearance settings' : 'Application Settings'}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--bg-surface-l1)]/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--color-brand-subtle)] text-[var(--color-brand)] border border-[var(--color-brand-border)]">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">Preferences & Settings</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Choose how you plan, focus, and make this space yours
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveToast && (
              <span className="text-xs font-semibold text-[var(--pastel-sage)] bg-[var(--bg-surface-l2)] px-2.5 py-1 rounded-lg border border-[var(--border-strong)] flex items-center gap-1.5 animate-fade-in">
                <CheckCircle2 size={12} />
                <span>Saved!</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Close (Esc)"
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Settings Groups Navigation Rail */}
        <nav className="desk-settings-nav" aria-label="Settings groups">
          {groups.map((group) => {
            const Icon = group.icon;
            const isCurrent = activeTab === group.id || (group.id === 'aesthetics' && activeTab === 'appearance');
            return (
              <button
                key={group.id}
                aria-pressed={isCurrent}
                onClick={() => setActiveTab(group.id)}
                className={`flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isCurrent ? 'font-bold' : ''
                }`}
              >
                <Icon size={14} className={isCurrent ? 'text-[var(--color-brand)]' : 'text-[var(--text-muted)]'} />
                <span>{group.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab Content Body */}
        <div data-settings-content className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB: WORKSPACE & LAYOUT */}
          {activeTab === 'workspace' && <WorkspaceSettings onClose={onClose} onSaveToast={triggerSaveToast} />}

          {/* TAB: FOCUS & TIMERS */}
          {activeTab === 'focus' && <FocusSettings />}
          {activeTab === 'about' && <section className="appearance-current" data-build={BUILD_ID}>
            <span className="appearance-eyebrow">FLOWTASK · FREE PUBLIC BETA</span>
            <h2 className="text-2xl mt-3">Plan your day. Enter your flow.</h2>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">A local-first planner and your personal Focus Studio.</p>
            <p className="mt-4 text-xs" title={BUILD_ID}>Build {BUILD_LABEL}</p>
            <a href="/" className="desk-button mt-5">Visit welcome page</a>
          </section>}

          {/* TAB: SOUND & ATMOSPHERE */}
          {activeTab === 'sound' && (
            <div className="space-y-6 animate-fade-in">
              <FocusSettings sound />
              <AestheticsSettingsContent section="sound" onSaveToast={triggerSaveToast} />
            </div>
          )}

          {/* TAB: WORKFLOW & CAPACITY */}
          {activeTab === 'workflow' && (
            <div className="space-y-6 animate-fade-in">
              {/* Daily Target Capacity (Study & Work) */}
              <div id="s-cap" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label htmlFor="daily-capacity-custom-input" className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <span>Daily Planned Capacity Target</span>
                      <Sparkles size={14} className="text-[var(--color-brand)]" />
                    </label>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Choose a realistic amount of time for your tasks. Perfect for regular workdays or intense study sprints.
                    </p>
                  </div>

                  {/* Direct Custom Numerical Input */}
                  <div className="flex items-center gap-1 bg-[var(--color-brand-subtle)] dark:bg-[var(--color-brand-subtle)] border border-[var(--color-brand-border)] rounded-xl px-2.5 py-1 focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)] transition-all shrink-0">
                    <input
                      type="number"
                      min={MIN_CAPACITY_HOURS}
                      max={MAX_CAPACITY_HOURS}
                      step="0.5"
                      id="daily-capacity-custom-input"
                      name="customCapacityHours"
                      aria-label="Daily capacity hours target"
                      value={capacityInput}
                      onChange={(e) => handleCapacityInputChange(e.target.value)}
                      onBlur={handleCapacityInputBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-12 bg-transparent text-right font-mono font-bold text-sm text-[var(--text-primary)] outline-none"
                    />
                    <span className="text-xs font-bold text-[var(--text-secondary)]">hrs</span>
                  </div>
                </div>

                {/* Range Slider */}
                <div className="space-y-1.5 pt-1">
                  <input
                    id="daily-capacity-slider"
                    name="targetWorkCapacityHours"
                    aria-label="Daily Planned Capacity Target"
                    type="range"
                    min={MIN_CAPACITY_HOURS}
                    max={sliderMax}
                    step="0.5"
                    value={settings.targetWorkCapacityHours}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setCapacityInput(val.toString());
                      updateSettings({ targetWorkCapacityHours: val });
                      triggerSaveToast();
                    }}
                    className="w-full accent-[var(--color-brand)] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                    <span>{MIN_CAPACITY_HOURS}h (Minimal)</span>
                    <span>6h (Recommended Deep Work)</span>
                    <span>{sliderMax}h {sliderMax > 10 ? '(Marathon)' : '(Intense)'}</span>
                  </div>
                </div>

                {/* Quick Preset Chips */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] block">
                    Quick Capacity Presets:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CAPACITY_PRESETS.map((hours) => {
                      const isSelected = settings.targetWorkCapacityHours === hours;
                      let label = `${hours}h`;
                      if (hours === 4) label = '4h (Light)';
                      else if (hours === 6) label = '6h (Balanced)';
                      else if (hours === 8) label = '8h (Deep Work)';
                      else if (hours === 10) label = '10h (Intense)';
                      else if (hours === 12) label = '12h (Study Marathon)';
                      else if (hours === 14) label = '14h (Exam Crunch)';

                      return (
                        <button
                          key={hours}
                          type="button"
                          onClick={() => handleCapacityPreset(hours)}
                          className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all text-center active:scale-95 cursor-pointer ${
                            isSelected
                              ? 'border-[var(--color-brand)] bg-[var(--color-brand-subtle)] text-[var(--color-brand)] shadow-xs'
                              : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-stone-400'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pacing Guidance Tag */}
                <div className="flex items-center gap-1.5 text-[11px] pt-1 border-t border-[var(--border-hairline)]">
                  <span className="font-semibold text-[var(--text-muted)]">Pacing profile:</span>
                  <span className={`font-medium ${getCapacityGuidance(settings.targetWorkCapacityHours).color}`}>
                    {getCapacityGuidance(settings.targetWorkCapacityHours).text}
                  </span>
                </div>
              </div>

              {/* Default Task Duration */}
              <div id="s-dur" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div>
                  <span className="text-sm font-bold text-[var(--text-primary)] block">
                    Default Task Duration
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Fallback time allocated when no ~duration is parsed in the Task Composer.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {DURATION_PRESETS.map((mins) => {
                    const isSelected = settings.defaultTaskDuration === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        aria-label={`Set default duration to ${mins} mins`}
                        onClick={() => handleDurationPreset(mins)}
                        className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand-subtle)] text-[var(--color-brand)] shadow-xs'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {mins} mins
                      </button>
                    );
                  })}

                  {/* Custom Duration Input / Button */}
                  {isCustomDurationOpen || !isPresetDuration ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-[var(--color-brand)] bg-[var(--color-brand-subtle)] text-[var(--color-brand)]">
                      <span className="text-xs font-semibold">Custom:</span>
                      <input
                        type="number"
                        min="5"
                        max="480"
                        step="5"
                        id="custom-duration-input"
                        aria-label="Custom task duration in minutes"
                        value={customDurationInput}
                        onChange={(e) => setCustomDurationInput(e.target.value)}
                        onBlur={() => handleCustomDurationCommit(customDurationInput)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCustomDurationCommit(customDurationInput);
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-12 bg-transparent text-center font-mono font-bold text-xs outline-none border-b border-[var(--color-brand-border)]"
                        autoFocus={isCustomDurationOpen && isPresetDuration}
                      />
                      <span className="text-xs font-semibold">m</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCustomDurationOpen(true)}
                      className="py-1.5 px-3 rounded-xl text-xs font-semibold border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--color-brand-border)] cursor-pointer"
                    >
                      + Custom
                    </button>
                  )}
                </div>
              </div>

              {/* Timeline Hours Config */}
              <div id="s-canvas" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div>
                  <span className="text-sm font-bold text-[var(--text-primary)] block">
                    Timeline Visual Canvas Hours
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Define the daily hourly boundaries for time-blocking in the Timeline view.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label htmlFor="timeline-start-hour-select" className="text-xs font-medium text-[var(--text-muted)] block mb-1">
                      Start Hour
                    </label>
                    <select
                      id="timeline-start-hour-select"
                      name="timelineStartHour"
                      aria-label="Timeline start hour"
                      value={settings.timelineStartHour}
                      onChange={(e) => handleStartHourChange(parseInt(e.target.value, 10))}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:border-[var(--color-brand)] outline-none cursor-pointer"
                    >
                      {ALL_START_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {formatHourLabel(h)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="timeline-end-hour-select" className="text-xs font-medium text-[var(--text-muted)] block mb-1">
                      End Hour
                    </label>
                    <select
                      id="timeline-end-hour-select"
                      name="timelineEndHour"
                      aria-label="Timeline end hour"
                      value={settings.timelineEndHour}
                      onChange={(e) => handleEndHourChange(parseInt(e.target.value, 10))}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:border-[var(--color-brand)] outline-none cursor-pointer"
                    >
                      {ALL_END_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {formatHourLabel(h)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Canvas Coverage Preview */}
                <div className="pt-2 px-3 py-2 rounded-xl bg-stone-500/5 dark:bg-white/[0.03] border border-[var(--border-hairline)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span className="font-medium text-[var(--text-secondary)]">Canvas Window</span>
                  <span className="font-mono text-[var(--color-brand)] font-semibold">
                    {settings.timelineEndHour - settings.timelineStartHour} hrs ({formatHourLabel(settings.timelineStartHour)} – {formatHourLabel(settings.timelineEndHour)})
                  </span>
                </div>
              </div>

              {/* Timeline Auto-Schedule Buffer */}
              <div id="s-buf" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div>
                  <span className="text-sm font-bold text-[var(--text-primary)] block">
                    Timeline Auto-Schedule Buffer
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Breathing room placed between unscheduled tasks when time-blocking on the visual canvas.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {BUFFER_PRESETS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      aria-label={`Set auto-slot buffer to ${mins} mins`}
                      onClick={() => {
                        updateSettings({ autoSlotBufferMinutes: mins });
                        triggerSaveToast();
                      }}
                      className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        settings.autoSlotBufferMinutes === mins
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand-subtle)] text-[var(--color-brand)] shadow-xs'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {mins === 0 ? 'None (0m)' : `${mins} mins`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Week Start Day */}
              <div id="s-week" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-[var(--text-primary)] block">
                      Week Start Day
                    </span>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Configures calendar columns and weekly planning views.
                    </p>
                  </div>
                  <div className="flex items-center p-1 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        updateSettings({ weekStartDay: 'monday' });
                        triggerSaveToast();
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        settings.weekStartDay === 'monday'
                          ? 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)] shadow-xs font-bold'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Monday
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateSettings({ weekStartDay: 'sunday' });
                        triggerSaveToast();
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        settings.weekStartDay === 'sunday'
                          ? 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)] shadow-xs font-bold'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Sunday
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto-Archive Completed Tasks */}
              <div id="s-archive" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-sm font-bold text-[var(--text-primary)] block">
                      Auto-Archive Completed Tasks
                    </span>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Automatically moves completed tasks out of daily active lists into archive.
                    </p>
                  </div>
                  <select
                    aria-label="Auto-Archive Completed Tasks"
                    value={settings.autoArchiveCompleted || 'never'}
                    onChange={(e) => {
                      updateSettings({ autoArchiveCompleted: e.target.value as AutoArchiveCompleted });
                      triggerSaveToast();
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:border-[var(--color-brand)] outline-none cursor-pointer"
                  >
                    <option value="never">Manual only (Never)</option>
                    <option value="immediate">Immediate</option>
                    <option value="end_of_day">End of workday</option>
                    <option value="24_hours">After 24 hours</option>
                    <option value="7_days">After 7 days</option>
                  </select>
                </div>
              </div>

              {/* Default Task Priority */}
              <div id="s-priority" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-sm font-bold text-[var(--text-primary)] block">
                      Default Task Priority
                    </span>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Applied when new tasks are added without a specific !priority tag.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)]">
                    {[
                      { id: 'p1', label: 'P1 Urgent', color: 'text-[var(--pastel-coral)]' },
                      { id: 'p2', label: 'P2 High', color: 'text-[var(--pastel-amber)]' },
                      { id: 'p3', label: 'P3 Normal', color: 'text-[var(--pastel-sky)]' },
                      { id: 'p4', label: 'P4 Low', color: 'text-[var(--text-muted)]' },
                    ].map((p) => {
                      const isSelected = (settings.defaultTaskPriority || 'p3') === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            updateSettings({ defaultTaskPriority: p.id as DefaultTaskPriority });
                            triggerSaveToast();
                          }}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)] font-bold shadow-xs'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {p.id.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Smart NLP Syntax Parsing Toggle */}
              <div id="s-nlp" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] flex items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-bold text-[var(--text-primary)] block">
                    Smart Natural Language Parsing
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Auto-detect #project, @tag, ~duration, and !priority tokens while typing tasks.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label="Smart Natural Language Parsing"
                  aria-checked={settings.enableSmartSyntaxParsing !== false}
                  onClick={() => {
                    updateSettings({ enableSmartSyntaxParsing: settings.enableSmartSyntaxParsing === false });
                    triggerSaveToast();
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.enableSmartSyntaxParsing !== false ? 'bg-[var(--color-brand)]' : 'bg-stone-300 dark:bg-stone-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      settings.enableSmartSyntaxParsing !== false ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Guided Onboarding Trigger */}
              <div className="p-4 rounded-2xl bg-[var(--color-brand-subtle)] border border-[var(--color-brand-border)] flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">
                    A fresh start
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Add one task and begin a quiet focus session.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openModal('onboarding');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--text-on-brand)] text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  Start with one task
                </button>
              </div>
            </div>
          )}

          {/* TAB: SHORTCUTS GUIDE */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                  Keyboard Shortcuts Guide
                </h3>
                <p className="text-xs text-[var(--text-secondary)] font-medium">
                  Dedicated searchable accelerator reference, context bindings, and master controls.
                </p>
              </div>

              <ShortcutsGuide
                showMasterToggle={true}
                keyboardShortcutsEnabled={settings.keyboardShortcutsEnabled !== false}
                showShortcutHints={(settings.showShortcutHints ?? settings.keyboardHaloEnabled) !== false}
                onToggleMasterShortcuts={(enabled) => {
                  updateSettings({ keyboardShortcutsEnabled: enabled });
                  triggerSaveToast();
                }}
                onToggleShortcutHints={(enabled) => {
                  updateSettings({ showShortcutHints: enabled, keyboardHaloEnabled: enabled });
                  triggerSaveToast();
                }}
              />
            </div>
          )}

          {/* TAB 2: AESTHETICS & APPEARANCE */}
          {(activeTab === 'aesthetics' || activeTab === 'appearance') && (
            <div className="space-y-6 animate-fade-in">
              <AestheticsSettingsContent
                section="appearance"
                onSaveToast={triggerSaveToast}
                intensitySliderTitle="Adjust diurnal atmosphere intensity"
              />
            </div>
          )}

          {/* TAB 3: CALENDAR INTEGRATIONS */}
          {activeTab === 'calendar' && (
            <div className="space-y-6 animate-fade-in">
              {/* Feed Status Card */}
              <div id="s-ical" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-4">
                <div className="flex items-center justify-between">
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

                  <span
                    className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold ${
                      calendarIcsUrl
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20'
                        : 'bg-[var(--bg-surface-l2)] text-stone-700 dark:text-stone-300 border border-[var(--border-hairline)]'
                    }`}
                  >
                    {calendarIcsUrl ? `${calendarEvents.length} events loaded` : 'No Feed Connected'}
                  </span>
                </div>

                <div className="space-y-2">
                  <label htmlFor="ical-feed-url-input" className="text-xs font-medium text-[var(--text-muted)] block">
                    iCal / Webcal Feed Secret URL
                  </label>
                  <input
                    type="url"
                    id="ical-feed-url-input"
                    name="calendarIcsUrl"
                    aria-label="iCal or Webcal Feed Secret URL"
                    value={icsInput}
                    onChange={(e) => setIcsInput(e.target.value)}
                    placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] focus:border-[var(--color-brand)] text-[var(--text-primary)] outline-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleApplyCalendarIcs}
                    disabled={isRefreshingCalendar}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
                      className="text-xs text-rose-500 hover:text-rose-600 font-semibold px-2 py-1 cursor-pointer"
                    >
                      Disconnect Feed
                    </button>
                  )}
                </div>

                <p className="desk-muted">Imported calendar files stay on this device and are excluded from backups and cloud sync. Importing another file replaces the previous file; a connected feed stays available.</p>
                {!!workspacePreferences._calendarFile && <div className="desk-notice"><span>Imported: {(workspacePreferences._calendarFile as { name: string }).name}</span><button onClick={removeImportedCalendar}>Remove imported calendar</button></div>}
                {/* Direct .ics File Import */}
                <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                    Or upload a local .ics calendar file:
                  </span>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] hover:border-indigo-500 cursor-pointer text-xs text-[var(--text-muted)]">
                    <Upload size={14} className="text-indigo-500" />
                    <span>Choose .ics file from device…</span>
                    <input
                      type="file"
                      aria-label="Import calendar file"
                      accept=".ics,text/calendar"
                      onChange={handleIcsFileUpload}
                      className="hidden"
                    />
                  </label>
                  {icsFileUploadMsg && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      {icsFileUploadMsg}
                    </p>
                  )}
                </div>

                {/* Guide links */}
                <div className="p-3 rounded-xl bg-stone-500/5 text-[11px] text-[var(--text-muted)] space-y-1">
                  <p className="font-semibold text-[var(--text-secondary)]">Where to find secret feed addresses:</p>
                  <p>• Google Calendar: Settings &gt; Click calendar &gt; &quot;Secret address in iCal format&quot;</p>
                  <p>• Apple iCloud Calendar: Calendar app &gt; Share Calendar &gt; Public/Private Webcal link</p>
                  <p>• Outlook / M365: Settings &gt; Calendar &gt; Shared calendars &gt; Publish a calendar</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: NOTIFICATIONS & REMINDERS */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-4">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">Browser Notifications & Reminders</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Configure task reminders and deliberate notification delivery.
                  </p>
                </div>

                {/* Deliberate Intent Permission Request */}
                <div className="p-4 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">System Notification Permission</span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Current status: <strong className="capitalize">{typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof Notification !== 'undefined') {
                        try {
                          await Notification.requestPermission();
                          triggerSaveToast();
                        } catch {}
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] text-xs font-semibold transition cursor-pointer"
                  >
                    Enable Browser Notifications
                  </button>
                </div>

                {/* Quiet Hours */}
                <div className="p-4 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[var(--text-primary)] block">Quiet Hours</span>
                      <span className="text-[11px] text-[var(--text-muted)]">Suppress notification sounds and popups during your off-hours</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.quietHoursEnabled ?? false}
                        onChange={(e) => {
                          updateSettings({ quietHoursEnabled: e.target.checked });
                          triggerSaveToast();
                        }}
                        className="sr-only peer"
                        aria-label="Enable Quiet Hours"
                      />
                      <div className="w-9 h-5 bg-stone-300 dark:bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-brand)]" />
                    </label>
                  </div>

                  {settings.quietHoursEnabled && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-hairline)]">
                      <div>
                        <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">Quiet Hours Start</label>
                        <input
                          type="time"
                          value={settings.quietHoursStart || '22:00'}
                          onChange={(e) => {
                            updateSettings({ quietHoursStart: e.target.value });
                            triggerSaveToast();
                          }}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] text-[var(--text-primary)]"
                          aria-label="Quiet Hours Start"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">Quiet Hours End</label>
                        <input
                          type="time"
                          value={settings.quietHoursEnd || '07:00'}
                          onChange={(e) => {
                            updateSettings({ quietHoursEnd: e.target.value });
                            triggerSaveToast();
                          }}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] text-[var(--text-primary)]"
                          aria-label="Quiet Hours End"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Notification Sound Toggle */}
                <div className="p-4 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">Reminder Audio Chime</span>
                    <span className="text-[11px] text-[var(--text-muted)]">Play a sound when a scheduled reminder or timer fires</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notificationSoundEnabled ?? true}
                      onChange={(e) => {
                        updateSettings({ notificationSoundEnabled: e.target.checked });
                        triggerSaveToast();
                      }}
                      className="sr-only peer"
                      aria-label="Enable Reminder Audio Chime"
                    />
                    <div className="w-9 h-5 bg-stone-300 dark:bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-brand)]" />
                  </label>
                </div>

                {/* Default Reminder Lead Time */}
                <div className="p-4 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] space-y-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)] block">Default Reminder Lead Time</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'At time of event', value: 0 },
                      { label: '5 min before', value: 5 },
                      { label: '10 min before', value: 10 },
                      { label: '15 min before', value: 15 },
                      { label: '30 min before', value: 30 },
                    ].map((preset) => {
                      const isSelected = (settings.defaultReminderOffsetMinutes ?? 5) === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => {
                            updateSettings({ defaultReminderOffsetMinutes: preset.value });
                            triggerSaveToast();
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            isSelected
                              ? 'bg-[var(--color-brand)] text-white'
                              : 'bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:border-[var(--color-brand)]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATA, STORAGE & PORTABILITY */}
          {activeTab === 'data' && (
            <div className="space-y-6 animate-fade-in">
              {/* Local-First vs Cloud Sync Scope Callout Banner */}
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[var(--color-brand)]" />
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">Data Sovereignty & Synchronization Scope</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] space-y-1.5">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-400 block">✓ Included in Cloud Sync (if signed in)</span>
                    <ul className="text-[11px] text-[var(--text-secondary)] list-disc list-inside space-y-0.5">
                      <li>Tasks, Projects, Sections & Tags</li>
                      <li>Connected Notes & Backlinks</li>
                      <li>Routine definitions & configurations</li>
                      <li>Workflow preferences & capacity targets</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] space-y-1.5">
                    <span className="font-semibold text-[var(--color-brand)] block">🔒 Kept Strictly Local (this device only)</span>
                    <ul className="text-[11px] text-[var(--text-secondary)] list-disc list-inside space-y-0.5">
                      <li>Webcal feed URLs & cached external events</li>
                      <li>Audio engine cache & ambient sound volume</li>
                      <li>Browser storage cache & IndexedDB binary files</li>
                      <li>Session execution history & private device backups</li>
                    </ul>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Flowtask is local-first by design. Even without an account, your data is fully saved locally in your browser's persistent IndexedDB storage.
                </p>
              </div>
              {/* Storage Quota Meter */}
              {storageStats && (
                <div id="s-storage" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                      <HardDrive size={15} className="text-[var(--color-brand)]" />
                      <span>Estimated browser storage</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold">
                      {storageStats.persisted ? 'Protected Quota' : 'Standard Quota'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                      <span>Used: {storageStats.usageMB} MB</span>
                      <span>Available: {storageStats.quotaMB > 0 ? `${storageStats.quotaMB} MB` : 'Estimating...'}</span>
                    </div>
                    <div className="w-full bg-[var(--bg-surface-l1)] h-2 rounded-full overflow-hidden border border-[var(--border-hairline)]">
                      <div
                        className="bg-[var(--color-brand)] h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(2, storageStats.percent)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Browser estimate across this site · {tasks.length} tasks · {projects.length} projects. Quota protection reduces eviction risk; it is not a backup.
                  </p>
                  {!storageStats.persisted && <button type="button" className="desk-button" disabled={storageRequestBusy} onClick={() => void requestStorageProtection()}>{storageRequestBusy ? 'Requesting…' : 'Request storage protection'}</button>}
                  {storageMessage && <p className="text-[11px] text-[var(--text-secondary)]" role="status">{storageMessage}</p>}
                </div>
              )}
              {!storageStats && <p className="p-3 rounded-xl border border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)]" role="status">This browser does not provide a storage estimate. Keep a downloaded JSON backup in a separate location.</p>}

              {/* Data Portability Card */}
              <div id="s-export" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">
                    Your data and backups
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Your workspace is stored on this device. Optional account sync can copy supported workspace data across devices.
                  </p>
                </div>

                {/* Direct 1-Click Exports */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={downloadWorkspaceBackup}
                    className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] hover:border-[var(--color-brand-border)] text-left transition-all flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Download size={13} className="text-[var(--color-brand)]" />
                        <span>Download JSON Backup</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Workspace data and settings · personal media files stay on this device
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] hover:border-[var(--color-brand-border)] text-left transition-all flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <FileSpreadsheet size={13} className="text-emerald-500" />
                        <span>Export CSV Spreadsheet</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Open in Excel or Google Sheets
                      </p>
                    </div>
                  </button>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]" role="status">
                  {lastBackupAt ? `Last JSON export recorded ${new Date(lastBackupAt).toLocaleString()}.` : 'No JSON export has been recorded on this device yet.'} A downloaded backup is separate from browser storage and should be kept somewhere safe.
                </p>

                {/* Modal hub links for deeper operations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openModal('exportImport');
                    }}
                    className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] hover:border-indigo-500/50 text-left transition-all flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Download size={13} className="text-indigo-500" />
                        <span>Export JSON / CSV</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Advanced formats & standup generator
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openModal('exportImport');
                    }}
                    className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] hover:border-indigo-500/50 text-left transition-all flex items-center justify-between cursor-pointer"
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
              <div id="s-reset" className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    Reset Settings to Default
                  </h4>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">
                    Restores capacity target (6.0h) and default preferences.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetSettings();
                    triggerSaveToast();
                  }}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-800 dark:text-rose-300 hover:bg-rose-500/10 text-xs font-bold transition-all cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: ACCOUNT & SYNC */}
          {activeTab === 'account' && (
            <div className="space-y-6 animate-fade-in">
              {/* Account Identity & Cloud Sync Card */}
              <div id="s-cloud" className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        {user ? user.email || 'Cloud Account' : 'Local-First Anonymous'}
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
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                        : syncStatus === 'syncing'
                        ? 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)] animate-pulse'
                        : 'bg-[var(--bg-surface-l2)] text-stone-700 dark:text-stone-300 border border-[var(--border-hairline)]'
                    }`}
                  >
                    {syncStatus}
                  </span>
                </div>

                <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">
                    {lastSyncedAt ? `Last cloud sync: ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Syncing local-first'}
                  </span>

                  <div className="flex items-center gap-2">
                    {user && (
                      <button
                        type="button"
                        onClick={() => void forceSyncToCloud()}
                        className="px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] hover:border-[var(--color-brand)] text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw size={12} />
                        <span>Sync Now</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setIsAuthModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 hover:opacity-90 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      {user ? 'Manage Account' : 'Sign in / Cloud Sync'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Privacy Controls & Legal */}
              <div id="s-privacy">
                <PrivacyControls />
              </div>
            </div>
          )}
        </div>

        {/* Global Keyboard Shortcuts Helper Footer */}
        <div className="p-3 border-t border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/90 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              openModal('shortcuts');
            }}
            className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <Keyboard size={14} className="text-[var(--color-brand)]" />
            <span className="font-semibold">Keyboard Shortcuts Cheat Sheet</span>
            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-stone-200 dark:bg-white/10">?</span>
          </button>
          <span className="text-[11px] font-mono">FlowTask v2.0</span>
        </div>
      </div>
    </div>
  );
};
import '../../styles/settings-navigation.css';
