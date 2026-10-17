import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TaskExecutionDetails } from "./TaskExecutionDetails";
import type { Task } from "../../types/task";
const calls = vi.hoisted(() => ({ updateTask: vi.fn() }));
vi.mock("../../context/TaskContext", () => ({
  useTaskContext: () => ({ updateTask: calls.updateTask, focusLogs: [] }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const task: Task = {
  id: "first",
  title: "First task",
  status: "todo",
  priority: "p2",
  projectId: "inbox",
  subtasks: [],
  createdAt: 1,
};
it("flushes the next action when Escape or navigation unmounts the inspector without blur", () => {
  const { unmount } = render(<TaskExecutionDetails task={task} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Next small action" }), {
    target: { value: "Start with one example" },
  });
  unmount();
  expect(calls.updateTask).toHaveBeenCalledExactlyOnceWith(task.id, {
    nextAction: "Start with one example",
  });
});
it("saves an unfinished edit to the original task when selecting a different task", () => {
  const { rerender } = render(<TaskExecutionDetails task={task} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Next small action" }), {
    target: { value: "Keep on first" },
  });
  rerender(
    <TaskExecutionDetails
      task={{ ...task, id: "second", nextAction: "Second action" }}
    />,
  );
  expect(calls.updateTask).toHaveBeenCalledExactlyOnceWith("first", {
    nextAction: "Keep on first",
  });
  expect(
    (
      screen.getByRole("textbox", {
        name: "Next small action",
      }) as HTMLInputElement
    ).value,
  ).toBe("Second action");
});
