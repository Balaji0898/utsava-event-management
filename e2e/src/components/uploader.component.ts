import { expect, type Locator, type Page } from '@playwright/test';
import { tid } from '@config/testids';
import { messages } from '@data/test-data';

/**
 * `ImageUploader` and `GalleryUploader`
 * (`features/admin/components/image-uploader.tsx` / `gallery-uploader.tsx`).
 *
 * Four quirks:
 *
 *  1. The real `<input type="file">` is `className="hidden"`, so the visible drop
 *     zone is a `<button>`. `setInputFiles` works on a hidden input, which is
 *     simpler and more reliable than the `fileChooser` dance.
 *  2. Both components BYPASS the shared `api()` wrapper and `fetch` directly to
 *     `${NEXT_PUBLIC_API_URL}/api/uploads?folder=…` with the FormData field named
 *     **`file`** and a manual `Authorization` header read from
 *     `localStorage.accessToken`. Consequences: no silent token refresh on this
 *     path (a 401 here is terminal), and **no revalidate ping**, so an uploaded
 *     image will not appear on a cached public page until something else busts the
 *     cache.
 *  3. Backend limits: 8 MB via both `limits.fileSize` and `MaxFileSizeValidator`,
 *     and `FileTypeValidator(/^image\/(png|jpe?g|webp|gif)$/)` — **SVG is
 *     deliberately excluded** because it can carry `<script>` and would be a
 *     stored-XSS vector served from `/uploads`.
 *  4. Folder values in use are `departments`, `vendors` and `testimonials`; the
 *     folder is part of the testid so two uploaders on one page stay distinct.
 */
export class UploaderComponent {
  constructor(
    private readonly page: Page,
    private readonly folder: 'departments' | 'vendors' | 'testimonials',
  ) {}

  get dropZone(): Locator {
    return this.page.getByTestId(tid.upload.dropZone(this.folder));
  }

  /** The hidden `<input type="file" accept="image/*">`. */
  get fileInput(): Locator {
    return this.page.getByTestId(tid.upload.input(this.folder));
  }

  get preview(): Locator {
    return this.page.getByTestId(tid.upload.preview(this.folder));
  }

  get removeButton(): Locator {
    return this.page.getByTestId(tid.upload.remove(this.folder));
  }

  /**
   * @param file `{ name, mimeType, buffer }` — built in-memory so the suite carries
   *   no binary fixtures and can generate an oversize file without a 9 MB blob in git.
   */
  async upload(file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
    await this.fileInput.setInputFiles(file);
  }

  async expectUploadSucceeded(): Promise<void> {
    await expect(this.dropZone).not.toContainText(messages.admin.uploads.uploading, { timeout: 45_000 });
    await expect(this.preview).toBeVisible({ timeout: 45_000 });
  }

  /**
   * The components surface a rejection by simply not producing a preview — there is
   * no error UI. So "rejected" is asserted as "no preview appeared", which is why
   * the API-level upload specs carry the authoritative status-code assertions.
   */
  async expectUploadRejected(): Promise<void> {
    await expect(this.dropZone).not.toContainText(messages.admin.uploads.uploading, { timeout: 45_000 });
    await expect(this.preview).toBeHidden();
  }

  async remove(): Promise<void> {
    await this.removeButton.click();
    await expect(this.preview).toBeHidden();
  }
}

/** The multi-file gallery uploader. Same endpoint, `multiple` input, N previews. */
export class GalleryUploaderComponent {
  constructor(private readonly page: Page) {}

  get addButton(): Locator {
    return this.page.getByTestId(tid.upload.galleryAdd);
  }

  get fileInput(): Locator {
    return this.page.getByTestId(tid.upload.galleryInput);
  }

  item(n: number): Locator {
    return this.page.getByTestId(tid.upload.galleryItem(n));
  }

  removeItem(n: number): Locator {
    return this.page.getByTestId(tid.upload.galleryRemove(n));
  }

  async uploadMany(files: { name: string; mimeType: string; buffer: Buffer }[]): Promise<void> {
    await this.fileInput.setInputFiles(files);
  }

  async expectItemCount(n: number): Promise<void> {
    await expect(this.page.getByTestId(/^upload-gallery-item-/)).toHaveCount(n, { timeout: 60_000 });
  }
}

// ------------------------------------------------------------------- fixtures

/** A minimal valid 1x1 PNG. Small enough to upload instantly, real enough to pass. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAwAI/AL+XJPLTQAAAABJRU5ErkJggg==',
  'base64',
);

/** A minimal valid GIF — proves the `gif` branch of the MIME allowlist. */
export const GIF_1X1 = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/**
 * An SVG carrying a script. Must be REJECTED with 400 — this is the control that
 * stops `/uploads` becoming a stored-XSS delivery path.
 */
export const SVG_WITH_SCRIPT = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  'utf8',
);

/** 9 MB of zeroes with a PNG header — over the 8 MB cap, so must be rejected. */
export function oversizePng(): Buffer {
  const body = Buffer.alloc(9 * 1024 * 1024, 0);
  PNG_1X1.copy(body, 0, 0, Math.min(PNG_1X1.length, body.length));
  return body;
}

/** HTML masquerading as an image — must fail the MIME check, not the size check. */
export const HTML_DISGUISED = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');
