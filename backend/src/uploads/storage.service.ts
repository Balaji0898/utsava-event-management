import { Injectable, Logger } from '@nestjs/common';
import { MediaProvider } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

/** Allowed image MIME types → canonical file extension. */
const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export interface StoredFile {
  url: string;
  publicId?: string;
  provider: MediaProvider;
}

/**
 * Pluggable file storage.
 * - If Cloudinary env vars are present → uploads to Cloudinary.
 * - Otherwise → writes to the local `uploads/` folder (served at /uploads).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private readonly appUrl = process.env.APP_URL ?? 'http://localhost:4000';

  private get cloudinaryEnabled(): boolean {
    return Boolean(
      process.env.CLOUDINARY_URL ||
        (process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET),
    );
  }

  /**
   * Build a random filename with an extension derived from the (validated) MIME
   * type — never from the client-supplied filename, which could inject a
   * dangerous extension like `.html`.
   */
  private safeName(mimeType: string): string {
    const ext = MIME_EXT[mimeType?.toLowerCase()] ?? '.bin';
    return `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
  }

  async upload(
    file: Express.Multer.File,
    folder = 'general',
    baseUrl?: string,
  ): Promise<StoredFile> {
    if (this.cloudinaryEnabled) {
      return this.uploadToCloudinary(file, folder);
    }
    return this.uploadToDisk(file, folder, baseUrl);
  }

  async remove(asset: { provider: MediaProvider; publicId?: string | null; url: string }) {
    if (asset.provider === MediaProvider.CLOUDINARY && asset.publicId) {
      try {
        const { v2: cloudinary } = await import('cloudinary');
        this.configureCloudinary(cloudinary);
        await cloudinary.uploader.destroy(asset.publicId);
      } catch (e) {
        this.logger.warn(`Cloudinary delete failed: ${(e as Error).message}`);
      }
      return;
    }
    // local — best-effort delete
    try {
      const relative = asset.url.split('/uploads/')[1];
      if (relative) await fs.unlink(join(this.uploadDir, relative));
    } catch (e) {
      this.logger.warn(`Local delete failed: ${(e as Error).message}`);
    }
  }

  private async uploadToDisk(
    file: Express.Multer.File,
    folder: string,
    baseUrl?: string,
  ): Promise<StoredFile> {
    const dir = join(this.uploadDir, folder);
    await fs.mkdir(dir, { recursive: true });
    const filename = this.safeName(file.mimetype);
    await fs.writeFile(join(dir, filename), file.buffer);
    // Prefer the request-derived base URL (the host that served the upload);
    // fall back to APP_URL, then localhost.
    const base = (baseUrl || this.appUrl).replace(/\/+$/, '');
    return {
      url: `${base}/uploads/${folder}/${filename}`,
      provider: MediaProvider.LOCAL,
    };
  }

  private configureCloudinary(cloudinary: any) {
    if (process.env.CLOUDINARY_URL) return; // auto-configured from env
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  private async uploadToCloudinary(
    file: Express.Multer.File,
    folder: string,
  ): Promise<StoredFile> {
    const { v2: cloudinary } = await import('cloudinary');
    this.configureCloudinary(cloudinary);

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `elite-events/${folder}`, resource_type: 'auto' },
        (error, res) => (error ? reject(error) : resolve(res)),
      );
      stream.end(file.buffer);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      provider: MediaProvider.CLOUDINARY,
    };
  }
}
