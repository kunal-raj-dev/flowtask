import { create } from 'zustand';
import type { ViewId, Priority } from '../types/task';
import { audioEngine, type SoundProfile } from '../utils/audioEngine';

export type AppTheme = 'light' | 'dark' | 'tokyo' | 'nord' | 'matcha' | 'sepia' | 'crimson' | 'cobalt';

export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface UIState {
  activeView: ViewId;
  viewLayout: 'list' | 'kanban' | 'matrix';
  selectedTaskId: string | null;
  selectedTaskIds: string[];
  searchQuery: string;
  priorityFilter: Priority | 'all';
  quickWinsOnly: boolean;
  theme: AppTheme;
  soundEnabled: boolean;
  soundProfile: SoundProfile;
  toast: ToastState | null;

  isAuthModalOpen: boolean;
  isQuickAddOpen: boolean;
  quickAddDraft: string;
  isTemplatePickerOpen: boolean;
  isWeeklyReviewOpen: boolean;
  isSmartFilterModalOpen: boolean;
  isInterruptionModalOpen: boolean;
  isEveningShutdownOpen: boolean;
  isShutdownDismissed: boolean;
  isTriageDismissed: boolean;

  setActiveView: (view: ViewId) => void;
  setViewLayout: (layout: 'list' | 'kanban' | 'matrix') => void;
  setSelectedTaskId: (id: string | null) => void;
  toggleTaskSelection: (id: string) => void;
  selectTask: (id: string) => void;
  deselectTask: (id: string) => void;
  selectAllTasks: (ids: string[]) => void;
  clearTaskSelection: () => void;
  setSearchQuery: (query: string) => void;
  setPriorityFilter: (p: Priority | 'all') => void;
  setQuickWinsOnly: (enabled: boolean) => void;
  setTheme: (t: AppTheme) => void;
  toggleTheme: () => void;
  toggleSound: () => void;
  setSoundProfile: (p: SoundProfile) => void;
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
  clearToast: () => void;

  setIsAuthModalOpen: (open: boolean) => void;
  setIsQuickAddOpen: (open: boolean) => void;
  setQuickAddDraft: (draft: string) => void;
  setIsTemplatePickerOpen: (open: boolean) => void;
  setIsWeeklyReviewOpen: (open: boolean) => void;
  setIsSmartFilterModalOpen: (open: boolean) => void;
  setIsInterruptionModalOpen: (open: boolean) => void;
  setIsEveningShutdownOpen: (open: boolean) => void;
  dismissShutdown: () => void;
  setIsTriageDismissed: (dismissed: boolean) => void;
}

const parseInitialView = (): ViewId => {
  if (typeof window === 'undefined') return 'today';
  try {
    const view = new URL(window.location.href).searchParams.get('view') || 'today';
    return /^(today|inbox|upcoming|projects|review|all|someday|timeline|matrix|kanban|insights|logbook|trash|archive|project:.+|smart:.+)$/.test(view)
      ? (view as ViewId)
      : 'today';
  } catch {
    return 'today';
  }
};

const getInitialTheme = (): AppTheme => {
  if (typeof localStorage === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem('flowtask_theme') as AppTheme;
    return ['light', 'dark', 'tokyo', 'nord', 'matcha', 'sepia', 'crimson', 'cobalt'].includes(saved) ? saved : 'light';
  } catch {
    return 'light';
  }
};

let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState>((set, get) => ({
  activeView: parseInitialView(),
  viewLayout: 'list',
  selectedTaskId: null,
  selectedTaskIds: [],
  searchQuery: '',
  priorityFilter: 'all',
  quickWinsOnly: false,
  theme: getInitialTheme(),
  soundEnabled: audioEngine.getSoundEnabled(),
  soundProfile: audioEngine.getSoundProfile(),
  toast: null,

  isAuthModalOpen: false,
  isQuickAddOpen: false,
  quickAddDraft: '',
  isTemplatePickerOpen: false,
  isWeeklyReviewOpen: false,
  isSmartFilterModalOpen: false,
  isInterruptionModalOpen: false,
  isEveningShutdownOpen: false,
  isShutdownDismissed: false,
  isTriageDismissed: false,

  setActiveView: (view: ViewId) => {
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('view', view);
        window.history.pushState({}, '', url);
      } catch {}
    }
    set({ activeView: view });
  },

  setViewLayout: (layout) => set({ viewLayout: layout }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),

  toggleTaskSelection: (id) =>
    set((state) => ({
      selectedTaskIds: state.selectedTaskIds.includes(id)
        ? state.selectedTaskIds.filter((x) => x !== id)
        : [...state.selectedTaskIds, id],
    })),
  selectTask: (id) =>
    set((state) => ({
      selectedTaskIds: [...new Set([...state.selectedTaskIds, id])],
    })),
  deselectTask: (id) =>
    set((state) => ({
      selectedTaskIds: state.selectedTaskIds.filter((x) => x !== id),
    })),
  selectAllTasks: (ids) => set({ selectedTaskIds: ids }),
  clearTaskSelection: () => set({ selectedTaskIds: [] }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setPriorityFilter: (p) => set({ priorityFilter: p }),
  setQuickWinsOnly: (enabled) => set({ quickWinsOnly: enabled }),

  setTheme: (theme) => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('flowtask_theme', theme);
      } catch {}
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove(
        'dark',
        'theme-tokyo',
        'theme-nord',
        'theme-matcha',
        'theme-sepia',
        'theme-crimson',
        'theme-cobalt'
      );
      if (['dark', 'tokyo', 'nord', 'crimson', 'cobalt'].includes(theme)) {
        document.documentElement.classList.add('dark');
      }
      if (!['light', 'dark'].includes(theme)) {
        document.documentElement.classList.add(`theme-${theme}`);
      }
      document.documentElement.setAttribute('data-theme', theme);
    }
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },

  toggleSound: () => {
    const next = !get().soundEnabled;
    audioEngine.setSoundEnabled(next);
    set({ soundEnabled: next });
  },

  setSoundProfile: (profile) => {
    audioEngine.setSoundProfile(profile);
    set({ soundProfile: profile });
  },

  showToast: (message, actionLabel, onAction) => {
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
      toastTimeoutId = null;
    }
    set({ toast: { message, actionLabel, onAction } });
    toastTimeoutId = setTimeout(() => {
      set({ toast: null });
      toastTimeoutId = null;
    }, 5000);
  },

  clearToast: () => {
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
      toastTimeoutId = null;
    }
    set({ toast: null });
  },

  setIsAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
  setIsQuickAddOpen: (open) => set({ isQuickAddOpen: open }),
  setQuickAddDraft: (draft) => set({ quickAddDraft: draft }),
  setIsTemplatePickerOpen: (open) => set({ isTemplatePickerOpen: open }),
  setIsWeeklyReviewOpen: (open) => set({ isWeeklyReviewOpen: open }),
  setIsSmartFilterModalOpen: (open) => set({ isSmartFilterModalOpen: open }),
  setIsInterruptionModalOpen: (open) => set({ isInterruptionModalOpen: open }),
  setIsEveningShutdownOpen: (open) => set({ isEveningShutdownOpen: open }),
  dismissShutdown: () => set({ isShutdownDismissed: true }),
  setIsTriageDismissed: (dismissed) => set({ isTriageDismissed: dismissed }),
}));

// Granular selector hooks for high performance
export const useTheme = () => {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  return { theme, setTheme, toggleTheme };
};

export const useSound = () => {
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const soundProfile = useUIStore((s) => s.soundProfile);
  const toggleSound = useUIStore((s) => s.toggleSound);
  const setSoundProfile = useUIStore((s) => s.setSoundProfile);
  return { soundEnabled, soundProfile, toggleSound, setSoundProfile };
};

export const useActiveView = () => {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const viewLayout = useUIStore((s) => s.viewLayout);
  const setViewLayout = useUIStore((s) => s.setViewLayout);
  return { activeView, setActiveView, viewLayout, setViewLayout };
};

export const useSearchFilter = () => {
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const priorityFilter = useUIStore((s) => s.priorityFilter);
  const setPriorityFilter = useUIStore((s) => s.setPriorityFilter);
  const quickWinsOnly = useUIStore((s) => s.quickWinsOnly);
  const setQuickWinsOnly = useUIStore((s) => s.setQuickWinsOnly);
  return { searchQuery, setSearchQuery, priorityFilter, setPriorityFilter, quickWinsOnly, setQuickWinsOnly };
};

export const useTaskSelection = () => {
  const selectedTaskId = useUIStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);
  const selectedTaskIds = useUIStore((s) => s.selectedTaskIds);
  const toggleTaskSelection = useUIStore((s) => s.toggleTaskSelection);
  const selectTask = useUIStore((s) => s.selectTask);
  const deselectTask = useUIStore((s) => s.deselectTask);
  const selectAllTasks = useUIStore((s) => s.selectAllTasks);
  const clearTaskSelection = useUIStore((s) => s.clearTaskSelection);
  return {
    selectedTaskId,
    setSelectedTaskId,
    selectedTaskIds,
    toggleTaskSelection,
    selectTask,
    deselectTask,
    selectAllTasks,
    clearTaskSelection,
  };
};

export const useToast = () => {
  const toast = useUIStore((s) => s.toast);
  const showToast = useUIStore((s) => s.showToast);
  const clearToast = useUIStore((s) => s.clearToast);
  return { toast, showToast, clearToast };
};

export const useModals = () => {
  const isAuthModalOpen = useUIStore((s) => s.isAuthModalOpen);
  const setIsAuthModalOpen = useUIStore((s) => s.setIsAuthModalOpen);
  const isQuickAddOpen = useUIStore((s) => s.isQuickAddOpen);
  const setIsQuickAddOpen = useUIStore((s) => s.setIsQuickAddOpen);
  const quickAddDraft = useUIStore((s) => s.quickAddDraft);
  const setQuickAddDraft = useUIStore((s) => s.setQuickAddDraft);
  const isTemplatePickerOpen = useUIStore((s) => s.isTemplatePickerOpen);
  const setIsTemplatePickerOpen = useUIStore((s) => s.setIsTemplatePickerOpen);
  const isWeeklyReviewOpen = useUIStore((s) => s.isWeeklyReviewOpen);
  const setIsWeeklyReviewOpen = useUIStore((s) => s.setIsWeeklyReviewOpen);
  const isSmartFilterModalOpen = useUIStore((s) => s.isSmartFilterModalOpen);
  const setIsSmartFilterModalOpen = useUIStore((s) => s.setIsSmartFilterModalOpen);
  const isInterruptionModalOpen = useUIStore((s) => s.isInterruptionModalOpen);
  const setIsInterruptionModalOpen = useUIStore((s) => s.setIsInterruptionModalOpen);
  const isEveningShutdownOpen = useUIStore((s) => s.isEveningShutdownOpen);
  const setIsEveningShutdownOpen = useUIStore((s) => s.setIsEveningShutdownOpen);
  const isShutdownDismissed = useUIStore((s) => s.isShutdownDismissed);
  const dismissShutdown = useUIStore((s) => s.dismissShutdown);
  const isTriageDismissed = useUIStore((s) => s.isTriageDismissed);
  const setIsTriageDismissed = useUIStore((s) => s.setIsTriageDismissed);

  return {
    isAuthModalOpen,
    setIsAuthModalOpen,
    isQuickAddOpen,
    setIsQuickAddOpen,
    quickAddDraft,
    setQuickAddDraft,
    isTemplatePickerOpen,
    setIsTemplatePickerOpen,
    isWeeklyReviewOpen,
    setIsWeeklyReviewOpen,
    isSmartFilterModalOpen,
    setIsSmartFilterModalOpen,
    isInterruptionModalOpen,
    setIsInterruptionModalOpen,
    isEveningShutdownOpen,
    setIsEveningShutdownOpen,
    isShutdownDismissed,
    dismissShutdown,
    isTriageDismissed,
    setIsTriageDismissed,
  };
};
