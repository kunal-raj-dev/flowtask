import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test.use({ timezoneId: "Asia/Kolkata", actionTimeout: 10000 });
async function openLibrary(page: Page) {
  await page.addInitScript(() => {
    if (localStorage.getItem("notes-test-seed")) return;
    localStorage.setItem("flowtask_onboarding_completed", "true");
    localStorage.setItem("flowtask_tasks_v1", "[]");
    localStorage.setItem("notes-test-seed", "true");
  });
  await page.goto("/app?view=notes");
  await expect(
    page.getByRole("heading", { name: "Notes.", exact: true }),
  ).toBeVisible();
}
async function create(page: Page, title: string, body: string) {
  await page
    .getByRole("button", { name: "New note", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Note title", exact: true })
    .fill(title);
  await page
    .getByRole("textbox", { name: "Note body", exact: true })
    .fill(body);
  await page.getByRole("textbox", { name: "Note body", exact: true }).blur();
  await expect(page.locator(".notes-save-state")).toHaveText(
    "Saved on this device",
  );
}

test("notes retain source context, task identity, history and portable backups", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openLibrary(page);
  await create(page, "Home renovation", "Call the builder about the kitchen");
  const url = page.url();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Note body", exact: true }),
  ).toHaveValue("Call the builder about the kitchen");
  await page.getByRole("textbox", { name: "Note body", exact: true }).focus();
  await page
    .getByRole("textbox", { name: "Note body", exact: true })
    .press("ControlOrMeta+A");
  await page
    .getByRole("button", { name: "Create linked task", exact: true })
    .click();
  const task = page.getByRole("dialog", { name: "Task Details", exact: true });
  await expect(task).toBeVisible();
  await expect(
    task.getByRole("textbox", { name: "Task title", exact: true }),
  ).toHaveValue("Call the builder about the kitchen");
  await task
    .getByRole("button", { name: "Home renovation", exact: true })
    .click();
  await expect(task).not.toBeVisible();
  await expect(page.locator(".note-connections")).toContainText(
    "Call the builder",
  );
  await create(page, "References", "Kitchen materials and finishes");
  await page.getByRole("button", { name: "Link note", exact: true }).click();
  await page
    .getByLabel("Link to note", { exact: true })
    .selectOption({ label: "Home renovation" });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page
    .getByRole("button", { name: "Home renovation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Referenced by", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Version history", exact: false })
    .click();
  await expect(
    page.getByRole("region", { name: "Note version history" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save a version now", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Note body", exact: true })
    .fill("Updated plan");
  await page.getByRole("textbox", { name: "Note body", exact: true }).blur();
  await page
    .locator(".note-history .notes-history-item")
    .filter({ hasText: "Home renovation" })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Restore this version", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Note body", exact: true }),
  ).toHaveValue("Call the builder about the kitchen");
  await page.getByRole("button", { name: "Archive note", exact: true }).click();
  await expect(
    page.getByText("This note is archived.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore note", exact: true }).click();
  await page
    .getByRole("button", { name: "Move note to trash", exact: true })
    .click();
  await expect(
    page.getByText("This note is in Trash.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore note", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: "Back up workspace", exact: true })
      .click(),
  ]);
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.notes).toHaveLength(2);
  expect(backup.tasks).toHaveLength(1);
  expect(backup.tasks[0].originNoteId).toBe(
    new URL(url).searchParams.get("note"),
  );
  await page
    .getByRole("button", { name: "Search and commands", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Command palette query", exact: true })
    .fill("type:note materials");
  await page
    .getByRole("button", { name: "Note: References", exact: false })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Note title", exact: true }),
  ).toHaveValue("References");
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "screenshots/connected-notes-desktop.png",
    fullPage: true,
  });
});

test("notes are readable and operable on a phone with safe Markdown preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLibrary(page);
  await create(
    page,
    "Weekend ideas",
    "## At home\n\n- [ ] Read a chapter\n\n<script>alert(1)</script>\n[unsafe](javascript:alert)\n[Reference](https://example.com)",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "At home", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".note-markdown script")).toHaveCount(0);
  await expect(page.locator(".note-markdown a")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const scan = await new AxeBuilder({ page })
    .include(".notes-workspace")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: "screenshots/connected-notes-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Search notes", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Today's note", exact: false })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Note title", exact: true }),
  ).toHaveValue(/^Daily note/);
});

test("installed production Notes reopen and save edits offline", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.FLOWTASK_PRODUCTION !== "true",
    "Service-worker guarantees require the production build.",
  );
  await openLibrary(page);
  await create(page, "Offline plans", "Before leaving home");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Note body", exact: true }),
  ).toHaveValue("Before leaving home");
  await page
    .getByRole("textbox", { name: "Note body", exact: true })
    .fill("Saved while offline");
  await page.getByRole("textbox", { name: "Note body", exact: true }).blur();
  await expect(page.locator(".notes-save-state")).toHaveText(
    "Saved on this device",
  );
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Note body", exact: true }),
  ).toHaveValue("Saved while offline");
  await context.setOffline(false);
});
