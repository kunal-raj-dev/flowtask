import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

async function openWorkspace(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("flowtask_onboarding_completed", "true"),
  );
  await page.goto("/app");
  await page.getByRole("heading", { name: "Today.", exact: true }).waitFor();
}
async function savedWorkspace(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("flowtask_storage_v2");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<any>((resolve, reject) => {
      const request = db
        .transaction("workspaces")
        .objectStore("workspaces")
        .get("local");
      request.onsuccess = () => {
        resolve(request.result);
        db.close();
      };
      request.onerror = () => {
        reject(request.error);
        db.close();
      };
    });
  });
}

test("first-run setup captures one real task and opens a task-linked Studio", async ({
  page,
}) => {
  await page.goto("/app");
  const setup = page.getByRole('region', { name: 'Start with one task', exact: true });
  await setup.getByRole('textbox', { name: 'Your first task' }).fill('Build the first small example');
  await setup.getByRole('button', { name: 'Add task', exact: true }).click();
  await setup.getByRole('button', { name: 'Start 25-minute focus', exact: true }).click();
  const studio = page.getByRole("dialog", {
    name: "Focus Studio",
    exact: true,
  });
  await expect(
    studio.getByRole("heading", {
      name: "Build the first small example",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    studio.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await savedWorkspace(page)).preferences.settings?.onboardingCompleted).toBe(true);
});

test("a complete day links capture, project, schedule, focus, review and a restorable backup", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openWorkspace(page);
  const input = page.getByRole("textbox", { name: "Add a task to this list" });
  await input.fill("Ship the audit changes ~25m");
  await input.press("Enter");
  await page
    .getByRole("button", { name: "Ship the audit changes", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Assign to project", exact: true })
    .selectOption("work");
  await page
    .getByRole("textbox", { name: "Next small action", exact: true })
    .fill("Review the first change");
  await page
    .getByRole("textbox", { name: "Next small action", exact: true })
    .press("Tab");
  await page
    .getByRole("button", { name: "Close task details", exact: true })
    .click();
  await page
    .locator("[data-task-id]")
    .getByRole("button", { name: "Pin to Top 3", exact: true })
    .click();
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await page
    .getByRole("button", { name: "Auto-Slot Day", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview schedule", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply schedule", exact: true })
    .click();
  await expect
    .poll(async () =>
      Boolean((await savedWorkspace(page)).tasks[0].scheduledStart),
    )
    .toBe(true);
  await page.getByRole("button", { name: /^Today 1$/ }).click();
  await page
    .getByRole("region", { name: "Top 3 Priorities", exact: true })
    .getByRole("button", {
      name: "Focus on Ship the audit changes",
      exact: true,
    })
    .click();
  const studio = page.getByRole("dialog", {
    name: "Focus Studio",
    exact: true,
  });
  await expect(studio.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await page.waitForTimeout(1100);
  await studio.getByRole("button", { name: "Pause", exact: true }).click();
  await studio.getByRole("button", { name: "Resume", exact: true }).click();
  await studio
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await studio.getByRole("button", { name: /^Mark task done/ }).click();
  await studio
    .getByRole("button", { name: "Back to planner", exact: true })
    .click();
  await page.locator('.sidebar-tools > summary').click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review & Insights", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await savedWorkspace(page)).preferences.focusLogs.length)
    .toBe(1);
  const saved = await savedWorkspace(page);
  expect(saved.tasks[0]).toMatchObject({
    status: "done",
    projectId: "work",
    nextAction: "Review the first change",
  });
  expect(saved.tasks[0].timeSpentMinutes).toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Preferences and Settings", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: /Export JSON \/ CSV/ }).click();
  const exports = page.getByRole("dialog", {
    name: "Backups and export",
    exact: true,
  });
  await exports.getByRole("button", { name: "JSON", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await exports
    .getByRole("button", { name: "Download JSON Backup", exact: true })
    .click();
  const download = await downloadEvent;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.dashboards).toHaveLength(4);
  expect(backup.preferences.focusLogs).toHaveLength(1);
  await exports.getByRole("button", { name: "Restore", exact: true }).click();
  await exports
    .getByRole("textbox", { name: "Paste JSON backup", exact: true })
    .fill('{"tasks":"corrupt"}');
  await expect(
    exports.getByRole("button", { name: "Merge Data", exact: true }),
  ).toBeDisabled();
  expect((await savedWorkspace(page)).tasks).toHaveLength(1);
  await exports
    .getByRole("textbox", { name: "Paste JSON backup", exact: true })
    .fill(JSON.stringify(backup));
  await exports.getByRole("radio", { name: /Replace workspace/ }).check();
  await exports
    .getByRole("button", { name: "Replace Workspace", exact: true })
    .click();
  await expect(exports).not.toBeVisible();
  const restored = await savedWorkspace(page);
  expect(restored.tasks[0]).toMatchObject({
    status: "done",
    projectId: "work",
  });
  expect(restored.dashboards).toHaveLength(4);
  expect(restored.preferences.focusLogs).toHaveLength(1);
  expect(restored.preferences.focusSession).toBeNull();
  expect(errors).toEqual([]);
});

test("assistant tools use the visible workspace, preserve manual edits and restore focus after refresh", async ({
  page,
}) => {
  await openWorkspace(page);
  const task = await page.evaluate(async () => {
    const bridge = (window as any).__FLOWTASK_MCP__;
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return bridge.callTool("createTask", {
      title: "Assistant captured task",
      plannedDate: today,
    });
  });
  await expect(
    page.getByRole("button", { name: "Assistant captured task", exact: true }),
  ).toBeVisible();
  const input = page.getByRole("textbox", { name: "Add a task to this list" });
  await input.fill("Manually captured task");
  await input.press("Enter");
  await page.evaluate(async () =>
    (window as any).__FLOWTASK_MCP__.callTool("createTask", {
      title: "Another assistant task",
    }),
  );
  await expect
    .poll(async () => (await savedWorkspace(page)).tasks.length)
    .toBe(3);
  await page.evaluate(
    async (id) =>
      (window as any).__FLOWTASK_MCP__.callTool("startFocusSession", {
        taskId: id,
      }),
    task.task.id,
  );
  await expect(
    page.getByRole("button", { name: "Pause Focus Session", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Pause Focus Session", exact: true }),
  ).toBeVisible();
  expect((await savedWorkspace(page)).tasks.map((t: any) => t.title)).toContain(
    "Manually captured task",
  );
});

test("OS pause and resume persist through refresh and stop logs work exactly once", async ({
  page,
}) => {
  test.skip(!(await page.evaluate(() => Boolean(window.AudioContext || (window as any).webkitAudioContext))), 'This browser runtime has no Web Audio; silent focus fallback is tested separately.');
  await page.addInitScript(() => {
    const handlers: Record<string, MediaSessionActionHandler | null> = {};
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: {
        playbackState: "none",
        metadata: null,
        setActionHandler: (
          name: string,
          action: MediaSessionActionHandler | null,
        ) => {
          handlers[name] = action;
        },
      },
    });
    (window as any).__mediaActions = handlers;
  });
  await openWorkspace(page);
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  const studio = page.getByRole("dialog", {
    name: "Focus Studio",
    exact: true,
  });
  await studio.getByRole("button", { name: "Sound", exact: true }).click();
  await studio
    .getByRole("button", { name: "Brown noise", exact: true })
    .click();
  await studio
    .getByRole("button", { name: "Close customization panel", exact: true })
    .click();
  await studio
    .getByRole("button", { name: "Start focus", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => typeof (window as any).__mediaActions.pause),
    )
    .toBe("function");
  await page.waitForTimeout(1100);
  await page.evaluate(() => (window as any).__mediaActions.pause());
  await expect
    .poll(
      async () => (await savedWorkspace(page)).preferences.focusSession.state,
    )
    .toBe("paused");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume Focus Session", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resume Focus Session", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).__mediaActions.stop))
    .toBe("function");
  await page.evaluate(() => (window as any).__mediaActions.stop());
  await expect
    .poll(
      async () => (await savedWorkspace(page)).preferences.focusLogs?.length,
    )
    .toBe(1);
  await page.reload();
  expect((await savedWorkspace(page)).preferences.focusLogs).toHaveLength(1);
});

test('unavailable browser audio explains the fallback and preserves the focus timer', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
  });
  await openWorkspace(page);
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  const studio = page.getByRole('dialog', { name: 'Focus Studio', exact: true });
  await studio.getByRole('button', { name: 'Sound', exact: true }).click();
  await studio.getByRole('button', { name: 'Brown noise', exact: true }).click();
  await studio.getByRole('button', { name: 'Close customization panel', exact: true }).click();
  await studio.getByRole('button', { name: 'Start focus', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your focus timer will continue silently.' })).toBeVisible();
  await expect(studio.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await studio.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect.poll(async () => (await savedWorkspace(page)).preferences.focusSession?.state).toBe('paused');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume Focus Session', exact: true })).toBeVisible();
});

test("an uncached offline section keeps navigation and tasks available", async ({
  page,
  context,
}) => {
  await openWorkspace(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.getByRole("heading", { name: "Today.", exact: true }).waitFor();
  await context.setOffline(true);
  await page.locator('.sidebar-tools > summary').click();
  await page.getByRole("button", { name: "Study Hub", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Back to Today", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to Today", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Today.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Add a task to this list" })
    .fill("Captured while offline");
  await page
    .getByRole("textbox", { name: "Add a task to this list" })
    .press("Enter");
  await expect
    .poll(async () => (await savedWorkspace(page)).tasks.length)
    .toBe(1);
});

test("landing-to-onboarding uses the local calendar date before UTC midnight", async ({
  browser,
}) => {
  const context = await browser.newContext({ timezoneId: "Asia/Kolkata" });
  const page = await context.newPage();
  await page.clock.install({ time: new Date("2026-10-16T20:00:00Z") });
  await page.goto("/welcome");
  await page
    .getByRole("link", { name: "Continue to workspace", exact: true })
    .click();
  const setup = page.getByRole('region', { name: 'Start with one task', exact: true });
  await setup.getByRole('textbox', { name: 'Your first task' }).fill('Plan using my local date');
  await setup.getByRole('button', { name: 'Add task', exact: true }).click();
  await setup.getByRole('button', { name: 'Keep planning', exact: true }).click();
  await expect.poll(async () => (await savedWorkspace(page)).tasks.length).toBe(1);
  expect(
    (await savedWorkspace(page)).tasks.every(
      (task: any) => task.plannedDate === "2026-10-17",
    ),
  ).toBe(true);
  await context.close();
});

test("workspace JSON export includes customized desks and excludes active runtime state", async ({
  page,
}) => {
  await openWorkspace(page);
  await page
    .getByRole("button", { name: "Preferences and Settings", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: /Export JSON \/ CSV/ }).click();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download.*JSON/i }).click();
  const download = await downloadEvent;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.schemaVersion).toBe(6);
  expect(backup.dashboards).toHaveLength(4);
  expect(backup.preferences).not.toHaveProperty("focusSession");
});

test("empty views and navigation remain accessible without a configured account", async ({
  page,
}) => {
  await openWorkspace(page);
  for (const view of [
    "inbox",
    "projects",
    "timeline",
    "upcoming",
    "kanban",
    "matrix",
    "study",
    "review",
  ]) {
    await page.goto("/?view=" + view);
    await page.locator("[data-workspace-view]").waitFor();
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            reason: n.failureSummary,
          })),
        })),
    ).toEqual([]);
  }
});

test("task title survives an immediate close and the complete backup restores a changed desk", async ({
  page,
}) => {
  await openWorkspace(page);
  const input = page.getByRole("textbox", { name: "Add a task to this list" });
  await input.fill("Edit this task");
  await input.press("Enter");
  await page
    .getByRole("button", { name: "Edit this task", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Task title", exact: true })
    .fill("A title saved before leaving");
  await page
    .getByRole("textbox", { name: "Task title", exact: true })
    .press("Escape");
  await expect
    .poll(async () => (await savedWorkspace(page)).tasks[0].title)
    .toBe("A title saved before leaving");
  await page.reload();
  await page.getByRole("heading", { name: "Today.", exact: true }).waitFor();
  await expect(
    page.getByRole("button", {
      name: "A title saved before leaving",
      exact: true,
    }),
  ).toBeVisible();
});

for (const theme of ["light", "dark"])
  test(`all settings groups are usable and accessible in ${theme}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("flowtask_theme", theme),
      theme,
    );
    await openWorkspace(page);
    await page
      .getByRole("button", { name: "Preferences and Settings", exact: true })
      .first()
      .click();
    for (const name of [
      "Workspace",
      "Appearance",
      "Focus",
      "Sound",
      "Workflow",
      "Calendar",
      "Data",
      "Account",
    ]) {
      await page
        .getByRole("navigation", { name: "Settings groups" })
        .getByRole("button", { name, exact: true })
        .click();
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              reason: n.failureSummary,
            })),
          })),
        name,
      ).toEqual([]);
    }
  });

for (const size of [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
  { width: 844, height: 390 },
])
  test(`workspace and editor fit ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openWorkspace(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    await page.getByRole('button', { name: 'Dashboard widgets and layouts', exact: true }).click();
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    await page.getByRole('button', { name: 'Edit workspace', exact: true }).click();
    await expect(page.getByLabel('Workspace layout tools')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Widget', exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test("reduced motion, high contrast and a 200 percent zoom-equivalent viewport keep controls reachable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 720, height: 500 });
  await openWorkspace(page);
  await page.evaluate(() => {
    document.documentElement.dataset.highContrast = "true";
  });
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByRole('button', { name: 'Dashboard widgets and layouts', exact: true }).click();
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByRole('button', { name: 'Edit workspace', exact: true }).click();
  await expect(page.getByLabel('Workspace layout tools')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desktop preview', exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("PiP controls use the durable session lifecycle", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Document PiP is Chromium-only; other browsers use the mini-player.",
  );
  await page.addInitScript(() => {
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: {
        requestWindow: async () =>
          window.open("about:blank", "focus-pip-audit", "width=340,height=200"),
      },
    });
  });
  await openWorkspace(page);
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  const studio = page.getByRole("dialog", {
    name: "Focus Studio",
    exact: true,
  });
  await studio
    .getByRole("button", { name: "Start focus", exact: true })
    .click();
  const popupEvent = context.waitForEvent("page");
  await studio.getByRole("button", { name: /Floating timer/i }).click();
  const pip = await popupEvent;
  await pip
    .getByRole("button", { name: "Pause focus session", exact: true })
    .click();
  await expect
    .poll(
      async () => (await savedWorkspace(page)).preferences.focusSession.state,
    )
    .toBe("paused");
  await pip
    .getByRole("button", { name: "Resume focus session", exact: true })
    .click();
  await page.waitForTimeout(1100);
  await pip
    .getByRole("button", { name: "Stop focus session", exact: true })
    .click();
  await expect
    .poll(
      async () => (await savedWorkspace(page)).preferences.focusLogs?.length,
    )
    .toBe(1);
});

test("guided daily planning starts from the current plan and preserves it when saved unchanged", async ({
  page,
}) => {
  await openWorkspace(page);
  const input = page.getByRole("textbox", { name: "Add a task to this list" });
  await input.fill("Keep the first task");
  await input.press("Enter");
  await input.fill("Keep the second task");
  await input.press("Enter");
  const first = page.locator("[data-task-id]").filter({
    has: page.getByRole("button", {
      name: "Keep the first task",
      exact: true,
    }),
  });
  await first
    .getByRole("button", { name: "Pin to Top 3", exact: true })
    .click();
  await page.getByRole("button", { name: "Plan my day", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Make room for today",
    exact: true,
  });
  await expect(dialog.getByRole("checkbox", { checked: true })).toHaveCount(2);
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await page.getByRole("button", { name: "Save my plan", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await savedWorkspace(page)).tasks.filter((t: any) => t.plannedDate)
          .length,
    )
    .toBe(2);
  expect(
    (await savedWorkspace(page)).tasks.filter((t: any) => t.isPinnedToday),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Plan my day", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Make room for today", exact: true }),
  ).toBeVisible();
});
