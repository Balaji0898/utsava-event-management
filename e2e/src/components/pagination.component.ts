import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Two DIFFERENT paginations exist in this app, and they behave differently enough
 * that conflating them produces flaky specs.
 *
 *  - **Public `/vendors`** (`app/(site)/vendors/page.tsx`): server-rendered `<Link>`s,
 *    labelled `← Prev` and `Next →`, and it renders **EVERY** page number from 1 to
 *    `pages` with no windowing — 40 pages means 40 links. `PAGE_SIZE` is 12.
 *  - **Admin `/admin/vendors`** (`shared/ui/pagination.tsx`): client-side, windowed
 *    to ±2 around the current page, with `aria-label="Previous page"` /
 *    `"Next page"` and disabled at the bounds. `PAGE_SIZE` is 10.
 *
 * Both mark the current page with `aria-current="page"`.
 */
export class PaginationComponent {
  /**
   * @param root the pagination container
   * @param variant 'public' uses `← Prev` / `Next →` text; 'admin' uses aria-labels
   */
  constructor(
    private readonly page: Page,
    private readonly root: Locator,
    private readonly variant: 'public' | 'admin',
  ) {}

  get container(): Locator {
    return this.root;
  }

  get prev(): Locator {
    return this.variant === 'admin'
      ? this.root.getByRole('button', { name: 'Previous page' })
      : this.root.getByRole('link', { name: /Prev/ });
  }

  get next(): Locator {
    return this.variant === 'admin'
      ? this.root.getByRole('button', { name: 'Next page' })
      : this.root.getByRole('link', { name: /Next/ });
  }

  pageLink(n: number): Locator {
    const role = this.variant === 'admin' ? 'button' : 'link';
    return this.root.getByRole(role, { name: String(n), exact: true });
  }

  get current(): Locator {
    return this.root.locator('[aria-current="page"]');
  }

  /** Total page controls rendered. Public renders all of them; admin windows to ±2. */
  async pageLinkCount(): Promise<number> {
    const role = this.variant === 'admin' ? 'button' : 'link';
    return this.root.getByRole(role).filter({ hasText: /^\d+$/ }).count();
  }

  async goToPage(n: number): Promise<void> {
    await this.pageLink(n).click();
    await expect(this.current).toHaveText(String(n));
  }

  async goNext(): Promise<void> {
    await this.next.click();
  }

  async goPrev(): Promise<void> {
    await this.prev.click();
  }

  async expectCurrentPage(n: number): Promise<void> {
    await expect(this.current).toHaveText(String(n));
  }

  /** The public variant renders no pagination at all when `pages <= 1`. */
  async expectHidden(): Promise<void> {
    await expect(this.root).toBeHidden();
  }

  /** Admin disables rather than hides at the bounds. */
  async expectPrevDisabled(): Promise<void> {
    await expect(this.prev).toBeDisabled();
  }

  async expectNextDisabled(): Promise<void> {
    await expect(this.next).toBeDisabled();
  }

  /** Read the `page` query param — the public variant drives it via the URL. */
  currentPageFromUrl(): number {
    const value = new URL(this.page.url()).searchParams.get('page');
    return value ? Number(value) : 1;
  }
}
