import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import { QuickNotesWidget } from "./QuickNotesWidget";
import type { DashboardWidget } from "../../../types/dashboard";

const scope = vi.hoisted(() => ({ current: {} as any }));
vi.mock("../../../context/TaskContext", () => ({
  useTaskContext: () => scope.current,
}));
const widget: DashboardWidget = {
  id: "notes",
  type: "quickNotes",
  config: { mode: "both" },
};
beforeEach(() => {
  vi.useFakeTimers();
  scope.current = {
    workspaceId: "a",
    workspacePreferences: { scratchpad: "" },
    tasks: [
      {
        id: "a-task",
        title: "First task",
        description: "Original",
        subtasks: [],
      },
    ],
    selectedTaskId: "a-task",
    setWorkspacePreference: vi.fn(),
    updateTask: vi.fn(),
    addTask: vi.fn(),
    showToast: vi.fn(),
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("coalesces rapid typing and flushes the final thought on immediate unmount", () => {
  const { unmount } = render(
    <QuickNotesWidget widget={widget} isEditing={false} />,
  );
  const input = screen.getByRole("textbox", { name: "Workspace scratchpad" });
  fireEvent.change(input, { target: { value: "first" } });
  fireEvent.change(input, { target: { value: "final thought" } });
  act(() => {
    vi.advanceTimersByTime(100);
  });
  expect(scope.current.setWorkspacePreference).not.toHaveBeenCalled();
  unmount();
  expect(scope.current.setWorkspacePreference).toHaveBeenCalledExactlyOnceWith(
    "scratchpad",
    "final thought",
  );
});

it("flushes to the original task and account without leaking a pending write into the new one", () => {
  const previous = scope.current;
  const { rerender } = render(
    <QuickNotesWidget widget={widget} isEditing={false} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Task notes" }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "Notes for First task" }),
    { target: { value: "Keep with account A" } },
  );
  scope.current = {
    ...previous,
    workspaceId: "b",
    selectedTaskId: "b-task",
    tasks: [
      {
        id: "b-task",
        title: "Second task",
        description: "Account B notes",
        subtasks: [],
      },
    ],
    updateTask: vi.fn(),
    setWorkspacePreference: vi.fn(),
  };
  rerender(<QuickNotesWidget widget={widget} isEditing={false} />);
  expect(previous.updateTask).toHaveBeenCalledExactlyOnceWith("a-task", {
    description: "Keep with account A",
  });
  expect(
    (
      screen.getByRole("textbox", {
        name: "Notes for Second task",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("Account B notes");
  act(() => {
    vi.advanceTimersByTime(500);
  });
  expect(scope.current.updateTask).not.toHaveBeenCalled();
});

it("explains task-only mode when no task is selected instead of editing another note source", () => {
  scope.current.selectedTaskId = null;
  render(
    <QuickNotesWidget
      widget={{ ...widget, config: { mode: "task" } }}
      isEditing={false}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Choose a task for your notes" }),
  ).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
});

it('flushes before an animated context drawer closes, without waiting for unmount',()=>{
  render(<QuickNotesWidget widget={widget}/>);
  const input=screen.getByRole('textbox',{name:'Workspace scratchpad'});
  fireEvent.change(input,{target:{value:'A thought before leaving'}});
  fireEvent.blur(input);
  expect(scope.current.setWorkspacePreference).toHaveBeenCalledExactlyOnceWith('scratchpad','A thought before leaving');
  act(()=>vi.advanceTimersByTime(500));
  expect(scope.current.setWorkspacePreference).toHaveBeenCalledTimes(1);
});
it('flushes pending notes on document navigation without replaying them twice',()=>{
  render(<QuickNotesWidget widget={widget}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Workspace scratchpad'}),{target:{value:'Remember on refresh'}});
  act(()=>window.dispatchEvent(new Event('pagehide')));
  expect(scope.current.setWorkspacePreference).toHaveBeenCalledExactlyOnceWith('scratchpad','Remember on refresh');
});
