import React, { lazy, Suspense, useEffect } from 'react';
import { useModal } from '../../context/ModalContext';
import { useTaskContext } from '../../context/TaskContext';
import { useTaskStore } from '../../store/useTaskStore';
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
const CopilotDrawer = lazy(() => import('./CopilotDrawer').then(m => ({ default: m.CopilotDrawer })));
const GlobalCaptureHUD = lazy(() => import('../capture/GlobalCaptureHUD').then(m => ({ default: m.GlobalCaptureHUD })));
const ProcrastinationWizardModal = lazy(() => import('./ProcrastinationWizardModal').then(m => ({ default: m.ProcrastinationWizardModal })));
const CleanSlateModal = lazy(() => import('./CleanSlateModal').then(m => ({ default: m.CleanSlateModal })));
const RoutineRunner = lazy(() => import('../workflow/RoutineRunner').then(m => ({ default: m.RoutineRunner })));
import { OnboardingFlow } from './OnboardingFlow';

import type { SettingsTab } from './SettingsDrawer';

interface ModalRootProps {
  onSelectTask?: (taskId: string) => void;
  onStartStudySprint?: (taskId: string) => void;
}

export const ModalRoot: React.FC<ModalRootProps> = ({ onSelectTask, onStartStudySprint }) => {
  const { isModalOpen, closeModal, openModal, getModalProps, activeModals, closeAllModals } = useModal();
  const { setSelectedTaskId, tasks, applyTaskChanges, showToast } = useTaskContext();

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

        {/* Universal Multi-Provider AI Copilot Drawer (Cmd+J) */}
        {isModalOpen('copilotOmnibar') && (
          <CopilotDrawer
            isOpen={true}
            onClose={() => closeModal('copilotOmnibar')}
            targetTaskId={getModalProps<{ taskId?: string }>('copilotOmnibar')?.taskId}
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

        {/* Omnichannel Quick-Capture HUD */}
        {isModalOpen('captureHUD') && (
          <GlobalCaptureHUD
            isOpen={true}
            onClose={() => closeModal('captureHUD')}
          />
        )}

        {/* Procrastination Diagnostic Wizard */}
        {isModalOpen('procrastinationWizard') && (() => {
          const props = getModalProps<{ taskId?: string; task?: any }>('procrastinationWizard');
          const targetTask = props?.task || tasks.find((t: any) => t.id === props?.taskId) || tasks[0];
          if (!targetTask) return null;
          return (
            <ProcrastinationWizardModal
              isOpen={true}
              task={targetTask}
              onClose={() => closeModal('procrastinationWizard')}
              onAddSubtasks={(taskId: string, subtaskTitles: string[]) => {
                useTaskStore.getState().addSubTasks(taskId, subtaskTitles.map((t: string) => ({ title: t })));
                showToast(`Added ${subtaskTitles.length} micro-steps to overcome resistance.`);
              }}
              onStartSprint={(taskId: string) => {
                closeModal('procrastinationWizard');
                openModal('pomodoro', { taskId });
              }}
            />
          );
        })()}

        {/* Clean Slate Backlog Quarantine */}
        {isModalOpen('cleanSlate') && (
          <CleanSlateModal
            isOpen={true}
            tasks={tasks}
            onClose={() => closeModal('cleanSlate')}
            onApplyQuarantine={(updatedTasks: any[], count: number) => {
              applyTaskChanges(
                updatedTasks.map((t: any) => ({ id: t.id, updates: { isSomeday: t.isSomeday, cleanSlateQuarantinedAt: t.cleanSlateQuarantinedAt } })),
                'Quarantine overdue tasks'
              );
              showToast(`Clean Slate activated: ${count} overdue tasks quarantined.`);
            }}
          />
        )}

        {/* Paced Routine Runner */}
        {isModalOpen('routineRunner') && (() => {
          const routineProps = getModalProps<{ routine?: any }>('routineRunner');
          const routine = routineProps?.routine || {
            id: 'routine-morning-launch',
            title: 'Morning Launch Sequence',
            cadence: 'morning',
            steps: [
              { id: 'step-1', title: 'Hydrate & 5 deep breaths', durationMinutes: 2 },
              { id: 'step-2', title: 'Review Top 3 Focus priorities', durationMinutes: 3 },
              { id: 'step-3', title: 'Clear clutter from workspace', durationMinutes: 5 },
            ],
          };
          return (
            <RoutineRunner
              isOpen={true}
              routine={routine}
              onClose={() => closeModal('routineRunner')}
              onCompleteRoutine={() => {
                showToast('Launch routine complete! You have built calm momentum.');
              }}
            />
          );
        })()}
      </Suspense>
    </FeatureBoundary>
  );
};
