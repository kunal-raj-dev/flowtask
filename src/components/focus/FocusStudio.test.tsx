// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FocusStudio } from "./FocusStudio";
import { useFocusStore } from "../../store/useFocusStore";

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
    expect(screen.getByRole("combobox", { name: "Focus rhythm" })).toBeDefined();
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
});
