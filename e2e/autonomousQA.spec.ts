import { test, expect } from '@playwright/test';
import { seedPlanner } from './helpers/plannerWorkspace';

test.describe('Autonomous QA Inspection - Focus Mode Deep Dive & Fullscreen', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.text()));
    await seedPlanner(page);
    await page.goto('/app');
    await page.locator('main#main-content').waitFor({ state: 'visible' });
  });

  test('audit Focus Studio circular timer geometry, centering, and typography', async ({ page }) => {
    // Open Focus Studio
    const studioEntry = page.getByRole('button', { name: /^Focus Studio/ }).first();
    if (await studioEntry.isVisible()) {
      await studioEntry.click();
    } else {
      await page.getByRole('button', { name: 'Launch Focus Mode', exact: true }).click();
    }
    const studio = page.getByRole('dialog', { name: 'Focus Studio', exact: true });
    await expect(studio).toBeVisible();

    // Check timer clock container and ring
    const clock = studio.locator('.studio-clock');
    await expect(clock).toBeVisible();

    // Check if ring is rendered by default (p.timerStyle === "ring")
    const ringSvg = clock.locator('svg');
    const hasRing = await ringSvg.isVisible();
    console.log('[QA] Has Ring SVG:', hasRing);

    if (hasRing) {
      const ringBounds = await ringSvg.boundingBox();
      const textSpan = clock.locator('> span');
      const textBounds = await textSpan.boundingBox();
      console.log('[QA] Ring SVG BoundingBox:', ringBounds);
      console.log('[QA] Text Span BoundingBox:', textBounds);

      const clockStyles = await clock.evaluate(el => {
        const s = getComputedStyle(el);
        // Inspect matched CSS rules
        const rules = [];
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules || [])) {
              if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
                rules.push({ selector: rule.selectorText, cssText: rule.style.cssText });
              }
            }
          } catch {}
        }
        return {
          clockClass: el.className,
          parentClass: el.parentElement?.className,
          clockWidth: s.width,
          clockHeight: s.height,
          rules,
        };
      });
      console.log('[QA] Computed styles:', JSON.stringify(clockStyles, null, 2));

      // Verify text is inside SVG ring bounds and horizontally / vertically centered
      if (ringBounds && textBounds) {
        const ringCenterX = ringBounds.x + ringBounds.width / 2;
        const ringCenterY = ringBounds.y + ringBounds.height / 2;
        const textCenterX = textBounds.x + textBounds.width / 2;
        const textCenterY = textBounds.y + textBounds.height / 2;
        const deltaX = Math.abs(ringCenterX - textCenterX);
        const deltaY = Math.abs(ringCenterY - textCenterY);
        console.log(`[QA] Center Alignment: DeltaX=${deltaX.toFixed(2)}px, DeltaY=${deltaY.toFixed(2)}px`);
        expect(deltaX).toBeLessThan(15);
        expect(deltaY).toBeLessThan(15);
      }
    }

    // Now start the timer into session mode
    await studio.getByRole('button', { name: 'Start focus', exact: true }).click();
    await expect(studio.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    const sessionClock = studio.locator('.studio-clock');
    const sessionRingSvg = sessionClock.locator('svg');
    const sessionRingBounds = await sessionRingSvg.boundingBox();
    const sessionTextSpan = sessionClock.locator('> span');
    const sessionTextBounds = await sessionTextSpan.boundingBox();
    console.log('[QA] Session Mode Ring SVG BoundingBox:', sessionRingBounds);
    console.log('[QA] Session Mode Text Span BoundingBox:', sessionTextBounds);

    const sessionClockStyles = await sessionClock.evaluate(el => {
      const s = getComputedStyle(el);
      return {
        clockWidth: s.width,
        clockHeight: s.height,
        clockDisplay: s.display,
        fontSize: s.fontSize,
      };
    });
    console.log('[QA] Session Mode Computed styles:', JSON.stringify(sessionClockStyles, null, 2));

    await page.screenshot({ path: 'screenshots/qa-focus-studio-running.png' });
  });

  test('audit Fullscreen toggle button state and Escape behavior', async ({ page }) => {
    const studioEntry = page.getByRole('button', { name: /^Focus Studio/ }).first();
    if (await studioEntry.isVisible()) {
      await studioEntry.click();
    } else {
      await page.getByRole('button', { name: 'Launch Focus Mode', exact: true }).click();
    }
    const studio = page.getByRole('dialog', { name: 'Focus Studio', exact: true });
    await expect(studio).toBeVisible();

    const getFsBtn = () => studio.getByRole('button', { name: /fullscreen/i });
    await expect(getFsBtn()).toBeVisible();

    // Inspect initial fullscreen state in DOM
    const initialFs = await page.evaluate(() => Boolean(document.fullscreenElement));
    console.log('[QA] Initial document.fullscreenElement:', initialFs);

    // Mock Element.prototype.requestFullscreen and exitFullscreen
    await page.evaluate(() => {
      let isMockFs = false;
      const setFs = (val: boolean) => {
        isMockFs = val;
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          get: () => (isMockFs ? document.body : null),
        });
        document.dispatchEvent(new Event('fullscreenchange'));
      };

      Element.prototype.requestFullscreen = async function () {
        setFs(true);
      };
      (Element.prototype as any).webkitRequestFullscreen = async function () {
        setFs(true);
      };
      document.exitFullscreen = async function () {
        setFs(false);
      };
      (document as any).webkitExitFullscreen = async function () {
        setFs(false);
      };
    });

    // Click toggle fullscreen
    await getFsBtn().click();
    const isNowFs = await page.evaluate(() => Boolean(document.fullscreenElement));
    console.log('[QA] After Click document.fullscreenElement:', isNowFs);

    // Check if the button updated its accessible name and title
    const buttonTitle = await getFsBtn().getAttribute('title');
    console.log('[QA] Fullscreen Button Title after entering:', buttonTitle);
    expect(buttonTitle).toContain('Exit fullscreen');

    // Now test Escape key: In fullscreen, pressing Escape should exit fullscreen but KEEP studio open!
    await page.keyboard.press('Escape');
    const isFsAfterEsc = await page.evaluate(() => Boolean(document.fullscreenElement));
    console.log('[QA] After Escape document.fullscreenElement:', isFsAfterEsc);
    console.log('[QA] Studio still visible after first Escape:', await studio.isVisible());

    // Expect fullscreen to have exited, and studio to STILL be visible!
    expect(isFsAfterEsc).toBe(false);
    expect(await studio.isVisible()).toBe(true);

    // Second Escape: Closes the studio!
    await page.keyboard.press('Escape');
    await expect(studio).not.toBeVisible();
    console.log('[QA] Studio successfully closed after second Escape.');
  });
});
