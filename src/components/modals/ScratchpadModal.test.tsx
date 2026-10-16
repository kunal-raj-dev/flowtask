// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScratchpadModal } from './ScratchpadModal';
import { BrainDumpModal } from './BrainDumpModal';
import { useTaskContext } from '../../context/TaskContext';

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: vi.fn(),
}));

vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    playCompletionChime: vi.fn(),
    playButtonTap: vi.fn(),
  },
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('ScratchpadModal & BrainDumpModal Consolidation', () => {
  const mockSetWorkspacePreference = vi.fn();
  const mockAddMultipleTasks = vi.fn();
  const mockShowToast = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useTaskContext as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      workspacePreferences: { scratchpad: 'Initial thought' },
      setWorkspacePreference: mockSetWorkspacePreference,
      addMultipleTasks: mockAddMultipleTasks,
      showToast: mockShowToast,
    });
  });

  it('renders Scratchpad tab by default and updates preferences on change', () => {
    render(<ScratchpadModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Sticky Scratchpad')).toBeDefined();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Initial thought');

    fireEvent.change(textarea, { target: { value: 'New note content' } });
    expect(mockSetWorkspacePreference).toHaveBeenCalledWith('scratchpad', 'New note content');
  });

  it('allows clearing notes with undo toast', () => {
    render(<ScratchpadModal isOpen={true} onClose={mockOnClose} />);

    const clearButton = screen.getByLabelText(/clear scratchpad/i);
    fireEvent.click(clearButton);

    expect(mockShowToast).toHaveBeenCalledWith(
      'Cleared scratchpad notes',
      'Undo',
      expect.any(Function)
    );
  });

  it('switches to NLP Staging tab and imports parsed tasks', () => {
    render(<ScratchpadModal isOpen={true} onClose={mockOnClose} />);

    const stagingTabButton = screen.getByText('NLP Staging');
    fireEvent.click(stagingTabButton);

    expect(screen.getByText('Multi-Task Brain Dump & Staging')).toBeDefined();

    const stagingTextarea = screen.getByLabelText(/brain dump notes/i);
    fireEvent.change(stagingTextarea, {
      target: {
        value: '- Prepare launch report tomorrow p1 #work ~30m\n- Follow up with team p2 #marketing',
      },
    });

    const previewButton = screen.getByRole('button', { name: /preview structure/i });
    fireEvent.click(previewButton);

    expect(screen.getByText('Prepare launch report')).toBeDefined();
    expect(screen.getByText('Follow up with team')).toBeDefined();

    const importButton = screen.getByRole('button', { name: /import \(2\)/i });
    fireEvent.click(importButton);

    expect(mockAddMultipleTasks).toHaveBeenCalledTimes(1);
    expect(mockAddMultipleTasks).toHaveBeenCalledWith([
      'Prepare launch report tomorrow p1 #work ~30m',
      'Follow up with team p2 #marketing',
    ]);
  });

  it('BrainDumpModal delegates seamlessly to ScratchpadModal with NLP Staging tab', () => {
    render(<BrainDumpModal onClose={mockOnClose} />);

    // Should open directly in NLP Staging view
    expect(screen.getByText('Multi-Task Brain Dump & Staging')).toBeDefined();
    expect(screen.getByLabelText(/brain dump notes/i)).toBeDefined();
  });
});
