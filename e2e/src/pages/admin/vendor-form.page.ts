import { expect, type Locator } from '@playwright/test';
import { AdminPage } from '../admin.page';
import { tid } from '@config/testids';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';
import { LocationInputComponent } from '@components/location-input.component';
import { UploaderComponent, GalleryUploaderComponent } from '@components/uploader.component';
import { PackagesManagerComponent } from '@components/packages-manager.component';

export type VendorFormValues = {
  name?: string;
  /** The visible option label, e.g. "Photography" — not the id. */
  department?: string;
  experience?: string;
  location?: string;
  cities?: string;
  description?: string;
  contactNumber?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  priceFrom?: string;
  priceTo?: string;
  discount?: string;
  available?: boolean;
  featured?: boolean;
  trending?: boolean;
  verified?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
};

/**
 * `VendorForm` — serves both `/admin/vendors/new` and `/admin/vendors/[id]`.
 *
 * The most locator-hostile form in the app before the Phase 3 pass:
 *  - manual `useState`, **no zod**, so validation is whatever the native `required`
 *    attributes enforce (name and department only) — every other field, including
 *    all six contact fields, accepts anything;
 *  - labels are siblings with no `htmlFor`;
 *  - **four inputs share `placeholder="0"`** (experience, priceFrom, priceTo,
 *    discountPercent), making placeholder locators genuinely ambiguous.
 *  Phase 3 fixes all three via the shared `Field` component, which is why one edit
 *  there covers twelve inputs.
 *
 * Two behaviours that catch people out:
 *
 *  - **Create redirects to the EDIT page, not the list.** `POST` then
 *    `router.push('/admin/vendors/{createdId}')`. So a create spec must assert it
 *    landed on `/admin/vendors/<id>` and can immediately manage packages there.
 *    Edit, by contrast, goes back to the list and calls `router.refresh()`.
 *
 *  - **`featured: true` demotes a sibling.** The service runs
 *    `demoteOtherFeatured(vendorId, departmentId)`, silently un-featuring another
 *    vendor in the same department — which changes the home page's Best Events
 *    slider for every other test in the run. Any spec setting `featured` must own its
 *    department; `DataFactory.createVendor` defaults to creating one for exactly this
 *    reason.
 *
 * Bug B10: a stored `0` renders as an EMPTY input, so an operator cannot tell "zero"
 * from "unset" — asserted by `expectZeroRendersEmpty()`.
 */
export class AdminVendorFormPage extends AdminPage {
  private vendorId: string | null = null;

  constructor(page: import('@playwright/test').Page, vendorId?: string) {
    super(page);
    this.vendorId = vendorId ?? null;
  }

  get path(): string {
    return this.vendorId ? paths.adminVendorEdit(this.vendorId) : paths.adminVendorNew;
  }

  readonly locationInput = new LocationInputComponent(this.page, this.page.getByTestId(tid.vend.location));
  readonly logoUploader = new UploaderComponent(this.page, 'vendors');
  readonly galleryUploader = new GalleryUploaderComponent(this.page);
  readonly packages = new PackagesManagerComponent(this.page);

  async openNew(): Promise<void> {
    this.vendorId = null;
    await this.openRaw(paths.adminVendorNew);
    await this.waitForGate();
    await expect(this.form).toBeVisible({ timeout: 30_000 });
  }

  async openEdit(vendorId: string): Promise<void> {
    this.vendorId = vendorId;
    await this.openRaw(paths.adminVendorEdit(vendorId));
    await this.waitForGate();
    await expect(this.form).toBeVisible({ timeout: 30_000 });
  }

  // ------------------------------------------------------------------- fields

  get form(): Locator {
    return this.testId(tid.vend.form);
  }

  get nameInput(): Locator {
    return this.testId(tid.vend.name);
  }

  /** `<select required>` whose first option is the placeholder "Select…". */
  get departmentSelect(): Locator {
    return this.testId(tid.vend.department);
  }

  get experienceInput(): Locator {
    return this.testId(tid.vend.experience);
  }

  get citiesInput(): Locator {
    return this.testId(tid.vend.cities);
  }

  get descriptionInput(): Locator {
    return this.testId(tid.vend.description);
  }

  get contactNumberInput(): Locator {
    return this.testId(tid.vend.contactNumber);
  }

  get whatsappInput(): Locator {
    return this.testId(tid.vend.whatsapp);
  }

  get emailInput(): Locator {
    return this.testId(tid.vend.email);
  }

  get websiteInput(): Locator {
    return this.testId(tid.vend.website);
  }

  get instagramInput(): Locator {
    return this.testId(tid.vend.instagram);
  }

  get facebookInput(): Locator {
    return this.testId(tid.vend.facebook);
  }

  get priceFromInput(): Locator {
    return this.testId(tid.vend.priceFrom);
  }

  get priceToInput(): Locator {
    return this.testId(tid.vend.priceTo);
  }

  get discountInput(): Locator {
    return this.testId(tid.vend.discount);
  }

  get availableCheckbox(): Locator {
    return this.testId(tid.vend.available);
  }

  /** Labelled "Best Event (home slider — one per category)". Triggers demotion. */
  get featuredCheckbox(): Locator {
    return this.testId(tid.vend.featured);
  }

  get trendingCheckbox(): Locator {
    return this.testId(tid.vend.trending);
  }

  get verifiedCheckbox(): Locator {
    return this.testId(tid.vend.verified);
  }

  get statusSelect(): Locator {
    return this.testId(tid.vend.status);
  }

  get submitButton(): Locator {
    return this.testId(tid.vend.submit);
  }

  get errorMessage(): Locator {
    return this.testId(tid.vend.error);
  }

  get backToVendorsButton(): Locator {
    return this.button(messages.admin.vendors.backToVendors);
  }

  // ------------------------------------------------------------------ actions

  async fill(values: VendorFormValues): Promise<void> {
    if (values.name !== undefined) await this.nameInput.fill(values.name);
    if (values.department !== undefined) await this.departmentSelect.selectOption({ label: values.department });
    if (values.experience !== undefined) await this.experienceInput.fill(values.experience);
    if (values.location !== undefined) await this.locationInput.field.fill(values.location);
    if (values.cities !== undefined) await this.citiesInput.fill(values.cities);
    if (values.description !== undefined) await this.descriptionInput.fill(values.description);
    if (values.contactNumber !== undefined) await this.contactNumberInput.fill(values.contactNumber);
    if (values.whatsapp !== undefined) await this.whatsappInput.fill(values.whatsapp);
    if (values.email !== undefined) await this.emailInput.fill(values.email);
    if (values.website !== undefined) await this.websiteInput.fill(values.website);
    if (values.instagram !== undefined) await this.instagramInput.fill(values.instagram);
    if (values.facebook !== undefined) await this.facebookInput.fill(values.facebook);
    if (values.priceFrom !== undefined) await this.priceFromInput.fill(values.priceFrom);
    if (values.priceTo !== undefined) await this.priceToInput.fill(values.priceTo);
    if (values.discount !== undefined) await this.discountInput.fill(values.discount);
    if (values.available !== undefined) await this.availableCheckbox.setChecked(values.available);
    if (values.featured !== undefined) await this.featuredCheckbox.setChecked(values.featured);
    if (values.trending !== undefined) await this.trendingCheckbox.setChecked(values.trending);
    if (values.verified !== undefined) await this.verifiedCheckbox.setChecked(values.verified);
    if (values.status !== undefined) {
      await this.statusSelect.selectOption(values.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE');
    }
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Create a vendor and return its id.
   *
   * Reads the id out of the URL, because create redirects to the EDIT page rather
   * than the list — which also means `packages` is immediately usable afterwards.
   */
  async create(values: VendorFormValues): Promise<string> {
    await this.fill(values);
    await this.submit();
    await this.page.waitForURL(/\/admin\/vendors\/(?!new)([^/?]+)$/, { timeout: 30_000 });
    const id = /\/admin\/vendors\/([^/?]+)$/.exec(this.page.url())?.[1];
    if (!id) throw new Error(`Could not read the created vendor id from ${this.page.url()}`);
    this.vendorId = id;
    return id;
  }

  /** Save an edit. Returns to the list and calls `router.refresh()`. */
  async saveEdit(values: VendorFormValues): Promise<void> {
    await this.fill(values);
    await this.submit();
    await expect(this.page).toHaveURL(new RegExp(`${paths.adminVendors}$`), { timeout: 30_000 });
  }

  // --------------------------------------------------------------- assertions

  async expectLoaded(): Promise<void> {
    await expect(this.form).toBeVisible();
    await expect(this.nameInput).toBeVisible();
    await expect(this.departmentSelect).toBeVisible();
  }

  /** Name and department are the ONLY required fields — everything else is free-form. */
  async expectRequiredFields(): Promise<void> {
    await expect(this.nameInput).toHaveAttribute('required', '');
    await expect(this.departmentSelect).toHaveAttribute('required', '');
  }

  /** The submit button is disabled and relabelled while saving. */
  async expectSaving(): Promise<void> {
    await expect(this.submitButton).toBeDisabled();
    await expect(this.submitButton).toContainText(messages.admin.vendors.saving);
  }

  async expectError(text?: string | RegExp): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: 30_000 });
    if (text) await expect(this.errorMessage).toContainText(text);
  }

  /** Confirms the create-redirects-to-edit behaviour. */
  async expectLandedOnEditPage(vendorId: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`/admin/vendors/${vendorId}$`));
    await expect(this.packages.root).toBeVisible();
  }

  /**
   * Bug B10, asserted as current behaviour: a stored `0` renders as an empty input,
   * so the operator cannot distinguish "free" from "not set".
   */
  async expectZeroRendersEmpty(): Promise<void> {
    await expect(this.priceFromInput).toHaveValue('');
  }

  /**
   * The six contact fields accept literally anything — no email or URL validation.
   * Asserted so a future addition of validation shows up as an intentional change.
   */
  async expectContactFieldsUnvalidated(): Promise<void> {
    await this.emailInput.fill('not-an-email');
    await this.websiteInput.fill('not a url at all');
    expect(await AdminVendorFormPage.isInputValid(this.emailInput)).toBeTruthy();
    expect(await AdminVendorFormPage.isInputValid(this.websiteInput)).toBeTruthy();
  }

  /** `onResolveCity` auto-appends the resolved city to "Available cities". */
  async expectCityAutoAppended(city: string): Promise<void> {
    await expect(this.citiesInput).toHaveValue(new RegExp(city));
  }
}
