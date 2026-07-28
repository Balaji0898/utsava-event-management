import { expect, type Locator } from '@playwright/test';
import { SitePage } from '../site.page';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';
import { LocationInputComponent } from '@components/location-input.component';
import { TestimonialFormComponent } from '@components/testimonial-form.component';

/**
 * `/` — the home page. Nine sections, each an independent `<Suspense>` island, so
 * they stream in and settle at different times.
 *
 * Section order and identity:
 *   1 Hero (badge, h1, CTAs, and the search form)
 *   2 Best Events   — BestEventsSlider
 *   3 Stats         — four AnimatedCounters from /cms/stats
 *   4 Services      — id="services"
 *   5 Function Halls— id="function-halls", rendered only when a department with
 *                     slug 'function-halls' exists
 *   6 Testimonials  — Carousel + the public review form
 *   7 FAQ           — id="faq", accordion
 *   8 Contact       — id="contact"
 *   9 CTA
 *
 * The hero search form is a plain **GET `<form action="/vendors">`** with fields
 * `city`, `date` and `search`. Two quirks:
 *  - `date` is submitted but `/vendors` **never reads it** — a genuine dead end, and
 *    the input starts as `type="text"` with a "Select date" placeholder and flips to
 *    `type="date"` on focus, back on empty blur;
 *  - the geolocate button BYPASSES the form entirely, doing
 *    `router.push('/vendors?lat=..&lng=..')`.
 *
 * `BestEventsSlider` autoplays every 5000ms with 0.7s crossfades, so the slide text
 * changes underneath an assertion. It pauses on hover/focus and is fully disabled
 * under `prefers-reduced-motion` — which the config sets globally, so the slider is
 * static in this suite. `hoverSlider()` remains available for a spec that wants to
 * exercise the pause behaviour itself.
 */
export class HomePage extends SitePage {
  get path(): string {
    return paths.home;
  }

  readonly heroCity = new LocationInputComponent(this.page, this.page.locator('input[name="city"]'));
  readonly reviewForm = new TestimonialFormComponent(this.page);

  // ------------------------------------------------------------------- 1. hero

  get heroHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  get heroBadge(): Locator {
    return this.page.getByText(messages.home.heroBadge);
  }

  get bookNowCta(): Locator {
    return this.page.getByRole('link', { name: messages.home.ctaPrimary }).first();
  }

  get exploreCta(): Locator {
    return this.page.getByRole('link', { name: messages.home.ctaSecondary });
  }

  /** The GET form. `action="/vendors"`, so submitting is a real navigation. */
  get searchForm(): Locator {
    return this.page.locator('form[action="/vendors"]');
  }

  get searchCityInput(): Locator {
    return this.page.locator('input[name="city"]');
  }

  /** Starts `type="text"` with a placeholder, flips to `type="date"` on focus. */
  get searchDateInput(): Locator {
    return this.page.locator('input[name="date"]');
  }

  get searchEventInput(): Locator {
    return this.page.locator('input[name="search"]');
  }

  get searchSubmit(): Locator {
    return this.page.getByRole('button', { name: 'Search' });
  }

  /** Submit the hero search — a full navigation to `/vendors` with query params. */
  async search(values: { city?: string; date?: string; event?: string }): Promise<void> {
    if (values.city !== undefined) await this.searchCityInput.fill(values.city);
    if (values.date !== undefined) {
      await this.searchDateInput.focus(); // flips type to "date" before filling
      await this.searchDateInput.fill(values.date);
    }
    if (values.event !== undefined) await this.searchEventInput.fill(values.event);
    await this.searchSubmit.click();
    await expect(this.page).toHaveURL(/\/vendors\?/);
  }

  /** The date input's progressive-enhancement dance, asserted rather than assumed. */
  async dateInputType(): Promise<string | null> {
    return this.searchDateInput.getAttribute('type');
  }

  // ------------------------------------------------------------ 2. best events

  get bestEventsSection(): Locator {
    return this.page.getByRole('region', { name: /best events/i }).or(
      this.page.locator('section').filter({ has: this.page.getByRole('heading', { name: messages.home.bestEventsTitle }) }),
    );
  }

  get bestEventsViewAll(): Locator {
    return this.bestEventsSection.getByRole('link', { name: new RegExp(messages.home.viewAll, 'i') });
  }

  get sliderNext(): Locator {
    return this.bestEventsSection.getByRole('button', { name: 'Next' });
  }

  get sliderPrev(): Locator {
    return this.bestEventsSection.getByRole('button', { name: 'Previous' });
  }

  /** Autoplay pauses on hover — the only way to read slide text under real motion. */
  async hoverSlider(): Promise<void> {
    await this.bestEventsSection.hover();
  }

  // ---------------------------------------------------------------- 3. stats

  /** Four AnimatedCounter cards from `/cms/stats`, with hard-coded fallbacks. */
  statCard(label: string): Locator {
    return this.page.locator('section').filter({ hasText: label }).getByText(label).first();
  }

  // -------------------------------------------------------------- 4. services

  get servicesSection(): Locator {
    return this.page.locator('#services');
  }

  /** Department cards link to `/vendors?departmentId={id}`. */
  serviceCard(departmentName: string): Locator {
    return this.servicesSection.getByRole('link').filter({ hasText: departmentName });
  }

  async openService(departmentName: string): Promise<void> {
    await this.serviceCard(departmentName).first().click();
    await expect(this.page).toHaveURL(/\/vendors\?departmentId=/);
  }

  // -------------------------------------------------------- 5. function halls

  /** Present only when a department with slug 'function-halls' exists. */
  get functionHallsSection(): Locator {
    return this.page.locator('#function-halls');
  }

  get functionHallsViewAll(): Locator {
    return this.functionHallsSection.getByRole('link', { name: messages.home.functionHallsViewAll });
  }

  /**
   * Capacity is parsed out of the vendor DESCRIPTION with `/Capacity:\s*(\d+)/i`.
   * So a description-format change silently breaks this panel — hence an explicit
   * assertion rather than trusting it.
   */
  hallCard(name: string): Locator {
    return this.functionHallsSection.getByRole('link').filter({ hasText: name });
  }

  // --------------------------------------------------------- 6. testimonials

  get testimonialsSection(): Locator {
    return this.page.locator('section').filter({
      has: this.page.getByRole('heading', { name: messages.home.testimonialsTitle }),
    });
  }

  get testimonialsSeeAll(): Locator {
    return this.testimonialsSection.getByRole('link', { name: messages.home.testimonialsSeeAll });
  }

  /** Slide count is recomputed from `matchMedia('(max-width: 640px)')` after mount. */
  get carousel(): Locator {
    return this.page.getByRole('region').filter({ has: this.testimonialsSection });
  }

  // ------------------------------------------------------------------- 7. faq

  get faqSection(): Locator {
    return this.page.locator('#faq');
  }

  faqQuestion(text: string | RegExp): Locator {
    return this.faqSection.getByRole('button', { name: text });
  }

  /** One panel open at a time — opening a second closes the first. */
  async openFaq(text: string | RegExp): Promise<void> {
    await this.faqQuestion(text).click();
  }

  // --------------------------------------------------------------- 8. contact

  get contactSection(): Locator {
    return this.page.locator('#contact');
  }

  get callLink(): Locator {
    return this.contactSection.getByRole('link', { name: new RegExp(messages.home.contactCall, 'i') });
  }

  /** Opens a new tab to wa.me. */
  get whatsappLink(): Locator {
    return this.contactSection.getByRole('link', { name: messages.home.contactWhatsapp });
  }

  get emailLink(): Locator {
    return this.contactSection.getByRole('link', { name: messages.home.contactEmail });
  }

  // ------------------------------------------------------------------- 9. cta

  get finalCta(): Locator {
    return this.page.getByRole('link', { name: messages.home.ctaButton });
  }

  // ----------------------------------------------------------------- assertions

  async expectLoaded(): Promise<void> {
    await expect(this.heroHeading).toBeVisible({ timeout: 30_000 });
    await expect(this.bookNowCta).toBeVisible();
  }

  /** Every section is an independent Suspense island, so check each explicitly. */
  async expectAllSectionsPresent(): Promise<void> {
    await expect(this.heroHeading).toBeVisible();
    await this.expectHeading(messages.home.bestEventsTitle, 2);
    await this.expectHeading(messages.home.servicesTitle, 2);
    await this.expectHeading(messages.home.testimonialsTitle, 2);
    await expect(this.faqSection).toBeVisible();
    await expect(this.contactSection).toBeVisible();
    await this.expectHeading(messages.home.ctaTitle, 2);
  }

  /** The launch overlay must never be in the way — the init script kills it. */
  async expectNoLaunchOverlay(): Promise<void> {
    await expect(this.page.locator('#launch-overlay')).toHaveCount(0);
  }
}
