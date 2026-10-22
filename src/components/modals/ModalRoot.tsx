import React, { lazy, Suspense, useEffect } from 'react';
import { useModal } from '../../context/ModalContext';
import { useTaskContext } from '../../context/TaskContext';
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
const FocusEngineModal = lazy(() => import('../focus/FocusEngineModal').then(m => ({ default: m.FocusEngineModal })));
const FocusStudio = lazy(() => import('../focus/FocusStudio').then(m => ({ default: m.FocusStudio })));
const SettingsDrawer = lazy(() => import('./SettingsDrawer').then(m => ({ default: m.SettingsDrawer })));
const CopilotOmnibar = lazy(() => import('./CopilotOmnibar').then(m => ({ default: m.CopilotOmnibar })));
import { OnboardingFlow } from './OnboardingFlow';

import type { SettingsTab } from './SettingsDrawer';

interface ModalRootProps {
  onSelectTask?: (taskId: string) => void;
  onStartStudySprint?: (taskId: string) => void;
}

export const ModalRoot: React.FC<ModalRootProps> = ({ onSelectTask, onStartStudySprint }) => {
  const { isModalOpen, closeModal, openModal, getModalProps, activeModals, closeAllModals } = useModal();
  const { setSelectedTaskId } = useTaskContext();

  const handleSelectTask = onSelectTask || ((id: string) => setSelectedTaskId(id));

  // Centralized Escape key dismissal for all active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;

      if (activeModals.length > 0) {
        const topModal = activeModals[activeModals.length - 1];
        if (topModal === 'pomodoro' || topModal === 'studySprint' || topModal === 'focusEngine') {
          // If in Zen fullscreen mode, let focus modal handle exiting fullscreen first
          if (document.fullscreenElement || document.querySelector('[aria-label="Zen Focus Mode"]')) {
            return;
          }
        }
        e.preventDefault();
        closeModal(topModal);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModals, closeModal]);

  return (
    <FeatureBoundary
      resetKey={JSON.stringify(activeModals)}
      title="This panel"
      modal
      onBack={closeAllModals}
    >
      <Suspense fallback={activeModals.length > 0 ? <ModalSkeleton /> : null}>
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
        {isModalOpen('auth') && (
          <AuthModal
            isOpen={true}
            onClose={() => closeModal('auth')}
          />
        )}

        {/* Evening Shutdown Ritual */}
        {isModalOpen('eveningShutdown') && (
          <EveningShutdownModal
            onClose={() => closeModal('eveningShutdown')}
          />
        )}

        {/* Morning Kickoff Ritual */}
        {isModalOpen('morningKickoff') && (
          <MorningKickoffModal
            onClose={() => closeModal('morningKickoff')}
          />
        )}

        {/* Pomodoro Focus Modal via FocusEngineModal */}
        {isModalOpen('pomodoro') && (
          <FocusStudio
            taskId={getModalProps<{ taskId?: string | null }>('pomodoro')?.taskId || null}
            initialPhase={getModalProps<{ initialPhase?: 'focus' | 'short_break' | 'long_break' }>('pomodoro')?.initialPhase}
            initialPanel={getModalProps<{ initialPanel?: 'scenes' | 'sound' | 'recipes' | 'notes' | 'timer' | 'queue' }>('pomodoro')?.initialPanel}
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

        {/* Study Sprint Runner via FocusEngineModal */}
        {isModalOpen('studySprint') && (
          <FocusEngineModal
            isOpen={true}
            taskId={getModalProps<{ taskId?: string | null }>('studySprint')?.taskId || null}
            initialMode={getModalProps<{ initialMode?: 'zen' | 'studio' | 'sprint' }>('studySprint')?.initialMode || 'sprint'}
            onClose={() => closeModal('studySprint')}
          />
        )}

        {/* Unified Focus Engine Modal */}
        {isModalOpen('focusEngine') && (
          <FocusEngineModal
            isOpen={true}
            taskId={getModalProps<{ taskId?: string | null }>('focusEngine')?.taskId || null}
            initialMode={getModalProps<{ initialMode?: 'zen' | 'studio' | 'sprint' }>('focusEngine')?.initialMode || 'zen'}
            initialPhase={getModalProps<{ initialPhase?: string }>('focusEngine')?.initialPhase}
            initialPanel={getModalProps<{ initialPanel?: string }>('focusEngine')?.initialPanel}
            onClose={() => closeModal('focusEngine')}
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
        {isModalOpen('smartFilter') && (
          <SmartFilterModal
            isOpen={true}
            onClose={() => closeModal('smartFilter')}
          />
        )}

        {/* Weekly Review & Retrospective */}
        {isModalOpen('weeklyReview') && (
          <WeeklyReviewModal
            isOpen={true}
            onClose={() => closeModal('weeklyReview')}
            onOpenTask={handleSelectTask}
          />
        )}

        {/* Interruption Stash & Scratchpad Modal */}
        {isModalOpen('interruption') && <InterruptionModal />}

        {/* Template Picker */}
        {isModalOpen('templatePicker') && <TemplatePickerModal />}

        {/* FlowTask Copilot Omnibar */}
        {isModalOpen('copilotOmnibar') && (
          <CopilotOmnibar
            isOpen={true}
            onClose={() => closeModal('copilotOmnibar')}
          />
        )}
      </Suspense>
    </FeatureBoundary>
  );
};
