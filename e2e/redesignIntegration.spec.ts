import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { normalizeDashboard } from '../src/utils/dashboardModel';
test.use({serviceWorkers:'block'});
async function enter(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("flowtask_onboarding_completed", "true"),
  );
  await page.goto("/app");
  await page.locator(".daily-desk").waitFor();
}
async function record(page: Page, transform?: string) {
  return page.evaluate(async (transform) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("flowtask_storage_v2");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return new Promise<any>((resolve, reject) => {
      const tx = db.transaction(
          "workspaces",
          transform ? "readwrite" : "readonly",
        ),
        store = tx.objectStore("workspaces"),
        r = store.get("local");
      let value: any;
      r.onsuccess = () => {
        value = r.result;
        if (transform) {
          const old = structuredClone(value.dashboards[0]);
          old.id = "original-desk";
          old.name = "My original desk";
          old.widgets.push({
            id: "old-capacity",
            type: "capacityProgress",
            title: "Capacity",
            config: {},
          });
          old.layouts.lg.push({ i: "old-capacity", x: 0, y: 20, w: 6, h: 3 });
          value.dashboards =
            transform === "limit"
              ? Array.from({ length: 20 }, (_, i) => ({
                  ...structuredClone(old),
                  id: i ? "custom-" + i : old.id,
                  name: i ? "Custom " + i : old.name,
                  order: i,
                  isDefault: !i,
                }))
              : [old, ...value.dashboards.slice(1)];
          value.preferences.activeDashboardId = old.id;
          store.put(value);
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(value);
      };
      tx.onerror = () => reject(tx.error);
    });
  }, transform);
}
test("returning desk opts in without replacing saved layouts, and survives reload", async ({
  page,
}) => {
  await enter(page);
  await record(page, "legacy");
  await page.reload();
  const before = await record(page);
  await page
    .getByRole("button", { name: "Try the new Daily Desk", exact: true })
    .click();
  await expect(page.locator(".daily-desk")).toBeVisible();
  await expect
    .poll(async () => (await record(page)).dashboards.length)
    .toBe(before.dashboards.length + 1);
  const after = await record(page);
  expect(after.dashboards.find((d: any) => d.id === "original-desk")).toEqual(
    normalizeDashboard(before.dashboards[0]),
  );
  expect(after.preferences.workspace.presentation).toMatchObject({
    version: 1,
    offerDismissed: true,
    dailyDeskId: after.preferences.activeDashboardId,
  });
  await page.reload();
  await expect(page.locator(".daily-desk")).toBeVisible();
});
test("dismissed upgrade stays dismissed and full desks use cancelable preview", async ({
  page,
}) => {
  await enter(page);
  await record(page, "limit");
  await page.reload();
  const before = await record(page);
  await page
    .getByRole("button", { name: "Try the new Daily Desk", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save Layout", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await record(page)).dashboards).toEqual(before.dashboards);
  await page
    .getByRole("button", { name: "Dismiss Daily Desk offer", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await record(page)).preferences.workspace.presentation.offerDismissed,
    )
    .toBe(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Try the new Daily Desk", exact: true }),
  ).toHaveCount(0);
});
test("empty mobile workspace, day context and reduced motion keep controls accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await expect(
    page
      .locator(".daily-next")
      .getByRole("button", { name: "Start focus", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: "screenshots/redesign-after-empty-360.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Day context", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Day context", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.locator("summary").filter({ hasText: "Quick notes" }).click();
  await dialog
    .getByRole("textbox", { name: "Workspace scratchpad", exact: true })
    .fill("Save a small thought");
  await page.keyboard.press("Escape");
  await page.goto("/app?view=inbox");
  await expect
    .poll(async () => (await record(page)).preferences.scratchpad)
    .toBe("Save a small thought");
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
});
test("build identity and the welcome shortcut are available from the workspace", async ({
  page,
}) => {
  await enter(page);
  await page.keyboard.press("Control+,");
  await page.getByRole("button", { name: "About", exact: true }).click();
  const identity = page.locator("[data-build]");
  await expect(identity).toHaveAttribute(
    "data-build",
    /[a-f0-9]{40}|development/,
  );
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Visit welcome page", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Plan your day. Enter your flow." }),
  ).toBeVisible();
});
test("clear and fullscreen shortcuts are distinct, while failed scenes can recover", async ({
  page,
}) => {
  await enter(page);
  const launch = page.getByRole("button", {
    name: "Launch Focus Mode",
    exact: true,
  });
  if (await launch.isVisible()) await launch.click();
  else await page.getByRole("button", { name: /^Focus Studio/ }).first().click();
  const studio = page.getByRole("dialog", {
    name: "Focus Studio",
    exact: true,
  });
  await studio.waitFor();
  await page.keyboard.press("c");
  await expect(studio).toHaveClass(/is-clear/);
  await page.keyboard.press("c");
  await expect(studio).not.toHaveClass(/is-clear/);
  await page.keyboard.press("f");
  await expect(studio).not.toHaveClass(/is-clear/);
  await page.keyboard.press("f");
  await page.route("**/rainy-desk*.webp", (route) => route.abort());
  await studio
    .getByRole("button", { name: "Choose Rainy Desk room", exact: true })
    .click();
  await expect(
    studio.getByText(
      "This background is unavailable. Your focus session is unaffected.",
    ),
  ).toBeVisible();
  await studio
    .getByRole("button", { name: "Choose Alpine Mirror room", exact: true })
    .click();
  await expect
    .poll(() =>
      studio
        .locator(".studio-backdrop img")
        .evaluate(
          (img: HTMLImageElement) =>
            img.complete &&
            img.naturalWidth > 0 &&
            getComputedStyle(img).display !== "none",
        ),
    )
    .toBe(true);
  await studio
    .getByRole("button", { name: "Start focus", exact: true })
    .click();
  await expect(
    studio.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
});
test("dark theme preserves the new workspace hierarchy", async ({ page }) => {
  await enter(page);
  await page.keyboard.press("Control+,");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page
    .getByRole("button", { name: "Apply Oceanic Abyss theme", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "abyss");
  await page.screenshot({
    path: "screenshots/redesign-after-workspace-dark.png",
    fullPage: true,
  });
  await expect(page.locator(".daily-desk")).toBeVisible();
});
