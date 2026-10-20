// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ViewContainer } from './ViewContainer';
import type { SnapshotPayload } from '../../utils/snapshotShare';

describe('ViewContainer', () => {
  const defaultProps = {
    activeView: 'today',
    viewTitle: 'Today',
    onBackToToday: vi.fn(),
    pendingSnapshot: null as SnapshotPayload | null,
    onImportSnapshot: vi.fn(),
    onDismissSnapshot: vi.fn(),
    children: <div data-testid="active-view-content">Today Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children within workspace view host', () => {
    render(<ViewContainer {...defaultProps} />);
    expect(screen.getByTestId('active-view-content')).toBeDefined();
    expect(screen.getByText('Today Content')).toBeDefined();
  });

  it('renders shared task snapshot banner and triggers import when present', () => {
    const snapshot: SnapshotPayload = {
      title: 'Shared Project',
      v: 1,
      exportedAt: Date.now(),
      tasks: [
        { title: 'Shared Task 1', priority: 'p1' },
      ],
    };

    render(
      <ViewContainer
        {...defaultProps}
        pendingSnapshot={snapshot}
      />
    );

    expect(screen.getByText(/Shared Task Snapshot: "Shared Project"/)).toBeDefined();
    const importBtn = screen.getByRole('button', { name: /Import 1 Tasks/ });
    fireEvent.click(importBtn);
    expect(defaultProps.onImportSnapshot).toHaveBeenCalledWith(snapshot);
  });
});
