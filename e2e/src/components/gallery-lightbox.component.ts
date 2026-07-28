import { expect, type Locator, type Page } from '@playwright/test';
import { tid } from '@config/testids';

/**
 * The vendor-detail gallery lightbox
 * (`features/website/components/gallery.tsx`).
 *
 * This is the best-instrumented component in the whole app — the only one with a
 * real `role="dialog"` + `aria-modal`, and the only one with keyboard handling. So
 * it is worth testing thoroughly, and worth noting what it still lacks.
 *
 * Behaviour verified from source:
 *  - the grid renders buttons `aria-label="View image {n}"` (1-indexed);
 *  - the dialog is `role="dialog" aria-modal="true" aria-label="{vendorName} gallery"`;
 *  - controls are `Close`, `Previous image`, `Next image`;
 *  - keyboard: Escape closes, ArrowLeft/ArrowRight navigate;
 *  - clicking the backdrop closes it;
 *  - `document.body.style.overflow = 'hidden'` while open, restored on close;
 *  - a counter reads `"{i+1} / {n}"`;
 *  - navigation WRAPS at both ends.
 *
 * What it lacks: a focus trap. `aria-modal="true"` claims one, but focus is not
 * actually contained, so Tab escapes to the page behind. The focus-trap spec
 * asserts current behaviour and is marked expected-fail so it flips green when a
 * trap lands.
 */
export class GalleryLightboxComponent {
  constructor(private readonly page: Page) {}

  get grid(): Locator {
    return this.page.getByTestId(tid.vdetail.gallery);
  }

  /** @param n 1-indexed, matching the app's own `aria-label="View image {n}"`. */
  thumbnail(n: number): Locator {
    return this.page.getByRole('button', { name: `View image ${n}` });
  }

  async thumbnailCount(): Promise<number> {
    return this.page.getByRole('button', { name: /^View image \d+$/ }).count();
  }

  get dialog(): Locator {
    return this.page.getByRole('dialog');
  }

  get closeButton(): Locator {
    return this.dialog.getByRole('button', { name: 'Close' });
  }

  get previousButton(): Locator {
    return this.dialog.getByRole('button', { name: 'Previous image' });
  }

  get nextButton(): Locator {
    return this.dialog.getByRole('button', { name: 'Next image' });
  }

  /** Reads `"{i+1} / {n}"`. */
  get counter(): Locator {
    return this.page.getByTestId(tid.vdetail.lightboxCounter);
  }

  get image(): Locator {
    return this.dialog.getByRole('img');
  }

  async open(n = 1): Promise<void> {
    await this.thumbnail(n).click();
    await expect(this.dialog).toBeVisible();
  }

  async closeWithButton(): Promise<void> {
    await this.closeButton.click();
    await expect(this.dialog).toBeHidden();
  }

  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.dialog).toBeHidden();
  }

  /**
   * Click the backdrop.
   *
   * Deliberately targets a corner rather than the centre — the centre is occupied
   * by the image, whose own click handler does not close.
   */
  async closeWithBackdrop(): Promise<void> {
    await this.dialog.click({ position: { x: 5, y: 5 } });
    await expect(this.dialog).toBeHidden();
  }

  async nextWithKeyboard(): Promise<void> {
    await this.page.keyboard.press('ArrowRight');
  }

  async previousWithKeyboard(): Promise<void> {
    await this.page.keyboard.press('ArrowLeft');
  }

  /** @param index 1-indexed, matching the rendered counter. */
  async expectIndex(index: number, total: number): Promise<void> {
    await expect(this.counter).toHaveText(`${index} / ${total}`);
  }

  /** Body scroll is locked while the dialog is open, and restored on close. */
  async bodyOverflow(): Promise<string> {
    return this.page.evaluate(() => document.body.style.overflow);
  }

  async expectScrollLocked(): Promise<void> {
    expect(await this.bodyOverflow()).toBe('hidden');
  }

  async expectScrollRestored(): Promise<void> {
    expect(await this.bodyOverflow()).not.toBe('hidden');
  }

  async expectAccessibleName(vendorName: string): Promise<void> {
    await expect(this.dialog).toHaveAttribute('aria-label', `${vendorName} gallery`);
    await expect(this.dialog).toHaveAttribute('aria-modal', 'true');
  }
}
