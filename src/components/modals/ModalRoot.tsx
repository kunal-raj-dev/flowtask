import React, { lazy, Suspense, useEffect } from 'react';
import { useModal } from '../../context/ModalContext';
import { useTaskContext } from '../../context/TaskContext';
import { useUIStore } from '../../store/useUIStore';
import { ModalSkeleton } from '../ui';
import { FeatureBoundary } from '../ui/FeatureBoundary';

// Modals
const CommandPalette = lazy(() => import('./CommandPalette').then(m => ({ default: m.CommandPalette })));
const ShortcutsModal = lazy(() => import('./ShortcutsModal').then(m => ({ default: m.ShortcutsModal })));
const BrainDumpModal = lazy(() => import('./BrainDumpModal').then(m => ({ default: m.BrainDumpModal })));
const ExportImportModal = lazy(() => import('./ExportImportModal').then(m => ({ default: m.ExportImportModal })));
const AuthModal = lazy(() => import('./AuthModal').then(m => ({ default: m.AuthModal })));
const EveningShutdownModal = lazy(() => import('./EveningShutdownModal').then(m => ({ default: m.EveningShutdownModal })));
const MorningKickoffModal = lazy(() => import('./MorningKickoffModal').then(m => ({ default: m.MorningKickoffModal })));
const InterruptionModal = lazy(() => import('./InterruptionModal').then(m => ({ default: m.InterruptionModal })));
const ScratchpadModal = lazy(() => import('./ScratchpadModal').then(m => ({ default: m.ScratchpadModal })));
const SmartFilterModal = lazy(() => import('./SmartFilterModal').then(m => ({ default: m.SmartFilterModal })));
const TemplatePickerModal = lazy(() => import('./TemplatePickerModal').then(m => ({ default: m.TemplatePickerModal })));
const WeeklyReviewModal = lazy(() => import('./WeeklyReviewModal').then(m => ({ default: m.WeeklyReviewModal })));
const StudySessionModal = lazy(() => import('./StudySessionModal').then(m => ({ default: m.StudySessionModal })));
const StudySprintRunnerModal = lazy(() => import('../focus/StudySprintRunnerModal').then(m => ({ default: m.StudySprintRunnerModal })));
const PomodoroModal = lazy(() => import('../focus/FocusStudio').then(m => ({ default: m.FocusStudio })));
const SettingsDrawer = lazy(() => import('./SettingsDrawer').then(m => ({ default: m.SettingsDrawer })));
const OnboardingFlow = lazy(() => import('./OnboardingFlow').then(m => ({ default: m.OnboardingFlow })));

import type { SettingsTab } from './SettingsDrawer';

interface ModalRootProps {
  onSelectTask?: (taskId: string) => void;
  onStartStudySprint?: (taskId: string) => void;
}

export const ModalRoot: React.FC<ModalRootProps> = ({ onSelectTask, onStartStudySprint }) => {
  const { isModalOpen, closeModal, openModal, getModalProps, activeModals } = useModal();
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    isSmartFilterModalOpen,
    setIsSmartFilterModalOpen,
    isEveningShutdownOpen,
    setIsEveningShutdownOpen,
    isWeeklyReviewOpen,
    isInterruptionModalOpen,
    isTemplatePickerOpen,
    setIsInterruptionModalOpen,
    setIsTemplatePickerOpen,
    setIsWeeklyReviewOpen,
    setSelectedTaskId,
  } = useTaskContext();

  const isMorningKickoffOpen = useUIStore((s) => s.isMorningKickoffOpen);
  const setIsMorningKickoffOpen = useUIStore((s) => s.setIsMorningKickoffOpen);

  const handleSelectTask = onSelectTask || ((id: string) => setSelectedTaskId(id));

  // Centralized Escape key dismissal for all active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;

      if (activeModals.length > 0) {
        const topModal = activeModals[activeModals.length - 1];
        if (topModal === 'pomodoro' || topModal === 'studySprint') {
          // If in Zen fullscreen mode, let focus modal handle exiting fullscreen first
          if (document.fullscreenElement || document.querySelector('[aria-label="Zen Focus Mode"]')) {
            return;
          }
        }
        e.preventDefault();
        closeModal(topModal);
        if (topModal === 'auth') setIsAuthModalOpen(false);
        if (topModal === 'eveningShutdown') setIsEveningShutdownOpen(false);
        if (topModal === 'morningKickoff') setIsMorningKickoffOpen(false);
        if (topModal === 'weeklyReview') setIsWeeklyReviewOpen(false);
        if (topModal === 'smartFilter') setIsSmartFilterModalOpen(false);
        return;
      }

      // Fallback for standalone TaskContext modals
      if (isAuthModalOpen) {
        e.preventDefault();
        setIsAuthModalOpen(false);
        closeModal('auth');
      } else if (isEveningShutdownOpen) {
        e.preventDefault();
        setIsEveningShutdownOpen(false);
        closeModal('eveningShutdown');
      } else if (isMorningKickoffOpen) {
        e.preventDefault();
        setIsMorningKickoffOpen(false);
        closeModal('morningKickoff');
      } else if (isWeeklyReviewOpen) {
        e.preventDefault();
        setIsWeeklyReviewOpen(false);
        closeModal('weeklyReview');
      } else if (isSmartFilterModalOpen) {
        e.preventDefault();
        setIsSmartFilterModalOpen(false);
        closeModal('smartFilter');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeModals,
    closeModal,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isEveningShutdownOpen,
    setIsEveningShutdownOpen,
    isWeeklyReviewOpen,
    setIsWeeklyReviewOpen,
    isSmartFilterModalOpen,
    setIsSmartFilterModalOpen,
    isMorningKickoffOpen,
    setIsMorningKickoffOpen,
  ]);

  return (
    <FeatureBoundary resetKey={JSON.stringify([activeModals, isAuthModalOpen, isEveningShutdownOpen, isWeeklyReviewOpen, isSmartFilterModalOpen, isInterruptionModalOpen, isTemplatePickerOpen])} title="This panel" modal onBack={() => {
      activeModals.forEach(closeModal);
      setIsAuthModalOpen(false); setIsEveningShutdownOpen(false); setIsWeeklyReviewOpen(false); setIsSmartFilterModalOpen(false); setIsInterruptionModalOpen(false); setIsTemplatePickerOpen(false);
    }}>
    <Suspense fallback={activeModals.length || isAuthModalOpen || isEveningShutdownOpen || isWeeklyReviewOpen || isSmartFilterModalOpen || isInterruptionModalOpen || isTemplatePickerOpen ? <ModalSkeleton /> : null}>
      {/* Centralized Settings Slide-Over Panel */}
      {isModalOpen('settings') && (
        <SettingsDrawer
          isOpen={true}
          onClose={() => closeModal('settings')}
          initialTab={getModalProps<{ initialTab?: SettingsTab }>('settings')?.initialTab}
        />
      )}

      {/* Guided Onboarding Flow */}
      {isModalOpen('onboarding') && (
        <OnboardingFlow
          isOpen={true}
          onClose={() => closeModal('onboarding')}
        />
      )}

      {/* Command Palette */}
      {isModalOpen('commandPalette') && (
        <CommandPalette
          isOpen={true}
          onClose={() => closeModal('commandPalette')}
          onSelectTask={handleSelectTask}
          onOpenPomodoro={() => openModal('pomodoro')}
          onOpenBrainDump={() => openModal('brainDump')}
          onOpenExportImport={() => openModal('exportImport')}
          onOpenAesthetics={() => openModal('settings', { initialTab: 'aesthetics' })}
          onOpenScratchpad={() => openModal('scratchpad')}
          onOpenStudySession={() => openModal('studySession')}
        />
      )}

      {/* Keyboard Shortcuts Cheatsheet */}
      {isModalOpen('shortcuts') && (
        <ShortcutsModal onClose={() => closeModal('shortcuts')} />
      )}

      {/* Brain Dump Rapid Ingestion */}
      {isModalOpen('brainDump') && (
        <BrainDumpModal onClose={() => closeModal('brainDump')} />
      )}

      {/* Data Export / Import Modal */}
      {isModalOpen('exportImport') && (
        <ExportImportModal onClose={() => closeModal('exportImport')} />
      )}

      {/* Aesthetics & Themes Customization via SettingsDrawer */}
      {isModalOpen('aesthetics') && (
        <SettingsDrawer
          isOpen={true}
          onClose={() => closeModal('aesthetics')}
          initialTab="aesthetics"
        />
      )}

      {/* Authentication & Cloud Sync Modal */}
      {(isAuthModalOpen || isModalOpen('auth')) && (
        <AuthModal
          isOpen={true}
          onClose={() => {
            setIsAuthModalOpen(false);
            closeModal('auth');
          }}
        />
      )}

      {/* Evening Shutdown Ritual */}
      {(isEveningShutdownOpen || isModalOpen('eveningShutdown')) && (
        <EveningShutdownModal
          onClose={() => {
            setIsEveningShutdownOpen(false);
            closeModal('eveningShutdown');
          }}
        />
      )}

      {/* Morning Kickoff Ritual */}
      {(isMorningKickoffOpen || isModalOpen('morningKickoff')) && (
        <MorningKickoffModal
          onClose={() => {
            setIsMorningKickoffOpen(false);
            closeModal('morningKickoff');
          }}
        />
      )}

      {/* Pomodoro Focus Modal */}
      {isModalOpen('pomodoro') && (
        <PomodoroModal
          taskId={getModalProps<{ taskId?: string | null }>('pomodoro')?.taskId || null}
          initialPhase={getModalProps<{ initialPhase?: 'focus' | 'short_break' | 'long_break' }>('pomodoro')?.initialPhase}
          initialPanel={getModalProps<{ initialPanel?: 'sound' | 'timer' }>('pomodoro')?.initialPanel}
          onClose={() => closeModal('pomodoro')}
        />
      )}

      {/* Study Session Modal */}
      {isModalOpen('studySession') && (
        <StudySessionModal
          isOpen={true}
          onClose={() => closeModal('studySession')}
          onStartSprint={onStartStudySprint}
        />
      )}

      {/* Study Sprint Runner */}
      {isModalOpen('studySprint') && (
        <StudySprintRunnerModal
          isOpen={true}
          taskId={getModalProps<{ taskId?: string | null }>('studySprint')?.taskId || null}
          onClose={() => closeModal('studySprint')}
        />
      )}

      {/* Sticky Scratchpad */}
      {isModalOpen('scratchpad') && (
        <ScratchpadModal
          isOpen={true}
          onClose={() => closeModal('scratchpad')}
        />
      )}

      {/* Smart Filter View Creator */}
      {(isSmartFilterModalOpen || isModalOpen('smartFilter')) && (
        <SmartFilterModal
          isOpen={true}
          onClose={() => {
            setIsSmartFilterModalOpen(false);
            closeModal('smartFilter');
          }}
        />
      )}

      {/* Weekly Review & Retrospective */}
      {(isWeeklyReviewOpen || isModalOpen('weeklyReview')) && (
        <WeeklyReviewModal
          isOpen={true}
          onClose={() => {
            setIsWeeklyReviewOpen(false);
            closeModal('weeklyReview');
          }}
          onOpenTask={handleSelectTask}
        />
      )}

      {/* Interruption Stash & Scratchpad Modal */}
      {isInterruptionModalOpen && <InterruptionModal />}

      {/* Template Picker */}
      {isTemplatePickerOpen && <TemplatePickerModal />}
    </Suspense>
    </FeatureBoundary>
  );
};
