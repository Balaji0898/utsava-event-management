import type { Dialog, Page } from '@playwright/test';

/**
 * Native `confirm()` / `prompt()` handling.
 *
 * The admin UI guards five destructive actions with a browser `confirm()` and the
 * tiptap link button with a `window.prompt()`. Playwright auto-DISMISSES dialogs
 * when no handler is registered, so without this every delete test silently
 * passes while deleting nothing — the worst possible failure mode.
 *
 * Verified call sites:
 *   confirm('Delete this department?')                    admin/departments/page.tsx
 *   confirm('Delete this vendor and all its packages?')   admin/vendors/page.tsx
 *   confirm('Delete package?')                            packages-manager.tsx
 *   confirm('Delete testimonial?')                        admin/cms/page.tsx  (Reject + published trash)
 *   confirm('Delete FAQ?')                                admin/cms/page.tsx
 *   prompt('Link URL', 'https://')                        rich-text-editor.tsx
 */
export class Dialogs {
  private readonly seen: string[] = [];
  private handler: ((dialog: Dialog) => void) | null = null;

  constructor(private readonly page: Page) {}

  /** Every dialog message observed so far, in order. */
  get messages(): readonly string[] {
    return this.seen;
  }

  get lastMessage(): string | undefined {
    return this.seen[this.seen.length - 1];
  }

  private install(respond: (dialog: Dialog) => Promise<void>): void {
    this.dispose();
    this.handler = (dialog: Dialog) => {
      this.seen.push(dialog.message());
      void respond(dialog);
    };
    this.page.on('dialog', this.handler);
  }

  /**
   * Accept every dialog for the rest of the test, optionally supplying prompt text.
   *
   * Register this BEFORE the click that triggers the dialog — the dialog blocks
   * the page until it is answered, so `click()` will not resolve otherwise.
   */
  acceptAll(promptText?: string): this {
    this.install(async (dialog) => {
      await dialog.accept(promptText);
    });
    return this;
  }

  /** Dismiss every dialog — for "cancelling a delete leaves the row intact" cases. */
  dismissAll(): this {
    this.install(async (dialog) => {
      await dialog.dismiss();
    });
    return this;
  }

  /**
   * Accept exactly once, then stop handling.
   *
   * Preferred over `acceptAll()` in destructive specs: a stray second confirm
   * (e.g. a double-bound click handler) should surface as a hung test rather than
   * be silently accepted and delete a second record.
   */
  acceptOnce(promptText?: string): this {
    this.install(async (dialog) => {
      this.dispose();
      await dialog.accept(promptText);
    });
    return this;
  }

  /**
   * Wait for the next dialog, assert its message, and accept it.
   * Returns the message so the caller can assert on it further.
   */
  async expectAndAccept(expected: string | RegExp, promptText?: string): Promise<string> {
    const dialog = await this.page.waitForEvent('dialog');
    const message = dialog.message();
    this.seen.push(message);
    const ok = typeof expected === 'string' ? message === expected : expected.test(message);
    if (!ok) {
      await dialog.dismiss();
      throw new Error(`Expected dialog message to match ${expected}, got "${message}"`);
    }
    await dialog.accept(promptText);
    return message;
  }

  dispose(): void {
    if (this.handler) {
      this.page.off('dialog', this.handler);
      this.handler = null;
    }
  }
}

/**
 * Fail the test the moment a JavaScript `alert()` fires.
 *
 * The app never calls `alert()`, so one appearing means a payload executed — this
 * is the tripwire the XSS sweep relies on, alongside the `window.__*Probe`
 * checks. Belt and braces: a payload might alert without touching the probe.
 */
export function failOnAlert(page: Page, onDetected: (message: string) => void): void {
  page.on('dialog', (dialog) => {
    /**
     * ONLY alerts. The dismiss used to sit outside this check, so this handler
     * answered every dialog on the page — including the `confirm()` behind all five
     * destructive admin actions. Whichever listener won the race decided the
     * outcome, and a dismissed confirm makes the admin UI return early without
     * deleting: a silent no-op. Leave every other type to the `Dialogs` handler
     * that the page object owns.
     */
    if (dialog.type() !== 'alert') return;
    onDetected(dialog.message());
    void dialog.dismiss();
  });
}
