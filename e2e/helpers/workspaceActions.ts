import type { Page } from '@playwright/test';

/** Today keeps secondary tools in Options; modular dashboards retain Customize. */
export async function openWorkspaceCustomization(page: Page) {
  const direct = page.getByRole('button', { name: 'Customize', exact: true });
  const todayOptions = page.getByRole('button', { name: 'Today options', exact: true });
  await Promise.race([
    direct.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {}),
    todayOptions.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
  ]);
  if (await direct.isVisible()) {
    await direct.click();
    return;
  }
  await todayOptions.click();
  await page.getByRole('dialog', { name: 'Today options' }).getByRole('button', { name: 'Customize Today', exact: true }).click();
}
