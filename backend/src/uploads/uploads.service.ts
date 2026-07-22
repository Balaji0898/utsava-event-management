import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

@Injectable()
export class UploadsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async upload(file: Express.Multer.File, folder = 'general', baseUrl?: string) {
    const stored = await this.storage.upload(file, folder, baseUrl);
    return this.prisma.mediaAsset.create({
      data: {
        url: stored.url,
        publicId: stored.publicId,
        provider: stored.provider,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        folder,
      },
    });
  }

  findAll(folder?: string) {
    return this.prisma.mediaAsset.findMany({
      where: folder ? { folder } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Media asset not found');
    await this.storage.remove(asset);
    return this.prisma.mediaAsset.delete({ where: { id } });
  }
}
