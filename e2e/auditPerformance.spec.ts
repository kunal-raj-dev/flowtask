import { test, expect } from "@playwright/test";

for (const width of [1440, 390])
  test(`local performance sample with 1000 tasks at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      localStorage.setItem("flowtask_onboarding_completed", "true");
      const now = new Date(),
        today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      localStorage.setItem(
        "flowtask_tasks_v1",
        JSON.stringify(
          Array.from({ length: 1000 }, (_, i) => ({
            id: "perf-" + i,
            title: "Performance sample task " + i,
            status: "todo",
            priority: "p3",
            projectId: "inbox",
            plannedDate: today,
            createdAt: Date.now() + i,
            subtasks: [],
          })),
        ),
      );
      const sample = {
        lcpMs: null as number | null,
        cls: 0,
        maxObservedEventMs: 0,
        longTaskCount: 0,
        maxLongTaskMs: 0,
      };
      (window as any).__auditPerformance = sample;
      for (const type of [
        "largest-contentful-paint",
        "layout-shift",
        "event",
        "longtask",
      ]) {
        if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (type === "largest-contentful-paint")
              sample.lcpMs = entry.startTime;
            if (type === "layout-shift" && !entry.hadRecentInput)
              sample.cls += entry.value;
            if (type === "event")
              sample.maxObservedEventMs = Math.max(
                sample.maxObservedEventMs,
                entry.duration,
              );
            if (type === "longtask") {
              sample.longTaskCount++;
              sample.maxLongTaskMs = Math.max(
                sample.maxLongTaskMs,
                entry.duration,
              );
            }
          }
        }).observe({
          type,
          buffered: true,
          durationThreshold: 16,
        } as PerformanceObserverInit);
      }
    });
    await page.goto("/app");
    await page.getByRole("heading", { name: "Today.", exact: true }).waitFor();
    await page
      .getByRole("textbox", { name: "Add a task to this list" })
      .fill("Typing stays available with a large workspace");
    await page
      .getByRole("textbox", { name: "Add a task to this list" })
      .press("Enter");
    await expect(
      page.getByRole("button", {
        name: "Typing stays available with a large workspace",
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.locator("[data-task-id]").count()).toBeLessThan(80);
    await page
      .getByRole("button", { name: "Edit workspace", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Move Top 3 Priorities later", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.waitForTimeout(1000);
    const sample = await page.evaluate(() => ({
      ...(window as any).__auditPerformance,
      renderedTaskRows: document.querySelectorAll("[data-task-id]").length,
      transferredBytes: performance
        .getEntriesByType("resource")
        .reduce(
          (sum, entry) =>
            sum + (entry as PerformanceResourceTiming).transferSize,
          0,
        ),
    }));
    await testInfo.attach(`local-performance-${width}.json`, {
      body: JSON.stringify(
        {
          width,
          conditions:
            "Local production preview; no CPU/network throttling; one synthetic journey. Event timing is not field INP.",
          ...sample,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });
