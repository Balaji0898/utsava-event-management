import { expect, type Locator } from '@playwright/test';
import { AdminPage } from '../admin.page';
import { tid } from '@config/testids';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';
import { UploaderComponent } from '@components/uploader.component';

/**
 * `/admin/departments`.
 *
 * ⚠️ **Naming mismatch, faithfully reproduced here:** the sidebar link says
 * "Departments", the page `<h2>` says "Categories", the create button says "Add
 * category", the modal says "Edit category" — but every request goes to
 * `/departments`, and the confirm dialog says "Delete this department?". Both
 * vocabularies are real; `messages.admin.departments` records each string where it
 * actually appears.
 *
 * Client validation is a single `if (!draft.name) return` — no zod, no error
 * message. So submitting an empty form is another silent no-op, asserted as such.
 *
 * **Delete cascades.** `Department` is the parent of `Category`, `Item` and `Vendor`
 * with `onDelete: Cascade`, so deleting one silently removes every vendor in it and
 * every package under those vendors. The confirm text does not say so. That is worth
 * an explicit test.
 *
 * The edit modal is a bare `fixed inset-0 z-50` div with **no `role="dialog"`** and
 * no focus trap — Phase 3 adds the role, and the focus-trap spec documents the gap.
 */
export class AdminDepartmentsPage extends AdminPage {
  get path(): string {
    return paths.adminDepartments;
  }

  readonly bannerUploader = new UploaderComponent(this.page, 'departments');

  // ------------------------------------------------------------- create form

  get createForm(): Locator {
    return this.testId(tid.dept.createForm);
  }

  get nameInput(): Locator {
    return this.testId(tid.dept.name);
  }

  get iconInput(): Locator {
    return this.testId(tid.dept.icon);
  }

  get descriptionInput(): Locator {
    return this.testId(tid.dept.description);
  }

  get addButton(): Locator {
    return this.testId(tid.dept.submit);
  }

  // -------------------------------------------------------------------- table

  get table(): Locator {
    return this.testId(tid.dept.table);
  }

  get emptyMessage(): Locator {
    return this.testId(tid.dept.empty);
  }

  row(id: string): Locator {
    return this.testId(tid.dept.row(id));
  }

  /** Rows are also addressable by name, for a record whose id the spec lacks. */
  rowByName(name: string): Locator {
    return this.table.getByRole('row').filter({ hasText: name });
  }

  editButton(id: string): Locator {
    return this.testId(tid.dept.rowEdit(id));
  }

  deleteButton(id: string): Locator {
    return this.testId(tid.dept.rowDelete(id));
  }

  /** The vendor count column — proves the cascade relationship is visible. */
  vendorCount(id: string): Locator {
    return this.testId(tid.dept.rowVendorCount(id));
  }

  /** An amber "No image" chip when no banner is set. */
  noImageChip(id: string): Locator {
    return this.testId(tid.dept.rowNoImage(id));
  }

  // -------------------------------------------------------------- edit modal

  get modal(): Locator {
    return this.testId(tid.dept.modal);
  }

  get modalClose(): Locator {
    return this.testId(tid.dept.modalClose);
  }

  get modalSave(): Locator {
    return this.testId(tid.dept.modalSave);
  }

  get modalNameInput(): Locator {
    return this.testId(tid.dept.modalName);
  }

  get modalIconInput(): Locator {
    return this.testId(tid.dept.modalIcon);
  }

  get modalDescriptionInput(): Locator {
    return this.testId(tid.dept.modalDescription);
  }

  // ------------------------------------------------------------------ actions

  async create(values: { name: string; icon?: string; description?: string }): Promise<void> {
    await this.nameInput.fill(values.name);
    if (values.icon !== undefined) await this.iconInput.fill(values.icon);
    if (values.description !== undefined) await this.descriptionInput.fill(values.description);
    await this.addButton.click();
    await expect(this.rowByName(values.name)).toBeVisible({ timeout: 30_000 });
  }

  /** Click Add with nothing filled — the `if (!draft.name) return` guard. */
  async submitEmpty(): Promise<void> {
    await this.addButton.click();
  }

  async openEditModal(id: string): Promise<void> {
    await this.editButton(id).click();
    await expect(this.modal).toBeVisible();
  }

  async editName(id: string, newName: string): Promise<void> {
    await this.openEditModal(id);
    await this.modalNameInput.fill(newName);
    await this.modalSave.click();
    await expect(this.modal).toBeHidden({ timeout: 30_000 });
    await expect(this.rowByName(newName)).toBeVisible();
  }

  async closeModalWithButton(): Promise<void> {
    await this.modalClose.click();
    await expect(this.modal).toBeHidden();
  }

  /** The modal closes on backdrop click — target a corner, not the panel. */
  async closeModalWithBackdrop(): Promise<void> {
    await this.modal.click({ position: { x: 5, y: 5 } });
    await expect(this.modal).toBeHidden();
  }

  /**
   * Delete, accepting the native confirm.
   *
   * `acceptOnce` rather than `acceptAll`: a second unexpected confirm should hang the
   * test visibly instead of silently deleting another record.
   */
  async deleteDepartment(id: string): Promise<void> {
    const handler = this.dialogs;
    handler.acceptOnce();
    await this.deleteButton(id).click();
    await expect(this.row(id)).toHaveCount(0, { timeout: 30_000 });
  }

  /** Cancel the confirm — the row must survive. */
  async cancelDelete(id: string): Promise<void> {
    const handler = this.dialogs;
    handler.dismissAll();
    await this.deleteButton(id).click();
    await expect(this.row(id)).toBeVisible();
    handler.dispose();
  }

  // --------------------------------------------------------------- assertions

  async expectLoaded(): Promise<void> {
    await this.expectHeading(messages.admin.departments.heading, 2);
  }

  async expectContains(name: string): Promise<void> {
    await expect(this.rowByName(name).first()).toBeVisible();
  }

  async expectDoesNotContain(name: string): Promise<void> {
    await expect(this.rowByName(name)).toHaveCount(0);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.emptyMessage).toHaveText(messages.admin.departments.empty);
  }

  /** The create form silently ignores an empty name — no row, no error. */
  async expectSilentCreateFailure(rowCountBefore: number): Promise<void> {
    await expect(this.table.getByRole('row')).toHaveCount(rowCountBefore);
  }

  async expectVendorCount(id: string, count: number): Promise<void> {
    await expect(this.vendorCount(id)).toContainText(String(count));
  }
}
