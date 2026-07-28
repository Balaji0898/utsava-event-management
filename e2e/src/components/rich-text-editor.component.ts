import { expect, type Locator, type Page } from '@playwright/test';
import { tid } from '@config/testids';
import { Dialogs } from '@fixtures/dialogs';

/**
 * The tiptap editor on the CMS "legal" tab
 * (`features/admin/components/rich-text-editor.tsx`).
 *
 * This is the highest-risk input surface in the application, and the reason is
 * worth stating plainly: whatever is typed here is saved to `legal-terms` /
 * `legal-privacy`, then rendered on the PUBLIC `/terms` and `/privacy` pages via
 * `dangerouslySetInnerHTML`, filtered only by `shared/lib/sanitize.ts` — a custom
 * regex allowlist that SECURITY_AUDIT.md H-1 identifies as bypassable. An admin
 * account is required to write, which is why H-1 is High rather than Critical, but
 * the stored-XSS payload lands on unauthenticated visitors.
 *
 * Mechanics:
 *  - dynamically imported with `ssr: false` behind a pulsing skeleton, so the
 *    editor does not exist on first paint — always `waitForReady()`;
 *  - the body is a `contenteditable` div with class `prose prose-sm … min-h-[280px]`;
 *  - toolbar buttons are properly aria-labelled: Heading 2, Heading 3, Bold, Italic,
 *    Bullet list, Numbered list, Link, Undo, Redo;
 *  - **the Link button opens a native `window.prompt('Link URL', 'https://')`**, so
 *    it needs a dialog handler registered before the click or the click never
 *    resolves;
 *  - `Save` writes via `PUT /cms/legal/{slug}` and shows `Saved ✓` for exactly 2s.
 */
export class RichTextEditorComponent {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId(tid.cms.legal.editor);
  }

  /** The `contenteditable` surface. */
  get body(): Locator {
    return this.page.getByTestId(tid.cms.legal.editorBody);
  }

  toolbarButton(
    name: 'Heading 2' | 'Heading 3' | 'Bold' | 'Italic' | 'Bullet list' | 'Numbered list' | 'Link' | 'Undo' | 'Redo',
  ): Locator {
    return this.root.getByRole('button', { name });
  }

  /** Dynamically imported behind a skeleton — never assume it is mounted. */
  async waitForReady(): Promise<void> {
    await expect(this.body).toBeVisible({ timeout: 30_000 });
    await expect(this.toolbarButton('Bold')).toBeVisible();
  }

  async clear(): Promise<void> {
    await this.body.click();
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.press('Delete');
  }

  async type(text: string): Promise<void> {
    await this.body.click();
    await this.page.keyboard.type(text);
  }

  async setContent(text: string): Promise<void> {
    await this.clear();
    await this.type(text);
  }

  /**
   * Insert a link.
   *
   * The prompt handler MUST be installed before the click: a native prompt blocks
   * the page, so `click()` would never resolve otherwise. `javascript:` URLs are
   * worth passing here deliberately — the sanitizer is supposed to strip them on
   * the public render.
   */
  async insertLink(url: string, dialogs?: Dialogs): Promise<void> {
    const handler = dialogs ?? new Dialogs(this.page);
    handler.acceptOnce(url);
    await this.toolbarButton('Link').click();
  }

  async toggleBold(): Promise<void> {
    await this.toolbarButton('Bold').click();
  }

  async toggleHeading2(): Promise<void> {
    await this.toolbarButton('Heading 2').click();
  }

  async toggleBulletList(): Promise<void> {
    await this.toolbarButton('Bullet list').click();
  }

  async undo(): Promise<void> {
    await this.toolbarButton('Undo').click();
  }

  async redo(): Promise<void> {
    await this.toolbarButton('Redo').click();
  }

  /** The rendered HTML, for asserting what the editor produced before saving. */
  async innerHtml(): Promise<string> {
    return this.body.innerHTML();
  }

  async text(): Promise<string> {
    return (await this.body.textContent()) ?? '';
  }

  /**
   * Type a raw HTML string as literal text.
   *
   * tiptap escapes typed text, so this is what a real attacker's keystrokes
   * produce. The interesting question is what survives to the public page, not what
   * the editor stores — so the assertion belongs on `/privacy`, not here.
   */
  async typeRawHtml(html: string): Promise<void> {
    await this.setContent(html);
  }
}
