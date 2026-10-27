// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DesktopHeader } from './DesktopHeader';

vi.mock('../focus/FocusMiniPlayer', () => ({
  FocusMiniPlayer: () => <div data-testid="focus-mini-player">MiniPlayer</div>,
}));

describe('DesktopHeader', () => {
  const defaultProps = {
    viewTitle: 'Today Horizon',
    isSidebarCollapsed: false,
    onToggleSidebar: vi.fn(),
    onOpenFocus: vi.fn(),
    onOpenAuth: vi.fn(),
    onQuickAdd: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    onOpenSettings: vi.fn(),
    syncStatus: 'synced',
    user: { displayName: 'Alex Mercer', email: 'alex@example.com' },
    isAnonymous: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders breadcrumb with view title', () => {
    render(<DesktopHeader {...defaultProps} />);
    expect(screen.getByText('Today Horizon')).toBeDefined();
    expect(screen.getByText('FlowTask')).toBeDefined();
  });

  it('triggers quick add and command palette triggers', () => {
    render(<DesktopHeader {...defaultProps} />);

    const quickAddBtn = screen.getByRole('button', { name: 'New Task' });
    fireEvent.click(quickAddBtn);
    expect(defaultProps.onQuickAdd).toHaveBeenCalled();

    const searchBtn = screen.getByRole('button', { name: 'Search and commands' });
    fireEvent.click(searchBtn);
    expect(defaultProps.onOpenCommandPalette).toHaveBeenCalled();
  });

  it('toggles sidebar on menu button click', () => {
    render(<DesktopHeader {...defaultProps} />);

    const menuBtn = screen.getByRole('button', { name: 'Toggle Sidebar ([)' });
    fireEvent.click(menuBtn);
    expect(defaultProps.onToggleSidebar).toHaveBeenCalled();
  });

  it('renders user account capsule and opens auth modal', () => {
    render(<DesktopHeader {...defaultProps} />);

    const userCapsule = screen.getByText('Alex Mercer');
    expect(userCapsule).toBeDefined();

    const authBtn = screen.getByLabelText(/User Account: Alex Mercer/);
    fireEvent.click(authBtn);
    expect(defaultProps.onOpenAuth).toHaveBeenCalled();
  });

  it('triggers onOpenCopilot on Copilot button click', () => {
    const onOpenCopilot = vi.fn();
    render(<DesktopHeader {...defaultProps} onOpenCopilot={onOpenCopilot} />);

    const copilotBtn = screen.getByRole('button', { name: 'Open Copilot Omnibar' });
    fireEvent.click(copilotBtn);
    expect(onOpenCopilot).toHaveBeenCalled();
  });

  it('keeps Focus Studio in workspace tools while the sidebar provides its main entry', () => {
    render(<DesktopHeader {...defaultProps} />);
    expect(screen.queryByRole('button', { name: 'Focus' })).toBeNull();
    const studio = screen.getByRole('button', { name: 'Open Focus Studio', hidden: true });
    fireEvent.click(studio);
    expect(defaultProps.onOpenFocus).toHaveBeenCalledTimes(1);
  });

  it('exposes Focus Studio directly when navigation is collapsed', () => {
    render(<DesktopHeader {...defaultProps} isSidebarCollapsed />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    expect(defaultProps.onOpenFocus).toHaveBeenCalledTimes(1);
  });
});
