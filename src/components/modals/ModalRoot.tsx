import React from 'react';
import { useModal } from '../../context/ModalContext';
import { useTaskContext } from '../../context/TaskContext';

// Modals
import { CommandPalette } from './CommandPalette';
import { ShortcutsModal } from './ShortcutsModal';
import { BrainDumpModal } from './BrainDumpModal';
import { ExportImportModal } from './ExportImportModal';
import { AestheticsModal } from './AestheticsModal';
import { AuthModal } from './AuthModal';
import { EveningShutdownModal } from './EveningShutdownModal';
import { InterruptionModal } from './InterruptionModal';
import { ScratchpadModal } from './ScratchpadModal';
import { SmartFilterModal } from './SmartFilterModal';
import { TemplatePickerModal } from './TemplatePickerModal';
import { WeeklyReviewModal } from './WeeklyReviewModal';
import { StudySessionModal } from './StudySessionModal';
import { StudySprintRunnerModal } from '../focus/StudySprintRunnerModal';
import { PomodoroModal } from '../focus/PomodoroModal';
import { SettingsDrawer } from './SettingsDrawer';
import { OnboardingFlow } from './OnboardingFlow';

interface ModalRootProps {
  onSelectTask?: (taskId: string) => void;
  onStartStudySprint?: (taskId: string) => void;
}

export const ModalRoot: React.FC<ModalRootProps> = ({ onSelectTask, onStartStudySprint }) => {
  const { isModalOpen, closeModal, openModal, getModalProps } = useModal();
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    isSmartFilterModalOpen,
    setIsSmartFilterModalOpen,
    isEveningShutdownOpen,
    setIsEveningShutdownOpen,
    isWeeklyReviewOpen,
    setIsWeeklyReviewOpen,
    setSelectedTaskId,
  } = useTaskContext();

  const handleSelectTask = onSelectTask || ((id: string) => setSelectedTaskId(id));

  return (
    <>
      {/* Centralized Settings Slide-Over Panel */}
      {isModalOpen('settings') && (
        <SettingsDrawer
          isOpen={true}
          onClose={() => closeModal('settings')}
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
          onOpenAesthetics={() => openModal('aesthetics')}
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

      {/* Aesthetics & Themes Customization */}
      {isModalOpen('aesthetics') && (
        <AestheticsModal
          isOpen={true}
          onClose={() => closeModal('aesthetics')}
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

      {/* Pomodoro Focus Modal */}
      {isModalOpen('pomodoro') && (
        <PomodoroModal
          taskId={getModalProps<{ taskId?: string | null }>('pomodoro')?.taskId || null}
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
      <InterruptionModal />

      {/* Template Picker */}
      <TemplatePickerModal />
    </>
  );
};
