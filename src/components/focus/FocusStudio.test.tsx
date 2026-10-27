// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FocusStudio } from "./FocusStudio";
import { useFocusStore } from "../../store/useFocusStore";
import { useUIStore } from '../../store/useUIStore';
import { FocusPipHUD } from './FocusPipPortal';

const mocks = vi.hoisted(() => ({
  context: {} as Record<string, any>,
  media: {
    scenes: [] as any[],
    audio: [] as any[],
    error: "",
    refreshPersonal: vi.fn(),
  },
}));

vi.mock("../../context/TaskContext", () => ({
  useTaskContext: () => mocks.context,
}));
vi.mock("../../context/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));
vi.mock("../../hooks/useFocusTrap", () => ({ useFocusTrap: vi.fn() }));
vi.mock("../../hooks/useCurrentDate", () => ({
  useTodayStr: () => "2026-10-18",
}));
vi.mock("../../hooks/useStudio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../hooks/useStudio")>();
  return { ...actual, useMediaCatalog: () => mocks.media };
});

describe("FocusStudio lobby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ theme: 'light' });
    mocks.context = {
      workspaceId: "local",
      workspacePreferences: {},
      setWorkspacePreference: vi.fn(),
      tasks: [
        {
          id: "task-graphs",
          title: "Review graph algorithms",
          nextAction: "Trace one breadth-first search by hand",
          status: "todo",
          projectId: "inbox",
          subtasks: [],
        },
      ],
      projects: [],
      focusLogs: [],
      startFocusSession: vi.fn(),
      updateFocusSession: vi.fn(),
      stopFocusSession: vi.fn(),
      pauseFocusSession: vi.fn(),
      resumeFocusSession: vi.fn(),
      addTask: vi.fn(),
      addSubTask: vi.fn(),
      updateTask: vi.fn(),
      toggleTaskStatus: vi.fn(),
    };
    mocks.media = {
      scenes: [],
      audio: [],
      error: "",
      refreshPersonal: vi.fn(),
    };
    useFocusStore.setState({
      focusSession: null,
      focusElapsedSeconds: 0,
      activeTimerTaskId: null,
      activeTimerSeconds: 0,
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it("keeps task, rhythm, timer, and Start before the room catalog and starts the chosen task", async () => {
    render(<FocusStudio taskId={null} onClose={vi.fn()} />);

    const session = screen.getByRole("region", { name: "Prepare your session" });
    const environments = screen.getByRole("complementary", {
      name: "Choose your focus environment",
    });
    expect(
      Boolean(session.compareDocumentPosition(environments) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(screen.getByRole("combobox", { name: "Focus task" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Focus rhythm" })).toBeDefined();
    expect(screen.getByRole("timer")).toBeDefined();

    fireEvent.change(screen.getByRole("combobox", { name: "Focus task" }), {
      target: { value: "task-graphs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start focus" }));

    expect(mocks.context.startFocusSession).toHaveBeenCalledWith(
      "pomodoro",
      "task-graphs",
      "Review graph algorithms",
      25 * 60,
    );
    expect(mocks.context.updateFocusSession).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "local",
        pomodoroPhase: "focus",
        timerConfiguration: expect.objectContaining({ focusMinutes: 25 }),
      }),
    );
  });

  it("labels a manually selected break as a break before starting it", () => {
    render(<FocusStudio taskId={null} onClose={vi.fn()} initialPhase="short_break" />);

    fireEvent.click(screen.getByRole("button", { name: "Start break" }));

    expect(mocks.context.startFocusSession).toHaveBeenCalledWith(
      "pomodoro",
      null,
      "A little breathing room",
      5 * 60,
    );
  });

  it('applies a complete one-click focus rhythm', () => {
    render(<FocusStudio taskId={null} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '50-minute focus' }));
    expect(mocks.context.setWorkspacePreference).toHaveBeenCalledWith('studio', expect.objectContaining({
      timer: expect.objectContaining({ mode: 'pomodoro', focusMinutes: 50, shortBreakMinutes: 10 }),
    }));
  });

  it('searches rooms within the selected category and recovers from an empty search', () => {
    mocks.media.scenes = [
      { id: 'rain', title: 'Rainy Library', category: 'cozy', moods: ['soft'], src: '/rain.webp' },
      { id: 'moon', title: 'Moonlit Coast', category: 'ocean', moods: ['soft'], src: '/moon.webp' },
    ];
    render(<FocusStudio taskId={null} onClose={vi.fn()} initialPanel="scenes" />);
    const search = screen.getByRole('searchbox', { name: 'Search rooms' });
    fireEvent.change(search, { target: { value: 'soft' } });
    expect(screen.getByRole('button', { name: 'Use Rainy Library background' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Use Moonlit Coast background' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cozy study' }));
    expect(screen.queryByRole('button', { name: 'Use Moonlit Coast background' })).toBeNull();
    fireEvent.change(search, { target: { value: 'not-a-room' } });
    expect(screen.getByText('A different somewhere?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Explore all rooms' }));
    expect(screen.getByRole('button', { name: 'Use Moonlit Coast background' })).toBeDefined();
  });

  it('changes the break room without replacing the focus room', () => {
    render(<FocusStudio taskId={null} onClose={vi.fn()} initialPhase="short_break" />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose Kyoto Rain room' }));
    expect(mocks.context.setWorkspacePreference).toHaveBeenCalledWith('studio', expect.objectContaining({
      sceneId: 'old-library', breakSceneId: 'kyoto-rain', recent: ['kyoto-rain'],
    }));
  });

  it('follows app appearance when no Studio theme source has been saved', () => {
    render(<FocusStudio taskId={null} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Focus Studio' }).getAttribute('data-studio-theme')).toBe('light');
  });
  it.each(['running', 'paused'] as const)('recolors a %s Studio and matching floating timer without changing the session or scene', state => {
    const session = { id: 'theme-session', workspaceId: 'local', mode: 'countdown' as const, state, taskId: 'task-graphs', taskTitle: 'Review graph algorithms', targetDurationSec: 1500, startedAt: Date.now(), accumulatedElapsedMs: 120000 };
    useFocusStore.setState({ focusSession: session, focusElapsedSeconds: 120 });
    mocks.context.workspacePreferences = { studio: { sceneId: 'old-library', interfaceTheme: 'plum' }, appearance: { accent: '#ff00ff' } };
    mocks.media.scenes = [{ id: 'old-library', title: 'Library', kind: 'image', src: '/library.webp', category: 'cozy' }];
    const { container, rerender } = render(<><FocusStudio taskId="task-graphs" onClose={vi.fn()} /><FocusPipHUD onReturnToApp={vi.fn()} /></>);
    const scene = container.querySelector('.studio-backdrop img')?.getAttribute('src');
    act(() => useUIStore.setState({ theme: 'forest' }));
    const studio = screen.getByRole('dialog', { name: 'Focus Studio' });
    const pip = container.querySelector<HTMLElement>('.pip-container')!;
    expect(studio.getAttribute('data-studio-theme')).toBe('forest');
    expect(pip.dataset.pipTheme).toBe('forest');
    expect(pip.style.getPropertyValue('--pip-amber')).toBe(studio.style.getPropertyValue('--studio-accent'));
    expect(container.querySelector('.studio-backdrop img')?.getAttribute('src')).toBe(scene);
    expect(useFocusStore.getState().focusSession).toBe(session);
    expect(useFocusStore.getState().focusElapsedSeconds).toBe(120);
    expect(mocks.context.startFocusSession).not.toHaveBeenCalled();
    expect(mocks.context.stopFocusSession).not.toHaveBeenCalled();
    expect(mocks.context.pauseFocusSession).not.toHaveBeenCalled();
    expect(mocks.context.resumeFocusSession).not.toHaveBeenCalled();
    mocks.context.workspacePreferences = { ...mocks.context.workspacePreferences, appearance: { accent: '#ff00ff', highContrast: true } };
    rerender(<><FocusStudio taskId="task-graphs" onClose={vi.fn()} /><FocusPipHUD onReturnToApp={vi.fn()} /></>);
    expect(pip.dataset.pipBackground).toBe('off');
    expect(useFocusStore.getState().focusSession).toBe(session);
  });
  it('offers following the app without erasing the saved custom Studio palette', () => {
    mocks.context.workspacePreferences = { studio: { interfaceTheme: 'plum', sceneId: 'local:my-room', themeMode: 'custom' } };
    render(<FocusStudio taskId={null} onClose={vi.fn()} initialPanel="appearance" />);
    expect(screen.getByRole('dialog', { name: 'Focus Studio' }).getAttribute('data-studio-theme')).toBe('plum');
    fireEvent.change(screen.getByRole('combobox', { name: 'Studio theme source' }), { target: { value: 'app' } });
    expect(mocks.context.setWorkspacePreference).toHaveBeenCalledWith('studio', expect.objectContaining({ themeMode: 'app', interfaceTheme: 'plum', sceneId: 'local:my-room' }));
  });
});
