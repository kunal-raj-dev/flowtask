import { test, expect } from '@playwright/test';

test.describe('Diurnal Ambient Atmosphere System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear any previous overrides for pristine test environment
    await page.evaluate(() => {
      localStorage.removeItem('flowtask_diurnal_override');
      localStorage.removeItem('flowtask_diurnal_intensity');
    });
  });

  test('renders all 12 atmospheric presets across Circadian and Thematic Flow categories in Aesthetics modal', async ({ page }) => {
    // Open Aesthetics Modal from Sidebar
    await page.getByRole('button', { name: /Aesthetics & Sound Profiles/i }).click();

    // Verify modal header & title
    const dialog = page.getByRole('dialog', { name: /Aesthetics & Tactile Sound Profiles/i });
    await expect(dialog).toBeVisible();

    // Verify Section 4 Diurnal header
    await expect(dialog.getByText('Diurnal Ambient Atmosphere')).toBeVisible();
    await expect(dialog.getByText('12 Atmospheres')).toBeVisible();

    // Verify Category A: Circadian Rhythms (6 presets)
    await expect(dialog.getByText('Circadian Rhythms (Time-Based)')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Auto \(Circadian Sync\)/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Morning Dawn/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Midday Zenith/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Golden Dusk/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Evening Cosmic/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Midnight Starlight/i })).toBeVisible();

    // Verify Category B: Thematic Flow Atmospheres (6 presets)
    await expect(dialog.getByText('Thematic Flow Atmospheres (Focus & Mood)')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Northern Aurora/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Solar Flare/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Forest Canopy/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Cyber Synthwave/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Oceanic Abyss/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Twilight Lavender/i })).toBeVisible();
  });

  test('selecting a thematic atmosphere immediately updates DOM attributes, CSS variables, and layout glow', async ({ page }) => {
    await page.getByRole('button', { name: /Aesthetics & Sound Profiles/i }).click();

    const dialog = page.getByRole('dialog', { name: /Aesthetics & Tactile Sound Profiles/i });
    await expect(dialog).toBeVisible();

    // Select Northern Aurora
    await dialog.getByRole('button', { name: /Northern Aurora/i }).click();

    // Verify active indicator updates
    await expect(dialog.getByText('Active: Northern Aurora')).toBeVisible();

    // Verify DOM root attributes and CSS custom properties cascaded
    await expect.poll(async () => {
      return await page.evaluate(() => document.documentElement.getAttribute('data-diurnal'));
    }).toBe('aurora');

    const glowColor1 = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--diurnal-glow-1')
    );
    expect(glowColor1.toUpperCase()).toBe('#10B981');

    // Close modal with Escape key
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Verify persisted in localStorage
    const saved = await page.evaluate(() => localStorage.getItem('flowtask_diurnal_override'));
    expect(saved).toBe('aurora');
  });

  test('calibrates atmosphere intensity slider with real-time DOM update and local persistence', async ({ page }) => {
    await page.getByRole('button', { name: /Aesthetics & Sound Profiles/i }).click();

    const dialog = page.getByRole('dialog', { name: /Aesthetics & Tactile Sound Profiles/i });
    await expect(dialog).toBeVisible();

    // Locate the intensity slider
    const slider = dialog.getByTitle('Calibrate atmospheric glow intensity');
    await expect(slider).toBeVisible();

    // Adjust slider value to 85%
    await slider.fill('0.85');

    // Verify percentage badge reflects 85%
    await expect(dialog.getByText('85%')).toBeVisible();

    // Verify DOM style property updated
    await expect.poll(async () => {
      return await page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--diurnal-intensity')
      );
    }).toBe('0.85');

    // Verify persisted
    const savedIntensity = await page.evaluate(() =>
      localStorage.getItem('flowtask_diurnal_intensity')
    );
    expect(savedIntensity).toBe('0.85');
  });

  test('resets diurnal atmosphere to circadian auto clock', async ({ page }) => {
    await page.getByRole('button', { name: /Aesthetics & Sound Profiles/i }).click();

    const dialog = page.getByRole('dialog', { name: /Aesthetics & Tactile Sound Profiles/i });
    await expect(dialog).toBeVisible();

    // Select Cyber Synthwave
    await dialog.getByRole('button', { name: /Cyber Synthwave/i }).click();
    await expect(dialog.getByText('Active: Cyber Synthwave')).toBeVisible();

    // Click Reset to Auto
    const resetBtn = dialog.getByRole('button', { name: /Reset to Auto/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Verify status returns to Circadian Clock (Auto)
    await expect(dialog.getByText('Circadian Clock (Auto)')).toBeVisible();
    const saved = await page.evaluate(() => localStorage.getItem('flowtask_diurnal_override'));
    expect(saved).toBe('auto');
  });

  test('calibrates diurnal atmosphere inside Preferences Settings Drawer', async ({ page }) => {
    // Open Preferences and Settings (Ctrl+,)
    await page.getByRole('button', { name: /Preferences and Settings/i }).first().click();

    const drawer = page.getByRole('dialog', { name: /Application Settings/i });
    await expect(drawer).toBeVisible();

    // Navigate to Aesthetics & Audio tab
    await drawer.getByRole('button', { name: /Aesthetics & Audio/i }).click();

    // Verify Diurnal section exists in settings
    await expect(drawer.getByText('Diurnal Ambient Atmosphere')).toBeVisible();
    await expect(drawer.getByText('Circadian Presets')).toBeVisible();
    await expect(drawer.getByText('Thematic Flow Atmospheres')).toBeVisible();

    // Select Solar Flare
    await drawer.getByRole('button', { name: /Solar Flare/i }).click();

    // Verify active label badge updates
    await expect(drawer.getByText('Solar Flare').first()).toBeVisible();

    // Verify root attribute
    await expect.poll(async () => {
      return await page.evaluate(() => document.documentElement.getAttribute('data-diurnal'));
    }).toBe('solar');
  });
});
