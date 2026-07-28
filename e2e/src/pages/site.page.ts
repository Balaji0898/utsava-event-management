import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { NavbarComponent } from '@components/navbar.component';
import { FooterComponent } from '@components/footer.component';
import { tid } from '@config/testids';

/**
 * Any page in the `(site)` route group.
 *
 * That layout provides the Navbar, the Footer, the WhatsApp FAB, `SiteContactProvider`
 * (which fetches `/cms/contact` with a 2.5s budget and zero retries — so the footer
 * can legitimately render fallback contact details on a slow API), and Lenis smooth
 * scroll.
 *
 * The `(auth)` group has NO layout, so `/login` deliberately does not extend this.
 */
export abstract class SitePage extends BasePage {
  readonly navbar = new NavbarComponent(this.page);
  readonly footer = new FooterComponent(this.page);

  /**
   * Fixed at `bottom-6 right-6 z-50`, 56x56 plus an `animate-ping` halo, entering
   * on a spring with a 1s delay. A plausible click-interceptor for anything in the
   * bottom-right corner on small viewports, which is why the responsive specs
   * assert around it explicitly.
   */
  get whatsappFab(): Locator {
    return this.testId(tid.whatsappFab);
  }

  /**
   * Scroll to an in-page anchor and let Lenis settle.
   *
   * `shared/motion/smooth-scroll.tsx` installs a DOCUMENT-LEVEL click listener that
   * intercepts every `<a href>` containing '#', prevents the default, and calls
   * `lenis.scrollTo(el, { offset: -88 })` — retrying up to 25 times at 150ms
   * intervals for sections that have not streamed in yet. That fights Playwright's
   * own scroll-into-view, so an assertion issued immediately after the click races
   * an animation that may still be retrying.
   *
   * Hence: click, wait for the hash, then poll the element's box until it stops
   * moving. Polling the geometry is more honest than a fixed sleep — it succeeds as
   * soon as Lenis is done and fails loudly if Lenis never settles.
   */
  async scrollToAnchor(anchorId: string): Promise<void> {
    const target = this.page.locator(`#${anchorId}`);
    await target.waitFor({ state: 'attached', timeout: 15_000 });

    let previous = -1;
    for (let i = 0; i < 40; i += 1) {
      const box = await target.boundingBox();
      const y = box ? Math.round(box.y) : -1;
      if (y === previous) return;
      previous = y;
      await this.page.waitForTimeout(100);
    }
    throw new Error(`#${anchorId} never stopped moving — Lenis did not settle within 4s.`);
  }

  /**
   * Click an in-page nav link and wait for the scroll to settle.
   * Separate from `scrollToAnchor` because the click path goes through Lenis's
   * interceptor, whereas a direct URL load goes through its `hashchange` handler.
   */
  async followAnchorLink(name: string | RegExp, anchorId: string): Promise<void> {
    await this.link(name).first().click();
    await expect(this.page).toHaveURL(new RegExp(`#${anchorId}$`));
    await this.scrollToAnchor(anchorId);
  }

  /**
   * A card link inside any list.
   *
   * Every vendor / package / service / hall card is wrapped in `TiltCard`, which
   * applies a spring `rotateX/rotateY` on mousemove plus
   * `whileHover={{ scale: 1.02, y: -6, z: 30 }}`. So under normal motion the click
   * target physically moves away from the cursor between `hover()` and `click()`.
   * `reducedMotion: 'reduce'` (set globally) makes `useReducedMotion()` short-circuit
   * all of that, which is why a plain `.click()` is safe here — but only there.
   */
  protected cardLink(container: Locator, name: string | RegExp): Locator {
    return container.getByRole('link', { name });
  }
}
