import { create } from 'zustand';
import type { ViewId, Priority } from '../types/task';
import { audioEngine, type SoundProfile } from '../utils/audioEngine';

export type AppTheme = 'light' | 'dark' | 'tokyo' | 'nord' | 'matcha' | 'sepia' | 'crimson' | 'cobalt';

export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface UIState {
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
  const view = new URL(window.location.href).searchParams.get('view') || 'today';
  return /^(today|inbox|upcoming|projects|review|all|someday|timeline|matrix|kanban|insights|logbook|trash|archive|project:.+|smart:.+)$/.test(view)
    ? (view as ViewId)
    : 'today';
};

const getInitialTheme = (): AppTheme => {
  if (typeof localStorage === 'undefined') return 'light';
  const saved = localStorage.getItem('flowtask_theme') as AppTheme;
  return ['light', 'dark', 'tokyo', 'nord', 'matcha', 'sepia', 'crimson', 'cobalt'].includes(saved) ? saved : 'light';
};

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
      const url = new URL(window.location.href);
      url.searchParams.set('view', view);
      window.history.pushState({}, '', url);
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
      localStorage.setItem('flowtask_theme', theme);
    }
    document.documentElement.classList.remove(
      'dark',
      'theme-tokyo',
      'theme-nord',
      'theme-matcha',
      'theme-sepia',
      'theme-crimson',
      'theme-cobalt'
    );
    if (['dark', 'tokyo', 'nord', 'crimson', 'cobalt'].includes(theme)) document.documentElement.classList.add('dark');
    if (!['light', 'dark'].includes(theme)) document.documentElement.classList.add(`theme-${theme}`);
    document.documentElement.setAttribute('data-theme', theme);
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
    set({ toast: { message, actionLabel, onAction } });
  },
  clearToast: () => set({ toast: null }),

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
