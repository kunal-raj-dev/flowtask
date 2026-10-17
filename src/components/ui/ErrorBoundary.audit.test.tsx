import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";
import { emptyWorkspace, getDatabase } from "../../services/dbService";
import { downloadJson } from "../../utils/fileExporter";
vi.mock("../../utils/fileExporter", () => ({ downloadJson: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("recovers actual IndexedDB data from the selected workspace without exporting another account", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const db = await getDatabase();
  const guest = emptyWorkspace("local"),
    account = emptyWorkspace("recovery-account");
  guest.tasks = [
    {
      id: "guest-task",
      title: "Saved guest work",
      status: "todo",
      priority: "p2",
      projectId: "inbox",
      subtasks: [],
      createdAt: 1,
    },
  ];
  account.tasks = [
    { ...guest.tasks[0], id: "account-task", title: "Private account work" },
  ];
  await db.put("workspaces", guest);
  await db.put("workspaces", account);
  function BrokenScreen(): never {
    throw new Error("A screen failed");
  }
  render(
    <ErrorBoundary>
      <BrokenScreen />
    </ErrorBoundary>,
  );
  await screen.findByRole("combobox", { name: "Workspace to recover" });
  fireEvent.click(
    screen.getByRole("button", { name: "Download Emergency Backup (JSON)" }),
  );
  await waitFor(() => expect(downloadJson).toHaveBeenCalledTimes(1));
  const backup = vi.mocked(downloadJson).mock.calls[0][0] as any;
  expect(backup.tasks.map((task: any) => task.title)).toEqual([
    "Saved guest work",
  ]);
  expect(backup.dashboards).toHaveLength(4);
  expect(backup).not.toHaveProperty("pending");
});
