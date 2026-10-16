// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingFlow } from './OnboardingFlow';

const mockAddMultipleTasks = vi.fn();
const mockUpdateSettings = vi.fn();
const mockOnClose = vi.fn();

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    addMultipleTasks: mockAddMultipleTasks,
    updateSettings: mockUpdateSettings,
    settings: {
      targetWorkCapacityHours: 6.0,
      onboardingCompleted: false,
    },
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    playCompletionChime: vi.fn(),
    playClickSound: vi.fn(),
  },
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
};
(globalThis as any).localStorage = localStorageMock;

describe('OnboardingFlow Guided Ritual (BUG-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<OnboardingFlow isOpen={false} onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders step 1 welcome ritual when isOpen is true', () => {
    render(<OnboardingFlow isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Welcome to FlowTask')).toBeDefined();
    expect(screen.getByRole('button', { name: /set up my daily capacity/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /skip setup/i })).toBeDefined();
  });

  it('skipping onboarding marks it completed in settings and closes modal', () => {
    render(<OnboardingFlow isOpen={true} onClose={mockOnClose} />);

    const skipButton = screen.getByRole('button', { name: /skip setup/i });
    fireEvent.click(skipButton);

    expect(mockUpdateSettings).toHaveBeenCalledWith({ onboardingCompleted: true });
    expect(localStorageMock.getItem('flowtask_onboarding_completed')).toBe('true');
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('progresses through steps 1-4, allows capturing Top 3 MITs, and finishes with Task Composer reference', () => {
    render(<OnboardingFlow isOpen={true} onClose={mockOnClose} />);

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /set up my daily capacity/i }));
    expect(screen.getByText('Calibrate Your Daily Deep Work Capacity')).toBeDefined();

    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /continue to top 3 focus/i }));
    expect(screen.getByText('What are your Top 3 priorities today?')).toBeDefined();

    // Type a Top 3 task
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Complete Core Architecture' } });

    // Step 3 -> Step 4
    fireEvent.click(screen.getByRole('button', { name: /review & launch/i }));
    expect(screen.getByText('You are ready to enter flow.')).toBeDefined();
    expect(screen.getByText('Complete Core Architecture')).toBeDefined();

    // Finish
    fireEvent.click(screen.getByRole('button', { name: /enter flow state & launch today/i }));

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      targetWorkCapacityHours: 6.0,
      onboardingCompleted: true,
    });
    expect(mockAddMultipleTasks).toHaveBeenCalledTimes(1);
    expect(mockAddMultipleTasks).toHaveBeenCalledWith(
      ['Complete Core Architecture'],
      expect.objectContaining({ priority: 'p1', isPinnedToday: true })
    );
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('displays Task Composer fallback when no initial tasks were entered on step 4', () => {
    render(<OnboardingFlow isOpen={true} onClose={mockOnClose} />);

    // Advance to step 4 without entering tasks
    fireEvent.click(screen.getByRole('button', { name: /set up my daily capacity/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue to top 3 focus/i }));
    fireEvent.click(screen.getByRole('button', { name: /review & launch/i }));

    // Verify "Task Composer" is displayed instead of legacy "Omnibar"
    expect(
      screen.getByText(/no initial tasks entered\. you can use the task composer or press/i)
    ).toBeDefined();
  });
});
