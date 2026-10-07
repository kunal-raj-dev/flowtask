import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

export type ModalType =
  | 'quickAdd'
  | 'commandPalette'
  | 'shortcuts'
  | 'brainDump'
  | 'exportImport'
  | 'aesthetics'
  | 'auth'
  | 'eveningShutdown'
  | 'interruption'
  | 'scratchpad'
  | 'smartFilter'
  | 'templatePicker'
  | 'weeklyReview'
  | 'studySession'
  | 'studySprint'
  | 'pomodoro'
  | 'settings'
  | 'onboarding';

export interface ModalContextType {
  openModal: (type: ModalType, props?: Record<string, any>) => void;
  closeModal: (type: ModalType) => void;
  closeAllModals: () => void;
  isModalOpen: (type: ModalType) => boolean;
  getModalProps: <T = Record<string, any>>(type: ModalType) => T | undefined;
  activeModals: ModalType[];
  hasAnyModalOpen: boolean;
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<{
    active: ModalType[];
    propsMap: Partial<Record<ModalType, any>>;
  }>({
    active: [],
    propsMap: {},
  });

  const openModal = useCallback((type: ModalType, props?: Record<string, any>) => {
    setModalState((prev) => {
      const alreadyOpen = prev.active.includes(type);
      return {
        active: alreadyOpen ? prev.active : [...prev.active, type],
        propsMap: {
          ...prev.propsMap,
          [type]: props || {},
        },
      };
    });
  }, []);

  const closeModal = useCallback((type: ModalType) => {
    setModalState((prev) => ({
      active: prev.active.filter((m) => m !== type),
      propsMap: {
        ...prev.propsMap,
        [type]: undefined,
      },
    }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModalState({
      active: [],
      propsMap: {},
    });
  }, []);

  const isModalOpen = useCallback(
    (type: ModalType) => modalState.active.includes(type),
    [modalState.active]
  );

  const getModalProps = useCallback(
    <T = Record<string, any>>(type: ModalType): T | undefined => {
      return modalState.propsMap[type] as T | undefined;
    },
    [modalState.propsMap]
  );

  const hasAnyModalOpen = modalState.active.length > 0;

  const value = useMemo(
    () => ({
      openModal,
      closeModal,
      closeAllModals,
      isModalOpen,
      getModalProps,
      activeModals: modalState.active,
      hasAnyModalOpen,
    }),
    [openModal, closeModal, closeAllModals, isModalOpen, getModalProps, modalState.active, hasAnyModalOpen]
  );

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
