import { expect, type Locator, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Site-specific constants — adapt these; everything below is generic.
// ---------------------------------------------------------------------------
export const START_URL = 'https://example.com';
/** URL the app lands on once the user is logged in. */
const LOGGED_IN_URL = /#home/;
/** URL(s) of the login / consent / 2FA screens. */
const LOGIN_URL = /login/;
/** Accessible names of buttons that dismiss post-login announcements. */
const OVERLAY_DISMISS_NAMES = /^(Close|Cerrar|Got it|Entendido|Not now|Ahora no|Later|Skip)$/i;
/** Heading shown when the site asks the user to re-authenticate (device/2FA). */
const SECURITY_CHECK_HEADING = 'Please confirm it is you';
/** Element proving the landing page is ready (used before dismissing overlays). */
const LANDING_READY = (page: Page) => page.getByRole('heading', { level: 1 }).first();

export const STORAGE_STATE = '.auth/state.json';
export const MANUAL_STEP_TIMEOUT = 5 * 60 * 1000;

/**
 * Many sites do not restore a session from storage state. If the app bounces to the login
 * screen, wait for the user to log in manually in the headed window (no credentials are typed
 * by the test), then refresh the saved storage state.
 */
export async function ensureLoggedIn(page: Page) {
  const loggedIn = page.waitForURL(LOGGED_IN_URL, { timeout: MANUAL_STEP_TIMEOUT });
  const atLogin = await page
    .waitForURL(LOGIN_URL, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (atLogin) {
    console.log('>>> Login required. Please log in manually in the browser window...');
  }
  await loggedIn;
  await page.context().storageState({ path: STORAGE_STATE });
}

/**
 * Dismiss announcement/notification overlays shown after login.
 * Do not scope to getByRole('dialog'): on web-component sites the close button is usually a
 * slotted light-DOM child and not a descendant of the role=dialog node.
 */
export async function dismissOverlays(page: Page) {
  const dismissButtons = page.getByRole('button', { name: OVERLAY_DISMISS_NAMES });
  await dismissButtons.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  for (let i = 0; i < 5; i++) {
    const count = await dismissButtons.count().catch(() => 0);
    let closedAny = false;
    for (let d = 0; d < count; d++) {
      const button = dismissButtons.nth(d);
      if (await button.isVisible({ timeout: 1_000 }).catch(() => false)) {
        const label = await button.evaluate((b) => b.getAttribute('aria-label') || b.textContent?.trim());
        console.log(`>>> Dismissing overlay via "${label}"`);
        await button.click();
        await expect(button).toBeHidden({ timeout: 10_000 });
        closedAny = true;
        break;
      }
    }
    if (!closedAny) break;
  }
}

/** goto + manual login wait + overlay dismissal. First line of every spec. */
export async function openLandingPage(page: Page) {
  await page.goto(START_URL);
  await ensureLoggedIn(page);
  await expect(LANDING_READY(page)).toBeVisible();
  await dismissOverlays(page);
}

/** Print buttons call window.print(), which opens a native dialog Playwright cannot drive. */
export async function stubPrint(page: Page) {
  await page.addInitScript(() => {
    (window as any).__printCalls = 0;
    window.print = () => {
      (window as any).__printCalls += 1;
    };
  });
}

export async function expectPrintCalled(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as any).__printCalls)).toBeGreaterThan(0);
}

/**
 * Open a menu whose trigger may be re-rendered right after navigation (click lands on a stale
 * node). Retries until `opened` is visible.
 */
export async function openMenu(page: Page, trigger: Locator, opened: Locator) {
  await expect(async () => {
    await trigger.click();
    await expect(opened).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000, intervals: [1_000, 2_000] });
}

export function securityCheck(page: Page) {
  return page.getByRole('heading', { name: SECURITY_CHECK_HEADING });
}

/**
 * Some sections require a second factor. Only the user can approve it, so wait until
 * `expected` shows up after they do.
 */
export async function passSecurityCheckIfNeeded(page: Page, expected: Locator) {
  await expect(expected.or(securityCheck(page)).first()).toBeVisible({ timeout: 30_000 });
  if (await securityCheck(page).isVisible().catch(() => false)) {
    console.log('>>> Security validation required. Please approve it on your phone / in the browser...');
    await expect(expected).toBeVisible({ timeout: MANUAL_STEP_TIMEOUT });
  }
}

/** Click `trigger` and return the download it produces (tolerates a 2FA prompt in between). */
export async function downloadFrom(page: Page, trigger: Locator) {
  const download = page.waitForEvent('download', { timeout: MANUAL_STEP_TIMEOUT });
  await trigger.click();
  securityCheck(page)
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => console.log('>>> Security validation required for the download. Please approve it...'))
    .catch(() => {});
  return download;
}

/** Click `trigger`, wait for the new tab it opens, assert its URL and close it. */
export async function expectPopupFrom(page: Page, trigger: Locator, urlPattern: RegExp) {
  // Server-generated documents can be slow; the listener is registered before the click.
  const first = page.waitForEvent('popup', { timeout: 30_000 }).catch(() => null);
  await trigger.click();
  let popup = await first;
  if (!popup) {
    console.log('>>> No new tab yet; clicking again...');
    const second = page.waitForEvent('popup', { timeout: 60_000 });
    await trigger.click();
    popup = await second;
  }
  const openedPopup = popup;
  await expect.poll(() => openedPopup.url(), { timeout: 30_000 }).toMatch(urlPattern);
  await openedPopup.close();
}
