import React, { useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { QuickAddModal } from '../tasks/QuickAddModal';
import { TaskDrawer } from '../tasks/TaskDrawer';
import { BatchActionBar } from '../tasks/BatchActionBar';
import { ModalRoot } from '../modals/ModalRoot';
import { FocusPipPortal } from '../focus/FocusPipPortal';
import { Toast } from '../ui/Toast';

export interface AppShellProps {
  // Sidebar props
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isSidebarOpenMobile: boolean;
  onCloseMobileSidebar: () => void;
  onOpenMobileSidebar: () => void;

  // Sidebar actions
  onOpenPomodoro: () => void;
  onOpenShortcuts: () => void;
  onOpenExportImport: () => void;
  onOpenBrainDump: () => void;
  onOpenAesthetics: () => void;
  onOpenScratchpad: () => void;
  onOpenStudySession: () => void;
  onOpenSettings: () => void;

  // Header and content
  desktopHeader: React.ReactNode;
  mobileHeader: React.ReactNode;
  children: React.ReactNode;

  // Mobile Bottom Nav props
  activeView: string;
  onSelectView: (viewId: string) => void;
  onQuickAdd: () => void;
  todayCount: number;
  inboxCount: number;
  upcomingCount: number;

  // Task Drawer props
  selectedTaskId: string | null;
  onCloseDrawer: () => void;
  onStartFocus: (taskId: string) => void;
  onStartSprint?: (taskId: string) => void;

  // Aurora & Modal states
  isPomodoroOpen: boolean;
  onSelectTaskFromModalRoot: (id: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  isSidebarOpenMobile,
  onCloseMobileSidebar,
  onOpenMobileSidebar,
  onOpenPomodoro,
  onOpenShortcuts,
  onOpenExportImport,
  onOpenBrainDump,
  onOpenAesthetics,
  onOpenScratchpad,
  onOpenStudySession,
  onOpenSettings,
  desktopHeader,
  mobileHeader,
  children,
  activeView,
  onSelectView,
  onQuickAdd,
  todayCount,
  inboxCount,
  upcomingCount,
  selectedTaskId,
  onCloseDrawer,
  onStartFocus,
  onStartSprint,
  isPomodoroOpen,
  onSelectTaskFromModalRoot,
}) => {
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(mobileDrawerRef, onCloseMobileSidebar, isSidebarOpenMobile);
  return (
    <div className="flowtask-workspace relative flex h-screen w-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Skip to Main Content Link (WCAG 2.2 Level A / AA) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white text-xs font-bold shadow-elevated focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Aurora Atmosphere */}
      <div
        className="workspace-aurora pointer-events-none absolute inset-0 overflow-hidden select-none"
        aria-hidden="true"
        style={{
          opacity: 'var(--diurnal-intensity, 0)',
          display: isPomodoroOpen ? 'none' : undefined,
        }}
      >
        <div className="workspace-atmosphere-edge" />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block relative z-30 transition-all duration-200">
        <Sidebar
          onOpenPomodoro={onOpenPomodoro}
          onOpenShortcuts={onOpenShortcuts}
          onOpenExportImport={onOpenExportImport}
          onOpenBrainDump={onOpenBrainDump}
          onOpenAesthetics={onOpenAesthetics}
          onOpenScratchpad={onOpenScratchpad}
          onOpenStudySession={onOpenStudySession}
          onOpenSettings={onOpenSettings}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={onToggleSidebar}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isSidebarOpenMobile && (
          <motion.div
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onCloseMobileSidebar}
          >
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="w-[min(320px,85vw)] h-full bg-[var(--bg-surface-l1)] shadow-2xl border-r border-[var(--border-hairline)]"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar
                onItemClick={onCloseMobileSidebar}
                isMobileDrawer={true}
                onOpenPomodoro={() => {
                  onCloseMobileSidebar();
                  onOpenPomodoro();
                }}
                onOpenShortcuts={() => {
                  onCloseMobileSidebar();
                  onOpenShortcuts();
                }}
                onOpenExportImport={() => {
                  onCloseMobileSidebar();
                  onOpenExportImport();
                }}
                onOpenBrainDump={() => {
                  onCloseMobileSidebar();
                  onOpenBrainDump();
                }}
                onOpenAesthetics={() => {
                  onCloseMobileSidebar();
                  onOpenAesthetics();
                }}
                onOpenScratchpad={() => {
                  onCloseMobileSidebar();
                  onOpenScratchpad();
                }}
                onOpenStudySession={() => {
                  onCloseMobileSidebar();
                  onOpenStudySession();
                }}
                onOpenSettings={() => {
                  onCloseMobileSidebar();
                  onOpenSettings();
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col h-full overflow-hidden relative z-10 focus:outline-none"
      >
        {desktopHeader}
        {mobileHeader}
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeView={activeView}
        onSelectView={onSelectView}
        onQuickAdd={onQuickAdd}
        onOpenMenu={onOpenMobileSidebar}
        todayCount={todayCount}
        inboxCount={inboxCount}
        upcomingCount={upcomingCount}
      />

      {/* Universal Quick Capture Composer Modal */}
      <QuickAddModal />

      {/* Slide-over Task Detail Drawer */}
      <AnimatePresence>
        {selectedTaskId && (
          <TaskDrawer
            key="slide-over-task-drawer"
            taskId={selectedTaskId}
            onClose={onCloseDrawer}
            onStartFocus={onStartFocus}
            onStartSprint={onStartSprint}
          />
        )}
      </AnimatePresence>

      {/* Batch Actions Dock */}
      <BatchActionBar />

      {/* Centralized Modal & Slide-Over Root */}
      <ModalRoot
        onSelectTask={onSelectTaskFromModalRoot}
        onStartStudySprint={onStartSprint}
      />

      {/* Document Picture-in-Picture Floating HUD */}
      <FocusPipPortal />

      {/* Global Toast */}
      <Toast />
    </div>
  );
};
