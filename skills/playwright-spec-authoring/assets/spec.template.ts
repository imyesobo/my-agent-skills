import { test, expect } from '@playwright/test';
import {
  STORAGE_STATE,
  downloadFrom,
  expectPopupFrom,
  expectPrintCalled,
  openLandingPage,
  openMenu,
  passSecurityCheckIfNeeded,
  stubPrint,
} from './helpers/<site>';

/**
 * <Journey>: <what it covers>.
 * Out of scope: <operations deliberately not exercised, e.g. anything that creates, pays,
 * transfers, deletes or changes settings>.
 */

const ITEM_NAME = '<name exactly as shown on the page>';

test.use({ storageState: STORAGE_STATE });

test('<Journey>: <sections>', async ({ page }) => {
  // Remove if the journey never presses a Print button.
  await stubPrint(page);

  // --- Landing page (goto + manual login wait + overlays) ---
  await openLandingPage(page);

  // --- Open the item ---
  // await page.locator('<host-tag>[<attr>*="<ITEM_NAME>"]').click();
  // await expect(page).toHaveURL(/#item\//);
  // await expect(page.getByRole('heading', { name: ITEM_NAME, level: 1 })).toBeVisible();

  // --- <Section: paste the recorded steps, one assertion after each> ---
  // await page.getByRole('button', { name: 'Filter' }).click();
  // await expect(page.getByRole('heading', { name: 'Filters', level: 1 })).toBeVisible();

  // --- Menu behind an unnamed icon (retrying opener) ---
  // await openMenu(page, page.getByTestId('item-menu'), page.getByRole('heading', { name: /<menu title>/ }));
  // await page.getByRole('link', { name: '<item>' }).click();
  // await passSecurityCheckIfNeeded(page, page.getByRole('heading', { name: '<heading proving the page loaded>' }));

  // --- Download ---
  // const file = await downloadFrom(page, page.getByRole('button', { name: 'Download' }));
  // expect(file.suggestedFilename()).toMatch(/\.pdf$/i);

  // --- New tab ---
  // await expectPopupFrom(page, page.getByRole('link', { name: '<item>' }), /<url pattern>/);

  // --- Print ---
  // await page.getByRole('button', { name: 'Print' }).click();
  // await expectPrintCalled(page);

  // --- Final outcome ---
  // await expect(page.getByRole('heading', { name: '<outcome>' })).toBeVisible();
});
