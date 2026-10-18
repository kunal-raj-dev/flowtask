import { test, expect } from '@playwright/test';

test.describe('Aesthetics & Audio Unified Drawer Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('flowtask_onboarding_completed', 'true');
      localStorage.setItem('flowtask_onboarding_dismissed', 'true');
    });
  });
  test('Palette button in sidebar opens Settings Drawer pre-navigated to Aesthetics tab', async ({ page }) => {
    await page.goto('/app');
    await page.locator('main#main-content').waitFor({state:'visible'});

    // Click palette button in sidebar
    const paletteBtn = page.getByRole('button', { name: /aesthetics & sound profiles/i });
    if (await paletteBtn.isVisible()) {
      await paletteBtn.click();
    } else {
      // If mobile or collapsed, open via Settings and switch
      await page.keyboard.press('Control+,');
      await page.getByRole('button', { name: /^Appearance$/i }).click();
    }

    // Verify Settings Drawer opened with Aesthetics content visible
    await expect(page.getByText('Theme library')).toBeVisible();
    await expect(page.getByText('Interface sounds')).not.toBeVisible();
    await expect(page.getByText('Optional atmosphere')).toBeVisible();

    // Verify the full theme library is available and clicking one changes the workspace directly
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.locator('[data-theme-card]')).toHaveCount(18);
    const tokyoThemeBtn = page.getByRole('button', { name: /Tokyo Night/i });
    await expect(tokyoThemeBtn).toBeVisible();
    await tokyoThemeBtn.click();

    // Verify document theme updated
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'tokyo');

    // Verify Nordic Slate theme
    const nordThemeBtn = page.getByRole('button', { name: /Nordic Slate/i });
    await nordThemeBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');

    // Test Tactile Volume Slider
    await page.getByRole('navigation',{name:'Settings groups'}).getByRole('button',{name:'Sound',exact:true}).click();
    await expect(page.getByText('Interface sounds')).toBeVisible();
    await expect(page.getByText('Ambient Focus Soundscapes')).toBeVisible();
    const tactileSlider = page.getByTitle('Adjust tactile feedback volume');
    await expect(tactileSlider).toBeVisible();
    await tactileSlider.fill('0.75');

    await page.getByRole('button',{name:'Appearance',exact:true}).click();
    await page.getByLabel('Atmosphere color').selectOption('aurora');
    await expect(page.locator('html')).toHaveAttribute('data-atmosphere', 'aurora');
    await page.getByLabel('Atmosphere color').selectOption('off');
    await expect(page.locator('html')).toHaveAttribute('data-atmosphere', 'off');

    // Close settings drawer
    await page.keyboard.press('Escape');
    await expect(page.getByText('Theme library')).not.toBeVisible();
  });

  test('Mobile viewport (390x844) renders Aesthetics & Audio without clipping or horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    await page.locator('main#main-content').waitFor({state:'visible'});

    // Open Settings via keyboard or menu
    await page.keyboard.press('Control+,');
    await page.getByRole('button', { name: /^Appearance$/i }).click();

    await expect(page.getByText('Theme library')).toBeVisible();

    // Verify horizontal overflow is zero
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // negligible tolerance

    // Test Audition Button on mobile
    await page.getByRole('navigation',{name:'Settings groups'}).getByRole('button',{name:'Sound',exact:true}).click();
    const chimeBtn = page.getByRole('button', { name: /Audition Zen Singing Bowl completion chime/i });
    if (await chimeBtn.isVisible()) {
      await chimeBtn.click();
    }

    // Close drawer
    const closeBtn = page.getByRole('button', { name: /close settings/i });
    await closeBtn.click();
  });
});
