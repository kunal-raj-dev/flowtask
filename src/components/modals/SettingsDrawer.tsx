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
  Sparkles,
  Sun,
  RotateCcw,
} from 'lucide-react';
import {
  loadDiurnalOverride,
  saveDiurnalOverride,
  loadDiurnalIntensity,
  saveDiurnalIntensity,
  DIURNAL_CONFIGS,
  type DiurnalOverride,
  type DiurnalPeriod,
} from '../../utils/diurnalAura';
import { useTaskContext, type AppTheme } from '../../context/TaskContext';
import { useModal } from '../../context/ModalContext';
import { audioEngine, type SoundProfile } from '../../utils/audioEngine';
import { useAuth } from '../../context/AuthContext';
import {
  MIN_CAPACITY_HOURS,
  MAX_CAPACITY_HOURS,
  CAPACITY_PRESETS,
  DURATION_PRESETS,
  BUFFER_PRESETS,
} from '../../types/settings';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'workflow' | 'aesthetics' | 'calendar' | 'data' | 'account';

const ALL_START_HOURS = Array.from({ length: 23 }, (_, i) => i); // 0 to 22
const ALL_END_HOURS = Array.from({ length: 24 }, (_, i) => i + 1); // 1 to 24

const formatHourLabel = (h: number) => {
  if (h === 0 || h === 24) return '12:00 AM (Midnight)';
  if (h === 12) return '12:00 PM (Noon)';
  if (h < 12) return `${h}:00 AM`;
  return `${h - 12}:00 PM`;
};

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

  // Diurnal Ambient Atmosphere state
  const [diurnalOverride, setDiurnalOverride] = useState<DiurnalOverride>(() => loadDiurnalOverride());
  const [diurnalIntensity, setDiurnalIntensity] = useState<number>(() => loadDiurnalIntensity());

  // Capacity & Duration local states
  const [capacityInput, setCapacityInput] = useState(settings.targetWorkCapacityHours.toString());
  const [isCustomDurationOpen, setIsCustomDurationOpen] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState(settings.defaultTaskDuration.toString());

  useEffect(() => {
    setCapacityInput(settings.targetWorkCapacityHours.toString());
  }, [settings.targetWorkCapacityHours]);

  useEffect(() => {
    setCustomDurationInput(settings.defaultTaskDuration.toString());
    const isPreset = (DURATION_PRESETS as readonly number[]).includes(settings.defaultTaskDuration);
    if (!isPreset) {
      setIsCustomDurationOpen(true);
    }
  }, [settings.defaultTaskDuration]);

  useEffect(() => {
    setIcsInput(calendarIcsUrl || '');
  }, [calendarIcsUrl]);

  useEffect(() => {
    if (isOpen) {
      setDiurnalOverride(loadDiurnalOverride());
      setDiurnalIntensity(loadDiurnalIntensity());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleDiurnalChange = () => {
      setDiurnalOverride(loadDiurnalOverride());
      setDiurnalIntensity(loadDiurnalIntensity());
    };
    window.addEventListener('diurnal-change', handleDiurnalChange);
    return () => window.removeEventListener('diurnal-change', handleDiurnalChange);
  }, []);

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

  const handleDiurnalSelect = (override: DiurnalOverride) => {
    setDiurnalOverride(override);
    saveDiurnalOverride(override);
    triggerSaveToast();
  };

  const handleDiurnalIntensityChange = (val: number) => {
    setDiurnalIntensity(val);
    saveDiurnalIntensity(val);
    triggerSaveToast();
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
    if (hours < 4) return { text: 'Minimalist & recovery pacing', color: 'text-stone-500 dark:text-stone-400' };
    if (hours <= 7) return { text: 'Optimal cognitive balance for deep work & retention', color: 'text-emerald-600 dark:text-emerald-400' };
    if (hours <= 10) return { text: 'Intensive workday sprint / high output', color: 'text-amber-600 dark:text-amber-400' };
    if (hours <= 14) return { text: 'Exam marathon & deep study sprint mode', color: 'text-indigo-600 dark:text-indigo-400' };
    return { text: 'Extended marathon crunch — schedule recovery & hydration', color: 'text-rose-600 dark:text-rose-400' };
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
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
              title="Close (Esc)"
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation with responsive wrapping and clear visibility */}
        <div className="relative border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/40">
          <div className="flex px-3 sm:px-6 overflow-x-auto no-scrollbar scroll-smooth gap-1 pt-2">
            <button
              onClick={() => setActiveTab('workflow')}
              className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap shrink-0 active:scale-95 ${
                activeTab === 'workflow'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-[var(--bg-surface-l1)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Clock size={14} className="shrink-0" />
              <span>Workflow & Capacity</span>
            </button>

            <button
              onClick={() => setActiveTab('aesthetics')}
              className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap shrink-0 active:scale-95 ${
                activeTab === 'aesthetics'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-[var(--bg-surface-l1)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Palette size={14} className="shrink-0" />
              <span>Aesthetics & Audio</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap shrink-0 active:scale-95 ${
                activeTab === 'calendar'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-[var(--bg-surface-l1)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Calendar size={14} className="shrink-0" />
              <span>Calendar Feeds</span>
            </button>

            <button
              onClick={() => setActiveTab('data')}
              className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap shrink-0 active:scale-95 ${
                activeTab === 'data'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-[var(--bg-surface-l1)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Database size={14} className="shrink-0" />
              <span>Data & Portability</span>
            </button>

            <button
              onClick={() => setActiveTab('account')}
              className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap shrink-0 active:scale-95 ${
                activeTab === 'account'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-[var(--bg-surface-l1)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Cloud size={14} className="shrink-0" />
              <span>Account & Sync</span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: WORKFLOW & CAPACITY */}
          {activeTab === 'workflow' && (
            <div className="space-y-6 animate-fade-in">
              {/* Daily Target Capacity (Study & Work) */}
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label htmlFor="daily-capacity-custom-input" className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <span>Daily Planned Capacity Target</span>
                      <Sparkles size={14} className="text-amber-500" />
                    </label>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Calibrate your daily workload budget. Perfect for regular workdays or intense study sprints.
                    </p>
                  </div>

                  {/* Direct Custom Numerical Input */}
                  <div className="flex items-center gap-1 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-xl px-2.5 py-1 focus-within:ring-2 focus-within:ring-amber-500 transition-all shrink-0">
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
                      className="w-12 bg-transparent text-right font-mono font-bold text-sm text-amber-700 dark:text-amber-300 outline-none"
                    />
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">hrs</span>
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
                    className="w-full accent-amber-500 cursor-pointer"
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
                          className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all text-center active:scale-95 ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/20 text-amber-700 dark:text-amber-300 shadow-xs'
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
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
                <div>
                  <span className="text-sm font-bold text-[var(--text-primary)] block">
                    Default Task Duration
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Fallback time allocated when no ~duration is parsed in the Omnibar.
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
                        className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {mins} mins
                      </button>
                    );
                  })}

                  {/* Custom Duration Input / Button */}
                  {isCustomDurationOpen || !isPresetDuration ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300">
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
                        className="w-12 bg-transparent text-center font-mono font-bold text-xs outline-none border-b border-amber-500/50"
                        autoFocus={isCustomDurationOpen && isPresetDuration}
                      />
                      <span className="text-xs font-semibold">m</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCustomDurationOpen(true)}
                      className="py-1.5 px-3 rounded-xl text-xs font-semibold border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-amber-500/50"
                    >
                      + Custom
                    </button>
                  )}
                </div>
              </div>

              {/* Timeline Hours Config */}
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
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
                      className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:border-amber-500 outline-none"
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
                      className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:border-amber-500 outline-none"
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
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
                    {settings.timelineEndHour - settings.timelineStartHour} hrs ({formatHourLabel(settings.timelineStartHour)} – {formatHourLabel(settings.timelineEndHour)})
                  </span>
                </div>
              </div>

              {/* Timeline Auto-Schedule Buffer */}
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
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
                      className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        settings.autoSlotBufferMinutes === mins
                          ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {mins === 0 ? 'None (0m)' : `${mins} mins`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Week Start Day */}
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
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
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        settings.weekStartDay === 'monday'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-xs font-bold'
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
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        settings.weekStartDay === 'sunday'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-xs font-bold'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Sunday
                    </button>
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

              {/* Diurnal Ambient Atmosphere Section */}
              <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Clock size={18} className="text-amber-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-[var(--text-primary)]">
                          Diurnal Ambient Atmosphere
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                          12 Atmospheres
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Organic breathing background glow calibrated to your workday
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-stone-200/50 dark:bg-white/[0.04] text-[var(--text-secondary)] border border-[var(--border-hairline)]">
                      {diurnalOverride === 'auto'
                        ? 'Auto (Circadian)'
                        : DIURNAL_CONFIGS[diurnalOverride]?.label || diurnalOverride}
                    </span>
                    {diurnalOverride !== 'auto' && (
                      <button
                        type="button"
                        onClick={() => handleDiurnalSelect('auto')}
                        className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline px-2 py-0.5 rounded-lg hover:bg-amber-500/10 transition-colors"
                        title="Reset to local circadian auto clock"
                      >
                        <RotateCcw size={11} />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Intensity Slider */}
                <div className="p-3 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                    <Sparkles size={14} className="text-amber-500 shrink-0" />
                    <div className="flex items-center gap-1.5">
                      <span>Atmosphere Intensity</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                        {Math.round(diurnalIntensity * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 w-full sm:w-48 shrink-0">
                    <span className="text-[9px] text-[var(--text-muted)] font-medium">Subtle</span>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.05"
                      value={diurnalIntensity}
                      onChange={(e) => handleDiurnalIntensityChange(parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                      title="Adjust diurnal atmosphere intensity"
                    />
                    <span className="text-[9px] text-[var(--text-muted)] font-medium">Vivid</span>
                  </div>
                </div>

                {/* Circadian Presets */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                    <Sun size={11} className="text-amber-500" />
                    <span>Circadian Presets</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      {
                        id: 'auto' as DiurnalOverride,
                        label: 'Auto (Clock)',
                        timeTag: 'Live Clock',
                        preview: 'from-amber-400 via-sky-400 to-indigo-900',
                        glow1: '#F59E0B',
                        glow2: '#38BDF8',
                      },
                      ...(['morning', 'midday', 'dusk', 'evening', 'midnight'] as DiurnalPeriod[]).map((p) => ({
                        id: p as DiurnalOverride,
                        label: DIURNAL_CONFIGS[p].label,
                        timeTag: DIURNAL_CONFIGS[p].timeTag,
                        preview: DIURNAL_CONFIGS[p].previewGradient,
                        glow1: DIURNAL_CONFIGS[p].glowColor1,
                        glow2: DIURNAL_CONFIGS[p].glowColor2,
                      })),
                    ].map((item) => {
                      const isSelected = diurnalOverride === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleDiurnalSelect(item.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between gap-1.5 ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                              : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] hover:bg-stone-200/40 dark:hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <div className="flex items-center gap-1.5 truncate">
                              <span
                                className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                                style={{ background: `linear-gradient(135deg, ${item.glow1}, ${item.glow2})` }}
                              />
                              <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                                {item.label}
                              </span>
                            </div>
                            {isSelected && <Check size={11} className="text-amber-500 stroke-[3] shrink-0" />}
                          </div>
                          <span className="text-[9px] font-mono text-[var(--text-muted)] truncate">
                            {item.timeTag}
                          </span>
                          <div className={`h-1 w-full rounded-full bg-gradient-to-r ${item.preview}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Thematic Flow Presets */}
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={11} className="text-indigo-400" />
                    <span>Thematic Flow Atmospheres</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(['aurora', 'solar', 'forest', 'synthwave', 'abyss', 'twilight'] as DiurnalPeriod[]).map((p) => {
                      const item = DIURNAL_CONFIGS[p];
                      const isSelected = diurnalOverride === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleDiurnalSelect(p)}
                          className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between gap-1.5 ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                              : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] hover:bg-stone-200/40 dark:hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <div className="flex items-center gap-1.5 truncate">
                              <span
                                className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                                style={{ background: `linear-gradient(135deg, ${item.glowColor1}, ${item.glowColor2})` }}
                              />
                              <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                                {item.label}
                              </span>
                            </div>
                            {isSelected && <Check size={11} className="text-amber-500 stroke-[3] shrink-0" />}
                          </div>
                          <span className="text-[9px] font-mono text-[var(--text-muted)] truncate">
                            {item.subtitle}
                          </span>
                          <div className={`h-1 w-full rounded-full bg-gradient-to-r ${item.previewGradient}`} />
                        </button>
                      );
                    })}
                  </div>
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
