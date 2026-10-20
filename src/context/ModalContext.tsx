import React, { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useModalStore, type ModalId } from '../store/useModalStore';

export type ModalType = ModalId;

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
  useEffect(() => {
    return () => {
      useModalStore.getState().closeAllModals();
    };
  }, []);

  const activeModals = useModalStore((s) => s.activeModals);
  const openModal = useModalStore((s) => s.openModal);
  const closeModal = useModalStore((s) => s.closeModal);
  const closeAllModals = useModalStore((s) => s.closeAllModals);
  const isModalOpen = useModalStore((s) => s.isModalOpen);
  const getModalProps = useModalStore((s) => s.getModalProps);
  const hasAnyModalOpen = activeModals.length > 0;

  const value = useMemo<ModalContextType>(
    () => ({
      openModal,
      closeModal,
      closeAllModals,
      isModalOpen,
      getModalProps,
      activeModals,
      hasAnyModalOpen,
    }),
    [openModal, closeModal, closeAllModals, isModalOpen, getModalProps, activeModals, hasAnyModalOpen]
  );

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);

  const activeModals = useModalStore((s) => s.activeModals);
  const openModal = useModalStore((s) => s.openModal);
  const closeModal = useModalStore((s) => s.closeModal);
  const closeAllModals = useModalStore((s) => s.closeAllModals);
  const isModalOpen = useModalStore((s) => s.isModalOpen);
  const getModalProps = useModalStore((s) => s.getModalProps);

  if (context) return context;

  return {
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    getModalProps,
    activeModals,
    hasAnyModalOpen: activeModals.length > 0,
  };
};
