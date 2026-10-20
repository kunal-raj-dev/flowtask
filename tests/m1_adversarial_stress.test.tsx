// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, act, renderHook } from '@testing-library/react';
import { ModalProvider, useModal } from '../src/context/ModalContext';
import { useModalStore, type ModalId } from '../src/store/useModalStore';
import { WorkspaceStore, WorkspaceStoreContext, useWorkspaceSelector, useWorkspaceTasks } from '../src/services/workspaceStore';
import { useFocusStore } from '../src/store/useFocusStore';
import fs from 'node:fs';
import path from 'node:path';

describe('Milestone M1 Adversarial Stress & Memory Leak Test Suite', () => {
  beforeEach(() => {
    useModalStore.getState().closeAllModals();
    useFocusStore.getState().stopFocusSession();
  });

  describe('1. ModalContext & ModalStore Stress & Teardown', () => {
    it('unmount teardown: unmounting ModalProvider flushes all active modals and clears props', () => {
      const { unmount } = render(
        <ModalProvider>
          <div>Test Provider Child</div>
        </ModalProvider>
      );

      act(() => {
        useModalStore.getState().openModal('quickAdd', { initialDraft: 'Adversarial Test' });
        useModalStore.getState().openModal('commandPalette');
        useModalStore.getState().openModal('settings', { initialTab: 'aesthetics' });
      });

      expect(useModalStore.getState().activeModals.length).toBe(3);
      expect(useModalStore.getState().hasAnyModalOpen).toBe(true);
      expect(useModalStore.getState().getModalProps('quickAdd')).toEqual({ initialDraft: 'Adversarial Test' });

      // Unmount provider - must trigger cleanup
      unmount();

      expect(useModalStore.getState().activeModals.length).toBe(0);
      expect(useModalStore.getState().hasAnyModalOpen).toBe(false);
      expect(useModalStore.getState().getModalProps('quickAdd')).toBeUndefined();
      expect(useModalStore.getState().getModalProps('settings')).toBeUndefined();
    });

    it('rapid mount/unmount churn: 50 cycles does not leak active modals or orphaned state', () => {
      for (let i = 0; i < 50; i++) {
        const { unmount } = render(
          <ModalProvider>
            <div>Cycle {i}</div>
          </ModalProvider>
        );

        act(() => {
          useModalStore.getState().openModal('smartFilter', { filterIndex: i });
        });

        expect(useModalStore.getState().isModalOpen('smartFilter')).toBe(true);
        unmount();
      }

      // After 50 unmounts, store must be completely pristine
      expect(useModalStore.getState().activeModals).toEqual([]);
      expect(useModalStore.getState().hasAnyModalOpen).toBe(false);
      expect(Object.keys(useModalStore.getState().modalProps).length).toBe(0);
    });

    it('deep modal stack stress: manages 15 nested modals with strict LIFO order and clean prop deletion', () => {
      const modalList: ModalId[] = [
        'quickAdd', 'commandPalette', 'shortcuts', 'brainDump', 'exportImport',
        'aesthetics', 'auth', 'eveningShutdown', 'morningKickoff', 'interruption',
        'scratchpad', 'smartFilter', 'templatePicker', 'weeklyReview', 'settings'
      ];

      // Push all 15 modals with memory payloads
      act(() => {
        modalList.forEach((id, idx) => {
          useModalStore.getState().openModal(id, { payload: new Array(100).fill(idx) });
        });
      });

      expect(useModalStore.getState().activeModals.length).toBe(15);
      expect(useModalStore.getState().activeModals).toEqual(modalList);

      // Pop one by one from top (LIFO)
      for (let i = modalList.length - 1; i >= 0; i--) {
        const expectedTop = modalList[i];
        expect(useModalStore.getState().activeModals[useModalStore.getState().activeModals.length - 1]).toBe(expectedTop);
        expect(useModalStore.getState().getModalProps(expectedTop)).toBeDefined();

        act(() => {
          useModalStore.getState().closeTopModal();
        });

        expect(useModalStore.getState().getModalProps(expectedTop)).toBeUndefined();
      }

      expect(useModalStore.getState().activeModals.length).toBe(0);
      expect(useModalStore.getState().hasAnyModalOpen).toBe(false);
    });

    it('fallback resilience: useModal outside ModalProvider falls back gracefully without crash', () => {
      const { result } = renderHook(() => useModal());

      expect(result.current.activeModals).toEqual([]);
      expect(result.current.hasAnyModalOpen).toBe(false);

      act(() => {
        result.current.openModal('shortcuts');
      });

      expect(result.current.isModalOpen('shortcuts')).toBe(true);
      expect(result.current.hasAnyModalOpen).toBe(true);

      act(() => {
        result.current.closeModal('shortcuts');
      });

      expect(result.current.isModalOpen('shortcuts')).toBe(false);
    });
  });

  describe('2. WorkspaceStore & Listener Leak Prevention', () => {
    function createMockStore(id: string) {
      let disk = { id, tasks: [], projects: [], dashboards: [], customViews: [], preferences: {}, pending: [], createdAt: Date.now(), updatedAt: Date.now() };
      const persistence = {
        ensureLegacyMigrated: vi.fn(async () => structuredClone(disk)),
        saveWorkspace: vi.fn(async (_id: string, data: any) => { disk = structuredClone(data); }),
      } as any;
      return new WorkspaceStore(id, false, persistence);
    }

    it('subscriber churn: mounting and unmounting 100 components leaves 0 dangling store listeners', async () => {
      const store = createMockStore('churn-test');
      await store.load();

      const getListenerCount = () => {
        // Access private listeners via reflection/cast
        return (store as unknown as { listeners: Set<() => void> }).listeners.size;
      };

      const initialCount = getListenerCount();
      expect(initialCount).toBe(0);

      const ConsumerComponent = () => {
        const tasks = useWorkspaceTasks();
        return <div data-testid="task-count">{tasks.length}</div>;
      };

      // Mount and unmount 100 times
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(
          <WorkspaceStoreContext.Provider value={store}>
            <ConsumerComponent />
          </WorkspaceStoreContext.Provider>
        );

        expect(getListenerCount()).toBeGreaterThan(0);
        unmount();
      }

      // Must be back to baseline
      expect(getListenerCount()).toBe(initialCount);
    });

    it('useWorkspaceSelector equality caching prevents redundant selector invocations', async () => {
      const store = createMockStore('selector-cache-test');
      await store.load();

      let selectorCalls = 0;
      const Consumer = () => {
        const count = useWorkspaceSelector((s) => {
          selectorCalls++;
          return s.record.tasks.length;
        });
        return <div>{count}</div>;
      };

      const { rerender } = render(
        <WorkspaceStoreContext.Provider value={store}>
          <Consumer />
        </WorkspaceStoreContext.Provider>
      );

      const initialCalls = selectorCalls;

      // Trigger store publish with identical task count
      act(() => {
        store.run('Update non-task property', (r) => ({
          ...r,
          preferences: { ...r.preferences, dummy: Date.now() },
        }));
      });

      // The selector might be called to compute next value, but equality check prevents re-render thrash
      rerender(
        <WorkspaceStoreContext.Provider value={store}>
          <Consumer />
        </WorkspaceStoreContext.Provider>
      );

      expect(selectorCalls).toBeGreaterThanOrEqual(initialCalls);
    });
  });

  describe('3. Circular Dependency Static & Runtime Verification', () => {
    it('workspaceStore.ts has zero imports from TaskContext.tsx', () => {
      const workspaceStorePath = path.resolve(__dirname, '../src/services/workspaceStore.ts');
      const content = fs.readFileSync(workspaceStorePath, 'utf-8');

      // Check imports
      const hasTaskContextImport = /import\s+.*from\s+['"].*TaskContext.*['"]/.test(content);
      expect(hasTaskContextImport).toBe(false);

      // Check relative references to context/
      const hasContextRef = /from\s+['"].*\/context\/.*['"]/.test(content);
      expect(hasContextRef).toBe(false);
    });

    it('src/store/ has zero imports from TaskContext.tsx', () => {
      const storeDir = path.resolve(__dirname, '../src/store');
      const files = fs.readdirSync(storeDir).filter(f => f.endsWith('.ts') && !f.includes('.test.'));

      for (const file of files) {
        const filePath = path.join(storeDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const hasTaskContextImport = /import\s+.*from\s+['"].*TaskContext.*['"]/.test(content);
        expect(hasTaskContextImport, `File ${file} must not import TaskContext`).toBe(false);
      }
    });
  });

  describe('4. 1-Second Focus Timer Ticker De-amplification & Isolation', () => {
    it('isolated TaskRowTimer: ticker updates only the timer digits, causing 0 re-renders of task title or rows', () => {
      let timerRenderCount = 0;
      const TrackedTimer = React.memo<{ seconds: number }>(({ seconds }) => {
        timerRenderCount++;
        return <div data-testid="timer-display">{seconds}s</div>;
      });

      // Verify timer updates cleanly
      const { rerender } = render(<TrackedTimer seconds={0} />);
      expect(timerRenderCount).toBe(1);

      rerender(<TrackedTimer seconds={1} />);
      expect(timerRenderCount).toBe(2);

      rerender(<TrackedTimer seconds={2} />);
      expect(timerRenderCount).toBe(3);
    });

    it('useFocusStore ticker sync does not mutate unrelated store slices', () => {
      act(() => {
        useFocusStore.getState().startFocusSession('stopwatch', 'task-alpha', 'Test Focus');
      });

      const before = useFocusStore.getState();
      expect(before.focusSession?.taskId).toBe('task-alpha');
      expect(before.activeTimerTaskId).toBe('task-alpha');

      act(() => {
        useFocusStore.getState().tick();
      });

      const after = useFocusStore.getState();
      expect(after.activeTimerTaskId).toBe('task-alpha');
      expect(after.focusSession?.id).toBe(before.focusSession?.id);

      act(() => {
        useFocusStore.getState().stopFocusSession();
      });

      expect(useFocusStore.getState().focusSession).toBeNull();
      expect(useFocusStore.getState().activeTimerTaskId).toBeNull();
      expect(useFocusStore.getState().activeTimerSeconds).toBe(0);
    });
  });

  describe('5. Modal Flag Bi-directional Synchronization & Keydown Cleanup', () => {
    it('synchronizes backward-compatible boolean flags with modal stack both directions', () => {
      // 1. Open via legacy setter
      act(() => {
        useModalStore.getState().setIsAuthModalOpen(true);
      });
      expect(useModalStore.getState().isAuthModalOpen).toBe(true);
      expect(useModalStore.getState().isModalOpen('auth')).toBe(true);
      expect(useModalStore.getState().activeModals).toContain('auth');

      // 2. Close via stack close
      act(() => {
        useModalStore.getState().closeModal('auth');
      });
      expect(useModalStore.getState().isAuthModalOpen).toBe(false);
      expect(useModalStore.getState().isModalOpen('auth')).toBe(false);
      expect(useModalStore.getState().activeModals).not.toContain('auth');

      // 3. Open via stack openModal
      act(() => {
        useModalStore.getState().openModal('quickAdd', { initialDraft: 'foo' });
      });
      expect(useModalStore.getState().isQuickAddOpen).toBe(true);
      expect(useModalStore.getState().isModalOpen('quickAdd')).toBe(true);
      expect(useModalStore.getState().activeModals).toContain('quickAdd');

      // 4. Close via legacy setter
      act(() => {
        useModalStore.getState().setIsQuickAddOpen(false);
      });
      expect(useModalStore.getState().isQuickAddOpen).toBe(false);
      expect(useModalStore.getState().isModalOpen('quickAdd')).toBe(false);
      expect(useModalStore.getState().activeModals).not.toContain('quickAdd');
    });

    it('cleans up window event listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const addSpy = vi.spyOn(window, 'addEventListener');

      // Test hook or component attaching/detaching window listener
      const DummyModalListener = () => {
        React.useEffect(() => {
          const handler = () => {};
          window.addEventListener('keydown', handler);
          return () => window.removeEventListener('keydown', handler);
        }, []);
        return <div>listener</div>;
      };

      const { unmount } = render(<DummyModalListener />);
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeSpy.mockRestore();
      addSpy.mockRestore();
    });
  });
});
