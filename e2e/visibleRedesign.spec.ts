import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const baseline = process.env.FLOWTASK_CAPTURE_BASELINE === "true";
const stage = baseline ? "before" : "after";
async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("flowtask_onboarding_completed", "true");
    const d = new Date(),
      today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    localStorage.setItem(
      "flowtask_tasks_v1",
      JSON.stringify([
        {
          id: "redesign-a",
          title: "Understand binary search",
          nextAction: "Write the loop invariant",
          status: "todo",
          priority: "p2",
          projectId: "inbox",
          subtasks: [],
          createdAt: Date.now(),
          plannedDate: today,
          topThreeDate: today,
          isPinnedToday: true,
          estimatedMinutes: 50,
        },
        {
          id: "redesign-b",
          title: "Build the first working version",
          status: "todo",
          priority: "p3",
          projectId: "inbox",
          subtasks: [],
          createdAt: Date.now(),
          plannedDate: today,
          estimatedMinutes: 40,
        },
        {
          id: "redesign-c",
          title: "Read a chapter and take notes",
          status: "todo",
          priority: "p4",
          projectId: "inbox",
          subtasks: [],
          createdAt: Date.now(),
          plannedDate: today,
          estimatedMinutes: 30,
          scheduledStart: "15:00",
          scheduledEnd: "15:30",
        },
      ]),
    );
  });
}
async function accessible(page: Page) {
  const scan = await new AxeBuilder({ page }).analyze();
  expect(
    scan.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
for (const width of [390, 768, 1440])
  test(`redesign visual journey at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page
      .getByRole("link", { name: "Continue to workspace", exact: true })
      .waitFor();
    await page.screenshot({
      path: `screenshots/redesign-${stage}-landing-${width}.png`,
      fullPage: true,
    });
    if (!baseline) {
      await expect(
        page.getByRole("heading", { name: "Plan your day. Enter your flow." }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Preview Alpine Mirror", exact: true })
        .click();
      await expect(page.locator(".welcome-focus-preview")).toBeVisible();
      expect(
        await page.evaluate(() => localStorage.getItem("flowtask_tasks_v1")),
      ).toBeNull();
      await accessible(page);
    }
    await seed(page);
    await page.goto("/app");
    await page
      .getByRole("button", { name: "Understand binary search", exact: true })
      .first()
      .waitFor();
    await page.screenshot({
      path: `screenshots/redesign-${stage}-workspace-${width}.png`,
      fullPage: true,
    });
    if (!baseline) {
      await expect(page.locator(".daily-desk")).toBeVisible();
      await accessible(page);
    }
    await page
      .getByRole("button", {
        name: "Focus on Understand binary search",
        exact: true,
      })
      .first()
      .click();
    const studio = page.getByRole("dialog", {
      name: "Focus Studio",
      exact: true,
    });
    await studio.waitFor();
    if (!baseline) {
      await expect(studio.locator(".studio-lobby")).toBeVisible();
      await accessible(page);
    }
    await page.screenshot({
      path: `screenshots/redesign-${stage}-lobby-${width}.png`,
      fullPage: true,
    });
    await studio
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await expect(
      studio.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    if (!baseline) {
      await expect(studio.locator(".studio-lobby")).toHaveCount(0);
      await accessible(page);
    }
    await page.screenshot({
      path: `screenshots/redesign-${stage}-focus-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
