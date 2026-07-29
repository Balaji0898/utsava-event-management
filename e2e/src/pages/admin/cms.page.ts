import { expect, type Locator } from '@playwright/test';
import { AdminPage } from '../admin.page';
import { tid } from '@config/testids';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';
import { RichTextEditorComponent } from '@components/rich-text-editor.component';
import { UploaderComponent } from '@components/uploader.component';

export type CmsTab = 'testimonials' | 'faqs' | 'stats' | 'contact' | 'legal';

/**
 * `/admin/cms` — five panels behind a tab bar. The densest admin surface, and the one
 * with the widest blast radius: everything edited here is rendered on public pages.
 *
 * Structural notes:
 *  - the tab buttons carry the **raw lowercase strings** `testimonials`, `faqs`,
 *    `stats`, `contact`, `legal` (CSS capitalises them), with no `role="tab"` and no
 *    `aria-selected` before the Phase 3 pass;
 *  - **tab state is component-local, so tabs are not deep-linkable.** `?tab=faqs` does
 *    nothing. That is recorded as an intentional skip;
 *  - all three `Saved ✓` indicators are removed by a `setTimeout` after exactly
 *    2000ms, so they must be asserted promptly;
 *  - the three singleton blocks (`site-contact`, `home-stats`, `legal-*`) are ONE ROW
 *    each — last writer wins — so every spec touching them must be `@serial` and must
 *    restore the original value. `DataFactory.snapshotAndRestore` exists for that.
 *
 * The `testimonials` panel is the approval half of the review-moderation journey:
 * public submissions land `approved: false` and appear under "Pending approval" with
 * `Approve` / `Reject` controls, while approved ones move to "Published".
 */
export class AdminCmsPage extends AdminPage {
  get path(): string {
    return paths.adminCms;
  }

  readonly editor = new RichTextEditorComponent(this.page);
  readonly avatarUploader = new UploaderComponent(this.page, 'testimonials');

  // --------------------------------------------------------------------- tabs

  get tabBar(): Locator {
    return this.testId(tid.cms.tabs);
  }

  tab(name: CmsTab): Locator {
    return this.testId(tid.cms.tab(name));
  }

  panel(name: CmsTab): Locator {
    return this.testId(tid.cms.panel(name));
  }

  async openTab(name: CmsTab): Promise<void> {
    await this.tab(name).click();
    await expect(this.panel(name)).toBeVisible({ timeout: 20_000 });
  }

  /** Post-Phase-3: the active tab must advertise itself. */
  async expectTabSelected(name: CmsTab): Promise<void> {
    await expect(this.tab(name)).toHaveAttribute('aria-selected', 'true');
  }

  // ------------------------------------------------------------- testimonials

  get testimonialName(): Locator {
    return this.testId(tid.cms.testimonial.name);
  }

  get testimonialRole(): Locator {
    return this.testId(tid.cms.testimonial.role);
  }

  get testimonialMessage(): Locator {
    return this.testId(tid.cms.testimonial.message);
  }

  get testimonialAdd(): Locator {
    return this.testId(tid.cms.testimonial.add);
  }

  get pendingGroup(): Locator {
    return this.testId(tid.cms.testimonial.pendingGroup);
  }

  get pendingCount(): Locator {
    return this.testId(tid.cms.testimonial.pendingCount);
  }

  get publishedGroup(): Locator {
    return this.testId(tid.cms.testimonial.publishedGroup);
  }

  testimonialRow(id: string): Locator {
    return this.testId(tid.cms.testimonial.row(id));
  }

  testimonialRowByName(name: string): Locator {
    return this.panel('testimonials').locator('[data-testid^="cms-testimonial-row-"]').filter({ hasText: name });
  }

  approveButton(id: string): Locator {
    return this.testId(tid.cms.testimonial.approve(id));
  }

  rejectButton(id: string): Locator {
    return this.testId(tid.cms.testimonial.reject(id));
  }

  deleteTestimonialButton(id: string): Locator {
    return this.testId(tid.cms.testimonial.delete(id));
  }

  /** ⚠️ The admin create form hard-codes `rating: 5`; there is no rating control. */
  async addTestimonial(values: { name: string; role?: string; message: string }): Promise<void> {
    await this.openTab('testimonials');
    await this.testimonialName.fill(values.name);
    if (values.role !== undefined) await this.testimonialRole.fill(values.role);
    await this.testimonialMessage.fill(values.message);
    await this.testimonialAdd.click();
    await expect(this.testimonialRowByName(values.name).first()).toBeVisible({ timeout: 30_000 });
  }

  async approveTestimonial(id: string): Promise<void> {
    await this.approveButton(id).click();
    await expect(this.publishedGroup.getByTestId(tid.cms.testimonial.row(id))).toBeVisible({ timeout: 30_000 });
  }

  /** `Reject` is a DELETE behind `confirm('Delete testimonial?')`, not a status flip. */
  async rejectTestimonial(id: string): Promise<void> {
    const handler = this.dialogs;
    handler.acceptOnce();
    await this.rejectButton(id).click();
    await expect(this.testimonialRow(id)).toHaveCount(0, { timeout: 30_000 });
  }

  async expectPending(id: string): Promise<void> {
    await expect(this.pendingGroup.getByTestId(tid.cms.testimonial.row(id))).toBeVisible();
  }

  async expectPublished(id: string): Promise<void> {
    await expect(this.publishedGroup.getByTestId(tid.cms.testimonial.row(id))).toBeVisible();
  }

  // ---------------------------------------------------------------------- faqs

  get faqQuestion(): Locator {
    return this.testId(tid.cms.faq.question);
  }

  get faqAnswer(): Locator {
    return this.testId(tid.cms.faq.answer);
  }

  get faqAdd(): Locator {
    return this.testId(tid.cms.faq.add);
  }

  faqRow(id: string): Locator {
    return this.testId(tid.cms.faq.row(id));
  }

  faqRowByQuestion(question: string): Locator {
    return this.panel('faqs').locator('[data-testid^="cms-faq-row-"]').filter({ hasText: question });
  }

  deleteFaqButton(id: string): Locator {
    return this.testId(tid.cms.faq.delete(id));
  }

  async addFaq(values: { question: string; answer: string }): Promise<void> {
    await this.openTab('faqs');
    await this.faqQuestion.fill(values.question);
    await this.faqAnswer.fill(values.answer);
    await this.faqAdd.click();
    await expect(this.faqRowByQuestion(values.question).first()).toBeVisible({ timeout: 30_000 });
  }

  async deleteFaq(id: string): Promise<void> {
    const handler = this.dialogs;
    handler.acceptOnce();
    await this.deleteFaqButton(id).click();
    await expect(this.faqRow(id)).toHaveCount(0, { timeout: 30_000 });
  }

  // --------------------------------------------------------------------- stats

  statLabel(i: number): Locator {
    return this.testId(tid.cms.stats.label(i));
  }

  statValue(i: number): Locator {
    return this.testId(tid.cms.stats.value(i));
  }

  statSuffix(i: number): Locator {
    return this.testId(tid.cms.stats.suffix(i));
  }

  removeStat(i: number): Locator {
    return this.testId(tid.cms.stats.remove(i));
  }

  get addStatButton(): Locator {
    return this.testId(tid.cms.stats.add);
  }

  get saveStatsButton(): Locator {
    return this.testId(tid.cms.stats.save);
  }

  async statRowCount(): Promise<number> {
    return this.page.locator('[data-testid^="cms-stats-row-"]').count();
  }

  /** `Add stat` appends `{ label: '', value: 0, suffix: '+' }`. */
  async addStat(values: { label: string; value: string; suffix?: string }): Promise<void> {
    await this.openTab('stats');
    const index = await this.statRowCount();
    await this.addStatButton.click();
    await this.statLabel(index).fill(values.label);
    await this.statValue(index).fill(values.value);
    if (values.suffix !== undefined) await this.statSuffix(index).fill(values.suffix);
  }

  async saveStats(): Promise<void> {
    await this.saveStatsButton.click();
    await this.expectSavedIndicator();
  }

  // ------------------------------------------------------------------- contact

  get contactManager(): Locator {
    return this.testId(tid.cms.contact.manager);
  }

  get contactRole(): Locator {
    return this.testId(tid.cms.contact.role);
  }

  /** Digits only — this is what the `tel:` link uses. */
  get contactPhone(): Locator {
    return this.testId(tid.cms.contact.phone);
  }

  /**
   * The human-readable phone. Bug B9: this key is absent from the stored block, so the
   * public site shows a hard-coded default that silently diverges from `phone`.
   */
  get contactPhoneDisplay(): Locator {
    return this.testId(tid.cms.contact.phoneDisplay);
  }

  get contactWhatsapp(): Locator {
    return this.testId(tid.cms.contact.whatsapp);
  }

  get contactEmail(): Locator {
    return this.testId(tid.cms.contact.email);
  }

  get saveContactButton(): Locator {
    return this.testId(tid.cms.contact.save);
  }

  /** These values propagate to the footer, contact section and WhatsApp FAB site-wide. */
  async saveContact(values: {
    manager?: string;
    role?: string;
    phone?: string;
    phoneDisplay?: string;
    whatsapp?: string;
    email?: string;
  }): Promise<void> {
    await this.openTab('contact');
    if (values.manager !== undefined) await this.contactManager.fill(values.manager);
    if (values.role !== undefined) await this.contactRole.fill(values.role);
    if (values.phone !== undefined) await this.contactPhone.fill(values.phone);
    if (values.phoneDisplay !== undefined) await this.contactPhoneDisplay.fill(values.phoneDisplay);
    if (values.whatsapp !== undefined) await this.contactWhatsapp.fill(values.whatsapp);
    if (values.email !== undefined) await this.contactEmail.fill(values.email);
    await this.saveContactButton.click();
    await this.expectSavedIndicator();
  }

  async readContact(): Promise<{
    manager: string;
    role: string;
    phone: string;
    phoneDisplay: string;
    whatsapp: string;
    email: string;
  }> {
    await this.openTab('contact');
    return {
      manager: await this.contactManager.inputValue(),
      role: await this.contactRole.inputValue(),
      phone: await this.contactPhone.inputValue(),
      phoneDisplay: await this.contactPhoneDisplay.inputValue(),
      whatsapp: await this.contactWhatsapp.inputValue(),
      email: await this.contactEmail.inputValue(),
    };
  }

  // --------------------------------------------------------------------- legal

  get legalTermsToggle(): Locator {
    return this.testId(tid.cms.legal.toggleTerms);
  }

  get legalPrivacyToggle(): Locator {
    return this.testId(tid.cms.legal.togglePrivacy);
  }

  get saveLegalButton(): Locator {
    return this.testId(tid.cms.legal.save);
  }

  async openLegal(slug: 'terms' | 'privacy'): Promise<void> {
    await this.openTab('legal');
    await (slug === 'terms' ? this.legalTermsToggle : this.legalPrivacyToggle).click();
    await this.editor.waitForReady();
  }

  /**
   * Author legal content and save it.
   *
   * Whatever is written here is rendered on the public `/terms` or `/privacy` page via
   * `dangerouslySetInnerHTML`, filtered only by the custom regex sanitizer — so this
   * is the write half of the stored-XSS specs.
   */
  async saveLegal(slug: 'terms' | 'privacy', content: string): Promise<void> {
    await this.openLegal(slug);
    await this.editor.setContent(content);
    await this.saveLegalButton.click();
    await this.expectSavedIndicator();
  }

  // --------------------------------------------------------------- assertions

  async expectLoaded(): Promise<void> {
    await expect(this.tabBar).toBeVisible();
    for (const name of messages.admin.cms.tabs) {
      await expect(this.tab(name)).toBeVisible();
    }
  }

  /** Tab state is component-local, so a `?tab=` param must have no effect. */
  async expectTabsNotDeepLinkable(): Promise<void> {
    await this.openRaw(`${paths.adminCms}?tab=faqs`);
    await this.waitForGate();
    await expect(this.panel('testimonials')).toBeVisible();
  }
}
