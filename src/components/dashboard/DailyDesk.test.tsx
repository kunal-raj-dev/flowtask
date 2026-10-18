// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DailyDesk } from "./DailyDesk";
import { getStarterDashboard, STARTER_DAILY_DESK_ID } from "../../services/starterDashboards";

const mocks = vi.hoisted(() => ({ tasks: [] as any[] }));

vi.mock("../../context/TaskContext", () => ({
  useTaskContext: () => ({
    tasks: mocks.tasks,
    calendarEvents: [],
    settings: { targetWorkCapacityHours: 6 },
    workspacePreferences: {},
    projects: [],
    smartViews: [],
    addTask: vi.fn(),
    setIsEveningShutdownOpen: vi.fn(),
    updateTask: vi.fn(),
    showToast: vi.fn(),
    undoLastAction: vi.fn(),
  }),
}));
vi.mock("../../hooks/useCurrentDate", () => ({ useTodayStr: () => "2026-10-18" }));
vi.mock("../../hooks/useTotalFocusedTodaySeconds", () => ({
  useTotalFocusedTodaySeconds: () => 0,
}));

describe("DailyDesk daily flow", () => {
  beforeEach(() => {
    mocks.tasks = [];
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: true,
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

  it("puts task capture before Top 3 on an empty day and keeps Focus as one primary action", () => {
    render(
      <DailyDesk
        dashboard={getStarterDashboard(STARTER_DAILY_DESK_ID)!}
        onStartFocus={vi.fn()}
        onPlanMyDay={vi.fn()}
      />,
    );

    const tasks = screen.getByRole("region", { name: "Today's Tasks" });
    const priorities = screen.getByRole("region", { name: "Top 3 Priorities" });
    expect(
      Boolean(tasks.compareDocumentPosition(priorities) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(screen.getByRole("textbox", { name: "Add a task to this list" })).toBeDefined();
    expect(screen.getByText("Focus").closest('[aria-current="step"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Start focus/i })).toBeNull();
  });
});
