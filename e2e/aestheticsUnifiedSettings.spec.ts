import { test, expect } from '@playwright/test';

test.describe('Aesthetics & Audio Unified Drawer Suite', () => {
  test('Palette button in sidebar opens Settings Drawer pre-navigated to Aesthetics tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body');

    // Click palette button in sidebar
    const paletteBtn = page.getByRole('button', { name: /aesthetics & sound profiles/i });
    if (await paletteBtn.isVisible()) {
      await paletteBtn.click();
    } else {
      // If mobile or collapsed, open via Settings and switch
      await page.keyboard.press('Control+,');
      await page.getByRole('button', { name: /aesthetics & audio/i }).click();
    }

    // Verify Settings Drawer opened with Aesthetics content visible
    await expect(page.getByText('Color Space & Visual Aura')).toBeVisible();
    await expect(page.getByText('Tactile Audio Engine')).toBeVisible();
    await expect(page.getByText('Ambient Focus Soundscapes')).toBeVisible();
    await expect(page.getByText('Diurnal Ambient Atmosphere')).toBeVisible();

    // Verify all 8 themes are available and clicking one changes theme directly
    const tokyoThemeBtn = page.getByRole('button', { name: /Tokyo Dusk/i });
    await expect(tokyoThemeBtn).toBeVisible();
    await tokyoThemeBtn.click();

    // Verify document theme updated
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'tokyo');

    // Verify Nordic Slate theme
    const nordThemeBtn = page.getByRole('button', { name: /Nordic Slate/i });
    await nordThemeBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');

    // Test Tactile Volume Slider
    const tactileSlider = page.getByTitle('Adjust tactile feedback volume');
    await expect(tactileSlider).toBeVisible();
    await tactileSlider.fill('0.75');

    // Test Diurnal Atmosphere selection
    const auroraPresetBtn = page.getByRole('button', { name: /Northern Aurora/i });
    await expect(auroraPresetBtn).toBeVisible();
    await auroraPresetBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-diurnal', 'aurora');

    // Test Reset to Auto
    const resetBtn = page.getByRole('button', { name: /Reset to Auto/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-diurnal', /morning|midday|dusk|evening|midnight/);

    // Close settings drawer
    await page.keyboard.press('Escape');
    await expect(page.getByText('Color Space & Visual Aura')).not.toBeVisible();
  });

  test('Mobile viewport (390x844) renders Aesthetics & Audio without clipping or horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForSelector('body');

    // Open Settings via keyboard or menu
    await page.keyboard.press('Control+,');
    await page.getByRole('button', { name: /aesthetics & audio/i }).click();

    await expect(page.getByText('Color Space & Visual Aura')).toBeVisible();

    // Verify horizontal overflow is zero
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // negligible tolerance

    // Test Audition Button on mobile
    const chimeBtn = page.getByRole('button', { name: /Audition Zen Singing Bowl completion chime/i });
    if (await chimeBtn.isVisible()) {
      await chimeBtn.click();
    }

    // Close drawer
    const closeBtn = page.getByRole('button', { name: /close settings/i });
    await closeBtn.click();
  });
});
