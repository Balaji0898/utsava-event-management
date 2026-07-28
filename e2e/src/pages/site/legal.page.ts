import { expect, type Locator } from '@playwright/test';
import { SitePage } from '../site.page';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';

/**
 * `/privacy` and `/terms` — both thin wrappers around `LegalPage`
 * (`features/website/components/legal-page.tsx`).
 *
 * **This is the most security-relevant page in the app.** It fetches
 * `/cms/legal/{slug}`, runs the stored HTML through `shared/lib/sanitize.ts` — a
 * custom regex allowlist that SECURITY_AUDIT.md H-1 identifies as bypassable — and
 * renders the result with `dangerouslySetInnerHTML` inside a `.prose` container. So
 * whatever survives that regex executes in every visitor's browser, and with tokens
 * in localStorage (M-3) and no CSP in non-prod (M-2) that is an exfiltration path.
 *
 * The XSS specs therefore author content through the admin tiptap editor and then
 * assert here on what actually rendered.
 *
 * ⚠️ **The seed does NOT create `legal-terms` or `legal-privacy`.** On a freshly
 * seeded database both pages render their fallback copy. Any spec that needs real
 * prose must author it first — do not "fix" this by asserting content that is not
 * there.
 */
export class LegalPage extends SitePage {
  constructor(
    page: import('@playwright/test').Page,
    private readonly slug: 'privacy' | 'terms' = 'privacy',
  ) {
    super(page);
  }

  get path(): string {
    return this.slug === 'privacy' ? paths.privacy : paths.terms;
  }

  /** The `dangerouslySetInnerHTML` container. */
  get content(): Locator {
    return this.page.locator('.prose').first();
  }

  get fallbackMessage(): Locator {
    return this.page.getByText(
      this.slug === 'privacy' ? messages.legal.privacyFallback : messages.legal.termsFallback,
    );
  }

  async expectLoaded(): Promise<void> {
    await expect(this.content.or(this.fallbackMessage)).toBeVisible({ timeout: 30_000 });
  }

  /** What a freshly seeded database shows, because no legal block exists. */
  async expectFallbackCopy(): Promise<void> {
    await expect(this.fallbackMessage).toBeVisible();
  }

  async expectContains(text: string | RegExp): Promise<void> {
    await expect(this.content).toContainText(text);
  }

  /** The rendered HTML, for asserting exactly what the sanitizer let through. */
  async renderedHtml(): Promise<string> {
    return this.content.innerHTML();
  }

  /**
   * The core H-1 assertion.
   *
   * Checks three independent things, because any one alone is insufficient:
   *   - the XSS probe is untouched (nothing executed);
   *   - no event-handler attribute survived into the DOM;
   *   - no `<script>` element exists in the container.
   *
   * A payload can defeat the probe check alone by, say, injecting a `<script src>`
   * that fails to load — still a vulnerability.
   */
  async expectNoScriptExecuted(probeName: string): Promise<void> {
    expect(await this.readXssProbe(probeName), 'an XSS payload executed on the legal page').toBe('safe');

    const html = await this.renderedHtml();
    expect(html, 'an inline event handler survived sanitisation').not.toMatch(
      /\son(error|load|click|toggle|focus|mouseover)\s*=/i,
    );
    expect(html, 'a javascript: URL survived sanitisation').not.toMatch(/javascript:/i);
    await expect(this.content.locator('script')).toHaveCount(0);
    await expect(this.content.locator('iframe')).toHaveCount(0);
  }
}
