import { create } from 'zustand';

export type ModalId =
  | 'quickAdd'
  | 'commandPalette'
  | 'shortcuts'
  | 'brainDump'
  | 'exportImport'
  | 'aesthetics'
  | 'auth'
  | 'eveningShutdown'
  | 'morningKickoff'
  | 'interruption'
  | 'scratchpad'
  | 'smartFilter'
  | 'templatePicker'
  | 'weeklyReview'
  | 'studySession'
  | 'studySprint'
  | 'pomodoro'
  | 'settings'
  | 'onboarding'
  | 'focusEngine'
  | 'captureHUD'
  | 'copilotOmnibar'
  | 'procrastinationWizard'
  | 'cleanSlate'
  | 'routineRunner';

export interface ModalState {
  activeModals: ModalId[];
  modalProps: Partial<Record<ModalId, Record<string, unknown>>>;

  // Primary Modal Actions
  openModal: <T extends Record<string, unknown> = Record<string, unknown>>(id: ModalId, props?: T) => void;
  closeModal: (id: ModalId) => void;
  closeTopModal: () => void;
  closeAllModals: () => void;
  isModalOpen: (id: ModalId) => boolean;
  getModalProps: <T = Record<string, unknown>>(id: ModalId) => T | undefined;
  hasAnyModalOpen: boolean;

  // Backward-Compatible Direct Flags
  isAuthModalOpen: boolean;
  isQuickAddOpen: boolean;
  quickAddDraft: string;
  isTemplatePickerOpen: boolean;
  isWeeklyReviewOpen: boolean;
  isSmartFilterModalOpen: boolean;
  isInterruptionModalOpen: boolean;
  isEveningShutdownOpen: boolean;
  isMorningKickoffOpen: boolean;
  isShutdownDismissed: boolean;
  isTriageDismissed: boolean;

  setIsAuthModalOpen: (open: boolean) => void;
  setIsQuickAddOpen: (open: boolean) => void;
  setQuickAddDraft: (draft: string) => void;
  setIsTemplatePickerOpen: (open: boolean) => void;
  setIsWeeklyReviewOpen: (open: boolean) => void;
  setIsSmartFilterModalOpen: (open: boolean) => void;
  setIsInterruptionModalOpen: (open: boolean) => void;
  setIsEveningShutdownOpen: (open: boolean) => void;
  setIsMorningKickoffOpen: (open: boolean) => void;
  dismissShutdown: () => void;
  setIsTriageDismissed: (dismissed: boolean) => void;
}

export const useModalStore = create<ModalState>((set, get) => ({
  activeModals: [],
  modalProps: {},
  hasAnyModalOpen: false,

  isAuthModalOpen: false,
  isQuickAddOpen: false,
  quickAddDraft: '',
  isTemplatePickerOpen: false,
  isWeeklyReviewOpen: false,
  isSmartFilterModalOpen: false,
  isInterruptionModalOpen: false,
  isEveningShutdownOpen: false,
  isMorningKickoffOpen: false,
  isShutdownDismissed: false,
  isTriageDismissed: false,

  openModal: <T extends Record<string, unknown> = Record<string, unknown>>(id: ModalId, props?: T) => {
    set((state) => {
      const alreadyOpen = state.activeModals.includes(id);
      const nextActive = alreadyOpen ? state.activeModals : [...state.activeModals, id];
      const nextProps = props ? { ...state.modalProps, [id]: props } : state.modalProps;

      const flagUpdates: Partial<ModalState> = {};
      if (id === 'auth') flagUpdates.isAuthModalOpen = true;
      if (id === 'quickAdd') flagUpdates.isQuickAddOpen = true;
      if (id === 'templatePicker') flagUpdates.isTemplatePickerOpen = true;
      if (id === 'weeklyReview') flagUpdates.isWeeklyReviewOpen = true;
      if (id === 'smartFilter') flagUpdates.isSmartFilterModalOpen = true;
      if (id === 'interruption') flagUpdates.isInterruptionModalOpen = true;
      if (id === 'eveningShutdown') flagUpdates.isEveningShutdownOpen = true;
      if (id === 'morningKickoff') flagUpdates.isMorningKickoffOpen = true;

      return {
        ...flagUpdates,
        activeModals: nextActive,
        modalProps: nextProps,
        hasAnyModalOpen: nextActive.length > 0,
      };
    });
  },

  closeModal: (id: ModalId) => {
    set((state) => {
      const nextActive = state.activeModals.filter((m) => m !== id);
      const nextProps = { ...state.modalProps };
      delete nextProps[id];

      const flagUpdates: Partial<ModalState> = {};
      if (id === 'auth') flagUpdates.isAuthModalOpen = false;
      if (id === 'quickAdd') flagUpdates.isQuickAddOpen = false;
      if (id === 'templatePicker') flagUpdates.isTemplatePickerOpen = false;
      if (id === 'weeklyReview') flagUpdates.isWeeklyReviewOpen = false;
      if (id === 'smartFilter') flagUpdates.isSmartFilterModalOpen = false;
      if (id === 'interruption') flagUpdates.isInterruptionModalOpen = false;
      if (id === 'eveningShutdown') flagUpdates.isEveningShutdownOpen = false;
      if (id === 'morningKickoff') flagUpdates.isMorningKickoffOpen = false;

      return {
        ...flagUpdates,
        activeModals: nextActive,
        modalProps: nextProps,
        hasAnyModalOpen: nextActive.length > 0,
      };
    });
  },

  closeTopModal: () => {
    const { activeModals, closeModal } = get();
    if (activeModals.length > 0) {
      closeModal(activeModals[activeModals.length - 1]);
    }
  },

  closeAllModals: () => {
    set({
      activeModals: [],
      modalProps: {},
      hasAnyModalOpen: false,
      isAuthModalOpen: false,
      isQuickAddOpen: false,
      isTemplatePickerOpen: false,
      isWeeklyReviewOpen: false,
      isSmartFilterModalOpen: false,
      isInterruptionModalOpen: false,
      isEveningShutdownOpen: false,
      isMorningKickoffOpen: false,
    });
  },

  isModalOpen: (id: ModalId) => {
    const state = get();
    if (state.activeModals.includes(id)) return true;
    if (id === 'auth') return state.isAuthModalOpen;
    if (id === 'quickAdd') return state.isQuickAddOpen;
    if (id === 'templatePicker') return state.isTemplatePickerOpen;
    if (id === 'weeklyReview') return state.isWeeklyReviewOpen;
    if (id === 'smartFilter') return state.isSmartFilterModalOpen;
    if (id === 'interruption') return state.isInterruptionModalOpen;
    if (id === 'eveningShutdown') return state.isEveningShutdownOpen;
    if (id === 'morningKickoff') return state.isMorningKickoffOpen;
    return false;
  },

  getModalProps: <T = Record<string, unknown>>(id: ModalId): T | undefined => {
    return get().modalProps[id] as T | undefined;
  },

  // Backward-Compatible Direct Flag Setters
  setIsAuthModalOpen: (open: boolean) => {
    if (open) get().openModal('auth');
    else get().closeModal('auth');
  },

  setIsQuickAddOpen: (open: boolean) => {
    if (open) get().openModal('quickAdd');
    else get().closeModal('quickAdd');
  },

  setQuickAddDraft: (draft: string) => {
    set({ quickAddDraft: draft });
  },

  setIsTemplatePickerOpen: (open: boolean) => {
    if (open) get().openModal('templatePicker');
    else get().closeModal('templatePicker');
  },

  setIsWeeklyReviewOpen: (open: boolean) => {
    if (open) get().openModal('weeklyReview');
    else get().closeModal('weeklyReview');
  },

  setIsSmartFilterModalOpen: (open: boolean) => {
    if (open) get().openModal('smartFilter');
    else get().closeModal('smartFilter');
  },

  setIsInterruptionModalOpen: (open: boolean) => {
    if (open) get().openModal('interruption');
    else get().closeModal('interruption');
  },

  setIsEveningShutdownOpen: (open: boolean) => {
    if (open) get().openModal('eveningShutdown');
    else get().closeModal('eveningShutdown');
  },

  setIsMorningKickoffOpen: (open: boolean) => {
    if (open) get().openModal('morningKickoff');
    else get().closeModal('morningKickoff');
  },

  dismissShutdown: () => {
    set({ isShutdownDismissed: true, isEveningShutdownOpen: false });
  },

  setIsTriageDismissed: (dismissed: boolean) => {
    set({ isTriageDismissed: dismissed });
  },
}));
