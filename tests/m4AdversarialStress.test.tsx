// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useKeyboardNavigation } from '../src/hooks/useKeyboardNavigation';
import { PriorityPickerPopover } from '../src/components/tasks/popovers/PriorityPickerPopover';
import { DatePickerPopover } from '../src/components/tasks/popovers/DatePickerPopover';
import { useUIStore } from '../src/store/useUIStore';
import { useModalStore } from '../src/store/useModalStore';
import { useTaskStore } from '../src/store/useTaskStore';
import { audioEngine } from '../src/utils/audioEngine';
import type { Task, Priority } from '../src/types/task';

// Dynamic test harness that allows dynamically updating tasks and callbacks
const TestNavHarness: React.FC<{
  initialTasks: Task[];
  onSelectTask?: (id: string) => void;
  onToggleStatus?: (id: string) => void;
  onTogglePinToday?: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onDeleteTask?: (id: string) => void;
  onStartFocus?: (id: string) => void;
  onBatchUpdate?: (ids: string[], updates: Partial<Task>) => void;
  onBatchDelete?: (ids: string[]) => void;
  onBatchArchive?: (ids: string[]) => void;
  enabled?: boolean;
}> = ({
  initialTasks,
  onSelectTask = vi.fn(),
  onToggleStatus = vi.fn(),
  onTogglePinToday = vi.fn(),
  onUpdateTask = vi.fn(),
  onDeleteTask = vi.fn(),
  onStartFocus = vi.fn(),
  onBatchUpdate = vi.fn(),
  onBatchDelete = vi.fn(),
  onBatchArchive = vi.fn(),
  enabled = true,
}) => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  useKeyboardNavigation({
    tasks,
    onSelectTask,
    onToggleStatus,
    onTogglePinToday,
    onUpdateTask,
    onDeleteTask,
    onStartFocus,
    onBatchUpdate,
    onBatchDelete,
    onBatchArchive,
    enabled,
  });

  return (
    <div data-testid="harness">
      <button data-testid="shrink-tasks" onClick={() => setTasks(tasks.slice(0, 2))}>
        Shrink
      </button>
      <button data-testid="empty-tasks" onClick={() => setTasks([])}>
        Empty
      </button>
      {tasks.map((t) => (
        <div key={t.id} data-task-id={t.id} id={`task-${t.id}`}>
          {t.title}
        </div>
      ))}
    </div>
  );
};

const createMockTasks = (count: number): Task[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `task-${i + 1}`,
    title: `Task ${i + 1}`,
    status: 'todo',
    priority: (['p1', 'p2', 'p3', 'p4'][i % 4]) as Priority,
    projectId: 'inbox',
    subtasks: [],
    createdAt: Date.now() + i,
  }));

describe('Milestone 4 Adversarial Stress Harness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({
      selectedTaskId: null,
      focusedTaskId: null,
      selectedTaskIds: [],
      activePopover: null,
      isQuickAddOpen: false,
    });
    useModalStore.setState({
      activeModals: [],
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

    // WHATWG HTML standard: real browsers compute isContentEditable hierarchically
    if (!('isContentEditable' in HTMLElement.prototype) || typeof (document.createElement('div') as any).isContentEditable !== 'boolean') {
      Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
        get() {
          const attr = this.getAttribute('contenteditable');
          if (attr === 'true' || attr === '') return true;
          if (attr === 'false') return false;
          return Boolean(this.parentElement?.isContentEditable);
        },
        configurable: true,
      });
    }
  });

  afterEach(() => {
    // Clean up any lingering DOM nodes
    document.querySelectorAll('[data-adversarial-dom]').forEach((el) => el.remove());
  });

  describe('1. Keystroke Burst & Stress Navigation', () => {
    it('survives 200 consecutive j/k presses with wrap-around integrity', () => {
      const tasks = createMockTasks(5);
      render(<TestNavHarness initialTasks={tasks} />);

      // Initial state
      expect(useUIStore.getState().focusedTaskId).toBeNull();

      // First 'j' focuses task-1 (index 0)
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('task-1');

      // Next 4 'j' presses advance to task-5 (index 4)
      for (let i = 0; i < 4; i++) {
        fireEvent.keyDown(window, { key: 'j' });
      }
      expect(useUIStore.getState().focusedTaskId).toBe('task-5');

      // Next 'j' wraps around to task-1
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('task-1');

      // 'k' wraps backwards from task-1 to task-5
      fireEvent.keyDown(window, { key: 'k' });
      expect(useUIStore.getState().focusedTaskId).toBe('task-5');

      // Burst of 100 'j' presses
      for (let i = 0; i < 100; i++) {
        fireEvent.keyDown(window, { key: 'j' });
      }
      // 100 % 5 = 0, starting from task-5 (index 4) -> index (4 + 100) % 5 = 4 -> task-5
      expect(useUIStore.getState().focusedTaskId).toBe('task-5');

      // Burst of 100 'k' presses
      for (let i = 0; i < 100; i++) {
        fireEvent.keyDown(window, { key: 'k' });
      }
      expect(useUIStore.getState().focusedTaskId).toBe('task-5');
    });

    it('handles empty task list gracefully without crashing on j/k or single keys', () => {
      render(<TestNavHarness initialTasks={[]} />);

      expect(() => {
        fireEvent.keyDown(window, { key: 'j' });
        fireEvent.keyDown(window, { key: 'k' });
        fireEvent.keyDown(window, { key: ' ' });
        fireEvent.keyDown(window, { key: 'x' });
        fireEvent.keyDown(window, { key: 'p' });
        fireEvent.keyDown(window, { key: 'd' });
        fireEvent.keyDown(window, { key: 'Enter' });
        fireEvent.keyDown(window, { key: 'Delete' });
      }).not.toThrow();

      expect(useUIStore.getState().focusedTaskId).toBeNull();
    });

    it('safely clamps focusedIndex when task list shrinks dynamically while focused on the last task', () => {
      const tasks = createMockTasks(5);
      render(<TestNavHarness initialTasks={tasks} />);

      // Focus last task (task-5)
      for (let i = 0; i < 5; i++) {
        fireEvent.keyDown(window, { key: 'j' });
      }
      expect(useUIStore.getState().focusedTaskId).toBe('task-5');

      // Shrink tasks to 2
      act(() => {
        screen.getByTestId('shrink-tasks').click();
      });

      // safeFocusedIndex clamps to index 1 (task-2)
      expect(useUIStore.getState().focusedTaskId).toBe('task-2');

      // Empty task list
      act(() => {
        screen.getByTestId('empty-tasks').click();
      });
      expect(useUIStore.getState().focusedTaskId).toBeNull();
    });

    it('passes modifier keys (Ctrl, Meta, Alt) through without triggering hotkeys', () => {
      const tasks = createMockTasks(3);
      const onSelect = vi.fn();
      render(<TestNavHarness initialTasks={tasks} onSelectTask={onSelect} />);

      // Press Ctrl+J, Cmd+K, Alt+P, Ctrl+C
      fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
      fireEvent.keyDown(window, { key: 'k', metaKey: true });
      fireEvent.keyDown(window, { key: 'p', altKey: true });
      fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

      expect(useUIStore.getState().focusedTaskId).toBeNull();
      expect(useUIStore.getState().activePopover).toBeNull();
      expect(useUIStore.getState().isQuickAddOpen).toBe(false);
    });

    it('passes Space and Enter through when activeElement is a button or anchor', () => {
      const tasks = createMockTasks(3);
      const onToggleStatus = vi.fn();
      const onSelectTask = vi.fn();
      render(
        <TestNavHarness
          initialTasks={tasks}
          onToggleStatus={onToggleStatus}
          onSelectTask={onSelectTask}
        />
      );

      // Focus task-1 first
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('task-1');

      // Create a button and focus it
      const btn = document.createElement('button');
      btn.setAttribute('data-adversarial-dom', 'true');
      document.body.appendChild(btn);
      btn.focus();

      // Space and Enter should be passed through to button, not task actions
      fireEvent.keyDown(window, { key: ' ' });
      expect(onToggleStatus).not.toHaveBeenCalled();

      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onSelectTask).not.toHaveBeenCalled();
    });
  });

  describe('2. Rapid Popover Toggle Cycles & Stress', () => {
    it('completes 50 rapid p -> Escape -> d -> Escape cycles without state desync', () => {
      const tasks = createMockTasks(3);
      render(<TestNavHarness initialTasks={tasks} />);

      // Focus task-1
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('task-1');

      for (let i = 0; i < 50; i++) {
        // Press 'p' to open priority popover
        fireEvent.keyDown(window, { key: 'p' });
        expect(useUIStore.getState().activePopover).toEqual({
          type: 'priority',
          taskId: 'task-1',
        });

        // Close via state (simulating popover dismissal)
        act(() => {
          useUIStore.getState().setActivePopover(null);
        });
        expect(useUIStore.getState().activePopover).toBeNull();

        // Press 'd' to open date popover
        fireEvent.keyDown(window, { key: 'd' });
        expect(useUIStore.getState().activePopover).toEqual({
          type: 'date',
          taskId: 'task-1',
        });

        // Close via state
        act(() => {
          useUIStore.getState().setActivePopover(null);
        });
        expect(useUIStore.getState().activePopover).toBeNull();
      }

      // Ensure keyboard navigation is still fully functional
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('task-2');
    });

    it('prevents background hotkeys while an active popover is registered in useUIStore', () => {
      const tasks = createMockTasks(3);
      render(<TestNavHarness initialTasks={tasks} />);

      fireEvent.keyDown(window, { key: 'j' }); // focus task-1
      expect(useUIStore.getState().focusedTaskId).toBe('task-1');

      // Set active popover
      useUIStore.getState().setActivePopover({ type: 'priority', taskId: 'task-1' });

      // Try j, k, x, c, etc.
      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 'k' });
      fireEvent.keyDown(window, { key: 'x' });
      fireEvent.keyDown(window, { key: 'c' });

      // Focus should NOT have moved to task-2 or task-3
      expect(useUIStore.getState().focusedTaskId).toBe('task-1');
      expect(useUIStore.getState().isQuickAddOpen).toBe(false);
      expect(useUIStore.getState().selectedTaskIds).toEqual([]);
    });
  });

  describe('3. Input Shielding Deep Boundary Stress', () => {
    it.each([
      ['<input type="text">', () => {
        const el = document.createElement('input');
        el.type = 'text';
        return el;
      }],
      ['<input type="search">', () => {
        const el = document.createElement('input');
        el.type = 'search';
        return el;
      }],
      ['<input type="date">', () => {
        const el = document.createElement('input');
        el.type = 'date';
        return el;
      }],
      ['<textarea>', () => {
        return document.createElement('textarea');
      }],
      ['<select>', () => {
        const el = document.createElement('select');
        const opt = document.createElement('option');
        opt.value = '1';
        el.appendChild(opt);
        return el;
      }],
      ['<div contenteditable="true">', () => {
        const el = document.createElement('div');
        el.setAttribute('contenteditable', 'true');
        return el;
      }],
      ['<div contenteditable=""> (HTML5 boolean attribute)', () => {
        const el = document.createElement('div');
        el.setAttribute('contenteditable', '');
        return el;
      }],
      ['<div role="textbox">', () => {
        const el = document.createElement('div');
        el.setAttribute('role', 'textbox');
        el.setAttribute('tabindex', '0');
        return el;
      }],
      ['<div role="searchbox">', () => {
        const el = document.createElement('div');
        el.setAttribute('role', 'searchbox');
        el.setAttribute('tabindex', '0');
        return el;
      }],
      ['nested child inside contenteditable container', () => {
        const container = document.createElement('div');
        container.setAttribute('contenteditable', 'true');
        const span = document.createElement('span');
        span.textContent = 'editable text';
        span.tabIndex = 0;
        container.appendChild(span);
        return { container, focusTarget: span };
      }],
    ])('suppresses all navigation hotkeys when typing in %s', (_, setupEl) => {
      const tasks = createMockTasks(3);
      const onToggleStatus = vi.fn();
      const onUpdateTask = vi.fn();
      const onDeleteTask = vi.fn();

      render(
        <TestNavHarness
          initialTasks={tasks}
          onToggleStatus={onToggleStatus}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
        />
      );

      const res = setupEl();
      const nodeToAppend = 'container' in res ? res.container : res;
      const target = 'focusTarget' in res ? res.focusTarget : res;
      nodeToAppend.setAttribute('data-adversarial-dom', 'true');
      document.body.appendChild(nodeToAppend);
      target.focus();

      // Test all core hotkeys while focused on input element
      const keysToTest = ['j', 'k', 'x', 'c', 'p', 'd', 't', '1', '2', '3', '4', 'm', 's', 'e', 'f', 'Delete', 'Backspace'];
      for (const key of keysToTest) {
        fireEvent.keyDown(window, { key });
      }

      // Assert zero side-effects
      expect(useUIStore.getState().focusedTaskId).toBeNull();
      expect(useUIStore.getState().activePopover).toBeNull();
      expect(useUIStore.getState().isQuickAddOpen).toBe(false);
      expect(useUIStore.getState().selectedTaskIds).toEqual([]);
      expect(onToggleStatus).not.toHaveBeenCalled();
      expect(onUpdateTask).not.toHaveBeenCalled();
      expect(onDeleteTask).not.toHaveBeenCalled();
    });
  });

  describe('4. Modal Shielding Deep Verification', () => {
    it.each([
      ['isAuthModalOpen', () => useModalStore.setState({ isAuthModalOpen: true })],
      ['isQuickAddOpen', () => useModalStore.setState({ isQuickAddOpen: true })],
      ['isTemplatePickerOpen', () => useModalStore.setState({ isTemplatePickerOpen: true })],
      ['isWeeklyReviewOpen', () => useModalStore.setState({ isWeeklyReviewOpen: true })],
      ['isSmartFilterModalOpen', () => useModalStore.setState({ isSmartFilterModalOpen: true })],
      ['isInterruptionModalOpen', () => useModalStore.setState({ isInterruptionModalOpen: true })],
      ['isEveningShutdownOpen', () => useModalStore.setState({ isEveningShutdownOpen: true })],
      ['isMorningKickoffOpen', () => useModalStore.setState({ isMorningKickoffOpen: true })],
      ['hasAnyModalOpen flag', () => useModalStore.setState({ hasAnyModalOpen: true })],
      ['activeModals containing focusEngine', () => useModalStore.getState().openModal('focusEngine')],
      ['activeModals containing settings', () => useModalStore.getState().openModal('settings')],
      ['activeModals containing shortcuts', () => useModalStore.getState().openModal('shortcuts')],
      ['activeModals containing copilotOmnibar', () => useModalStore.getState().openModal('copilotOmnibar')],
      ['DOM element with [aria-modal="true"]', () => {
        const div = document.createElement('div');
        div.setAttribute('aria-modal', 'true');
        div.setAttribute('data-adversarial-dom', 'true');
        document.body.appendChild(div);
      }],
      ['DOM element with [data-overlay-open="true"]', () => {
        const div = document.createElement('div');
        div.setAttribute('data-overlay-open', 'true');
        div.setAttribute('data-adversarial-dom', 'true');
        document.body.appendChild(div);
      }],
      ['DOM element with [data-layout-editing="true"]', () => {
        const div = document.createElement('div');
        div.setAttribute('data-layout-editing', 'true');
        div.setAttribute('data-adversarial-dom', 'true');
        document.body.appendChild(div);
      }],
    ])('completely blocks hotkeys when %s is active', (_, triggerModal) => {
      const tasks = createMockTasks(3);
      render(<TestNavHarness initialTasks={tasks} />);

      act(() => {
        triggerModal();
      });

      // Press hotkeys
      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 'k' });
      fireEvent.keyDown(window, { key: 'c' });
      fireEvent.keyDown(window, { key: 'p' });
      fireEvent.keyDown(window, { key: 'd' });

      expect(useUIStore.getState().focusedTaskId).toBeNull();
      expect(useUIStore.getState().activePopover).toBeNull();
      expect(useUIStore.getState().isQuickAddOpen).toBe(false);
    });

    it('permits keyboard navigation when data-task-drawer="true" is open (by design)', () => {
      const tasks = createMockTasks(3);
      render(<TestNavHarness initialTasks={tasks} />);

      // Create a task drawer overlay
      const drawer = document.createElement('div');
      drawer.setAttribute('aria-modal', 'true');
      drawer.setAttribute('data-task-drawer', 'true');
      drawer.setAttribute('data-adversarial-dom', 'true');
      document.body.appendChild(drawer);

      // Press 'j' to navigate tasks while drawer is open
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('task-1');
    });
  });

  describe('5. Popover Focus Trap & Continuous Confinement Stress', () => {
    describe('PriorityPickerPopover', () => {
      it('confines focus in a continuous loop across 50 consecutive Tab cycles', () => {
        const onSelect = vi.fn();
        const onClose = vi.fn();

        render(
          <PriorityPickerPopover
            taskId="task-1"
            currentPriority="p1"
            onSelect={onSelect}
            onClose={onClose}
          />
        );

        const closeBtn = screen.getByRole('button', { name: /close priority picker/i });
        const p1Btn = screen.getByRole('menuitem', { name: /urgent/i });
        const p4Btn = screen.getByRole('menuitem', { name: /low/i });

        expect(document.activeElement).toBe(p1Btn);

        // Forward tab through elements
        // The items order in DOM: [Close button, Urgent (p1), High (p2), Medium (p3), Low (p4)]
        for (let i = 0; i < 50; i++) {
          fireEvent.keyDown(window, { key: 'Tab' });
          // Ensure activeElement is NEVER null or body
          expect(document.activeElement).not.toBe(document.body);
          expect(document.activeElement).not.toBeNull();
        }

        // Focus the last element (p4) and press Tab -> must cycle to first focusable
        p4Btn.focus();
        expect(document.activeElement).toBe(p4Btn);
        fireEvent.keyDown(window, { key: 'Tab' });
        expect(document.activeElement).toBe(closeBtn);

        // Shift+Tab from closeBtn -> must cycle backwards to p4
        fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(p4Btn);
      });

      it('restores focus to the triggering element on Escape dismiss', () => {
        const triggerBtn = document.createElement('button');
        triggerBtn.setAttribute('data-adversarial-dom', 'true');
        document.body.appendChild(triggerBtn);
        triggerBtn.focus();
        expect(document.activeElement).toBe(triggerBtn);

        const onClose = vi.fn();
        const { unmount } = render(
          <PriorityPickerPopover
            taskId="task-1"
            currentPriority="p2"
            onSelect={vi.fn()}
            onClose={onClose}
          />
        );

        // Verify popover captured focus
        expect(document.activeElement).not.toBe(triggerBtn);

        // Press Escape
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();

        // On unmount, previous focus is restored
        unmount();
        expect(document.activeElement).toBe(triggerBtn);
      });

      it('navigates with ArrowDown/ArrowUp and wraps correctly', () => {
        render(
          <PriorityPickerPopover
            taskId="task-1"
            currentPriority="p1"
            onSelect={vi.fn()}
            onClose={vi.fn()}
          />
        );

        const p1 = screen.getByRole('menuitem', { name: /urgent/i });
        const p2 = screen.getByRole('menuitem', { name: /high/i });
        const p3 = screen.getByRole('menuitem', { name: /medium/i });
        const p4 = screen.getByRole('menuitem', { name: /low/i });

        expect(document.activeElement).toBe(p1);

        fireEvent.keyDown(window, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(p2);

        fireEvent.keyDown(window, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(p3);

        fireEvent.keyDown(window, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(p4);

        // ArrowDown wrap
        fireEvent.keyDown(window, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(p1);

        // ArrowUp wrap
        fireEvent.keyDown(window, { key: 'ArrowUp' });
        expect(document.activeElement).toBe(p4);
      });
    });

    describe('DatePickerPopover', () => {
      it('confines focus in a continuous loop across 50 consecutive Tab cycles', () => {
        const onSelectDate = vi.fn();
        const onClose = vi.fn();

        render(
          <DatePickerPopover
            taskId="task-1"
            onSelectDate={onSelectDate}
            onClose={onClose}
          />
        );

        const closeBtn = screen.getByRole('button', { name: /close date picker/i });
        const todayBtn = screen.getByRole('menuitem', { name: /today/i });
        const dateInput = screen.getByLabelText('Pick specific date');

        expect(document.activeElement).toBe(todayBtn);

        // Continuous Tab cycles
        for (let i = 0; i < 50; i++) {
          fireEvent.keyDown(window, { key: 'Tab' });
          expect(document.activeElement).not.toBe(document.body);
          expect(document.activeElement).not.toBeNull();
        }

        // Focus date input (last element) and press Tab -> wraps to closeBtn (first element)
        dateInput.focus();
        expect(document.activeElement).toBe(dateInput);
        fireEvent.keyDown(window, { key: 'Tab' });
        expect(document.activeElement).toBe(closeBtn);

        // Shift+Tab from closeBtn -> wraps to dateInput
        fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(dateInput);
      });

      it('shields date input so typing characters does not fire popover shortcuts', () => {
        const onSelectDate = vi.fn();
        const onClose = vi.fn();

        render(
          <DatePickerPopover
            taskId="task-1"
            onSelectDate={onSelectDate}
            onClose={onClose}
          />
        );

        const dateInput = screen.getByLabelText('Pick specific date');
        dateInput.focus();
        expect(document.activeElement).toBe(dateInput);

        // Typing 't', 'm', 'w', 'n', 's' in the input element should NOT trigger shortcuts
        fireEvent.keyDown(dateInput, { key: 't' });
        fireEvent.keyDown(dateInput, { key: 'm' });
        fireEvent.keyDown(dateInput, { key: 'w' });
        fireEvent.keyDown(dateInput, { key: 'n' });
        fireEvent.keyDown(dateInput, { key: 's' });

        expect(onSelectDate).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();

        // But Escape inside the input DOES close the popover
        fireEvent.keyDown(dateInput, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('6. Multi-Select Range & Batch Hotkey Stress', () => {
    it('supports Shift+ArrowDown to expand selection range', () => {
      const tasks = createMockTasks(5);
      render(<TestNavHarness initialTasks={tasks} />);

      // Focus first task with 'j'
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('task-1');

      // Shift+ArrowDown to select task-1 and task-2
      fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true });
      expect(useUIStore.getState().selectedTaskIds).toEqual(['task-1', 'task-2']);

      // Shift+ArrowDown again to select task-3
      fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true });
      expect(useUIStore.getState().selectedTaskIds).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('executes batch priority change on selected tasks with keys 1..4', () => {
      const tasks = createMockTasks(4);
      const onBatchUpdate = vi.fn();
      render(<TestNavHarness initialTasks={tasks} onBatchUpdate={onBatchUpdate} />);

      useUIStore.getState().selectAllTasks(['task-1', 'task-2', 'task-3']);

      fireEvent.keyDown(window, { key: '2' });
      expect(onBatchUpdate).toHaveBeenCalledWith(['task-1', 'task-2', 'task-3'], { priority: 'p2' });
      expect(useUIStore.getState().selectedTaskIds).toEqual([]);
    });

    it('clears multi-selection on Escape without losing list context', () => {
      const tasks = createMockTasks(3);
      render(<TestNavHarness initialTasks={tasks} />);

      useUIStore.getState().selectAllTasks(['task-1', 'task-2']);
      expect(useUIStore.getState().selectedTaskIds).toHaveLength(2);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(useUIStore.getState().selectedTaskIds).toEqual([]);
    });
  });

  describe('7. Micro-Interactions, Audio Synthesis & Confetti', () => {
    it('debounces audioEngine.playCompletionChime by 50ms under concurrent calls', () => {
      vi.useFakeTimers();

      let oscillatorCount = 0;
      const mockOscillator = {
        connect: vi.fn(),
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        start: vi.fn(),
        stop: vi.fn(),
      };
      const mockGain = {
        connect: vi.fn(),
        gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      };

      const mockCtx = {
        currentTime: 0,
        destination: {},
        state: 'running',
        createOscillator: vi.fn(() => {
          oscillatorCount++;
          return mockOscillator;
        }),
        createGain: vi.fn(() => mockGain),
        resume: vi.fn(),
      };

      (audioEngine as any).ctx = mockCtx;
      (audioEngine as any).isSoundEnabled = true;
      (audioEngine as any).lastCompletionChimeTime = 0;

      // Call 10 times in immediate succession
      for (let i = 0; i < 10; i++) {
        audioEngine.playCompletionChime('mechanical');
      }

      // Because of 50ms debounce, only 1 audio synthesis was triggered
      expect(oscillatorCount).toBe(1);

      // Advance clock past 50ms debounce window
      vi.advanceTimersByTime(60);

      // Call again: should now be permitted
      audioEngine.playCompletionChime('mechanical');
      expect(oscillatorCount).toBe(2);

      vi.useRealTimers();
    });

    it('differentiates complete and uncheck sound triggers in useTaskStore', () => {
      const playCompleteSpy = vi.spyOn(audioEngine, 'playTaskComplete').mockImplementation(() => {});
      const playUncheckSpy = vi.spyOn(audioEngine, 'playTaskUncheckSound').mockImplementation(() => {});

      // Seed task store with a todo task
      useTaskStore.setState({
        tasks: [
          {
            id: 'task-sound-1',
            title: 'Sound Test Task',
            status: 'todo',
            priority: 'p2',
            projectId: 'inbox',
            subtasks: [],
            createdAt: Date.now(),
          },
        ],
      });

      // Toggle from todo -> done (must play complete sound)
      useTaskStore.getState().toggleTaskStatus('task-sound-1');
      expect(playCompleteSpy).toHaveBeenCalledTimes(1);
      expect(playUncheckSpy).not.toHaveBeenCalled();

      // Toggle from done -> todo (must play uncheck sound)
      useTaskStore.getState().toggleTaskStatus('task-sound-1');
      expect(playUncheckSpy).toHaveBeenCalledTimes(1);

      playCompleteSpy.mockRestore();
      playUncheckSpy.mockRestore();
    });

    it('plays subtask toggle audio feedback with correct completion direction', () => {
      const playSubtaskSpy = vi.spyOn(audioEngine, 'playSubtaskToggle').mockImplementation(() => {});

      useTaskStore.setState({
        tasks: [
          {
            id: 'task-subtask-1',
            title: 'Parent Task',
            status: 'todo',
            priority: 'p3',
            projectId: 'inbox',
            subtasks: [
              { id: 'sub-1', title: 'Subtask 1', completed: false },
            ],
            createdAt: Date.now(),
          },
        ],
      });

      // Toggle subtask from incomplete -> completed
      useTaskStore.getState().toggleSubTask('task-subtask-1', 'sub-1');
      expect(playSubtaskSpy).toHaveBeenCalledWith(true);

      // Toggle subtask from completed -> incomplete
      useTaskStore.getState().toggleSubTask('task-subtask-1', 'sub-1');
      expect(playSubtaskSpy).toHaveBeenCalledWith(false);

      playSubtaskSpy.mockRestore();
    });
  });
});
