import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function seedWorkspace(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("flowtask_theme", "light");
    localStorage.setItem("flowtask_onboarding_completed", "true");
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    localStorage.setItem("flowtask_tasks_v1", JSON.stringify([
      { id: "visual-task-1", title: "Prepare the project outline", status: "todo", priority: "p1", projectId: "work", plannedDate: today, topThreeDate: today, isPinnedToday: true, estimatedMinutes: 30, createdAt: Date.now() },
      { id: "visual-task-2", title: "Review the first milestone", status: "todo", priority: "p2", projectId: "work", tags: ["planning", "roadmap"], estimatedMinutes: 20, createdAt: Date.now() + 1 },
    ]));
  });
  await page.goto("/?view=today");
  await page.getByRole("heading", { name: "Today.", exact: true }).waitFor();
  await expect(page.locator(".desk-dashboard-cover")).toHaveCount(0);
}

async function workspace(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("flowtask_storage_v2"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    return new Promise<any>((resolve, reject) => { const request = db.transaction("workspaces").objectStore("workspaces").get("local"); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => { db.close(); reject(request.error); }; });
  });
}

test("workspace image picker applies explicit covers and preserves them after reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedWorkspace(page);

  await page.getByRole("button", { name: "Switch dashboard" }).click();
  const desks = page.getByRole("dialog", { name: "Your desks" });
  await desks.getByRole("button", { name: "Choose an image", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Choose a workspace image" });
  await picker.getByRole("tab", { name: "Study & Research" }).click();
  await picker.getByRole("button", { name: "Select Morning Library" }).click();
  await expect(picker.getByLabel("Horizontal position")).toBeVisible();
  const pickerAudit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(pickerAudit.violations.filter(issue => issue.impact === "critical" || issue.impact === "serious").map(issue => issue.id)).toEqual([]);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `workspace should not overflow at ${width}px`).toBe(true);
    const pickerBounds = await picker.boundingBox();
    expect(pickerBounds, `image picker should be visible at ${width}px`).not.toBeNull();
    expect(pickerBounds!.x, `image picker should stay inside the left edge at ${width}px`).toBeGreaterThanOrEqual(0);
    expect(pickerBounds!.x + pickerBounds!.width, `image picker should stay inside the right edge at ${width}px`).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await picker.getByRole("button", { name: "Use image" }).click();
  await expect(page.locator(".desk-dashboard-cover")).toHaveAttribute("src", /ws-morning-library-960\.webp/);
  await expect.poll(async () => (await workspace(page)).dashboards[0].coverImage).toBe("ws-morning-library");
  await expect.poll(async () => (await workspace(page)).dashboards[0].coverFocalPoint).toEqual({ x: 50, y: 50 });

  await page.reload();
  await page.getByRole("heading", { name: "Today.", exact: true }).waitFor();
  await expect(page.locator(".desk-dashboard-cover")).toHaveAttribute("src", /ws-morning-library-960\.webp/);

  await page.goto("/?view=projects");
  const workCard = page.locator("[data-project-card]").filter({ hasText: "Work" }).first();
  await workCard.click();
  await expect(page.getByText("Project Workspace", { exact: true })).toBeVisible();
  await page.getByText("Project details", { exact: true }).click();
  await page.getByRole("button", { name: "Choose image", exact: true }).click();
  const projectPicker = page.getByRole("dialog", { name: "Choose a workspace image" });
  await projectPicker.getByRole("tab", { name: "Code & Build" }).click();
  await projectPicker.getByRole("button", { name: "Select Quiet Code Studio" }).click();
  const projectPickerAudit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(projectPickerAudit.violations.filter(issue => issue.impact === "critical" || issue.impact === "serious").map(issue => issue.id)).toEqual([]);
  await projectPicker.getByRole("button", { name: "Use image" }).click();
  await expect(page.locator(".desk-project-cover")).toHaveAttribute("src", /ws-quiet-code-studio-960\.webp/);
  await expect.poll(async () => (await workspace(page)).projects.find((project: any) => project.id === "work")?.coverAssetId).toBe("ws-quiet-code-studio");
  await expect.poll(async () => (await workspace(page)).projects.find((project: any) => project.id === "work")?.coverFocalPoint).toEqual({ x: 52, y: 52 });

  await page.getByRole("button", { name: /^Today/ }).click();
  await page.getByRole("button", { name: "Edit workspace", exact: true }).click();
  await page.getByRole("button", { name: "Add Widget", exact: true }).click();
  const widgetCard = page.getByRole("dialog", { name: "Add Widget to Workspace" }).locator("article").filter({ has: page.getByRole("heading", { name: "Quiet Scene & Clock", exact: true }) });
  await widgetCard.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Configure Desk Atmosphere", exact: true }).click();
  const widgetSettings = page.getByRole("dialog", { name: "Configure Quiet Scene & Clock" });
  await widgetSettings.getByRole("button", { name: "Choose an image", exact: true }).click();
  const scenePicker = page.getByRole("dialog", { name: "Choose a workspace image" });
  await expect(scenePicker).toBeVisible();
  await page.waitForTimeout(220);
  const scenePickerAudit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const sceneContrastIssues = scenePickerAudit.violations.filter(issue => issue.impact === "critical" || issue.impact === "serious");
  expect(sceneContrastIssues.map(issue => issue.id), JSON.stringify(sceneContrastIssues.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })))).toEqual([]);
  await scenePicker.getByRole("tab", { name: "Planning" }).click();
  await scenePicker.getByRole("button", { name: "Select Morning Priorities" }).click();
  await scenePicker.getByRole("button", { name: "Use image" }).click();
  await widgetSettings.getByRole("button", { name: "Apply Changes", exact: true }).click();
  await page.getByRole("button", { name: "Save Layout", exact: true }).click();
  await expect(page.locator(".desk-quiet-scene img")).toHaveAttribute("src", /ws-morning-priorities-960\.webp/);
  await expect.poll(async () => (await workspace(page)).dashboards[0].widgets.find((widget: any) => widget.type === "quietScene")?.config.sceneId).toBe("ws-morning-priorities");
});
