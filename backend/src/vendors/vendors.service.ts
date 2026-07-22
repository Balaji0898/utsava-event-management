import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { slugify } from '../common/slug.util';

export interface VendorQuery {
  departmentId?: string;
  city?: string;
  search?: string;
  featured?: boolean;
  trending?: boolean;
  verified?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: 'newest' | 'popular' | 'priceAsc' | 'priceDesc';
  page?: number;
  limit?: number;
}

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateVendorDto) {
    const vendor = await this.prisma.vendor.create({
      data: { ...dto, slug: dto.slug ?? slugify(dto.name) },
    });
    // "Best event" = featured, one per category (department).
    if (vendor.featured) {
      await this.demoteOtherFeatured(vendor.id, vendor.departmentId);
    }
    return vendor;
  }

  async findAll(q: VendorQuery) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Number(q.limit) || 12);

    const where: Prisma.VendorWhereInput = {
      status: 'ACTIVE',
      ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      ...(q.city ? { availableCities: { has: q.city } } : {}),
      ...(q.featured ? { featured: true } : {}),
      ...(q.trending ? { trending: true } : {}),
      ...(q.verified ? { verified: true } : {}),
      ...(q.minRating ? { rating: { gte: q.minRating } } : {}),
      ...(q.search
        ? { name: { contains: q.search, mode: 'insensitive' } }
        : {}),
      ...(q.minPrice || q.maxPrice
        ? {
            priceFrom: {
              ...(q.minPrice ? { gte: q.minPrice } : {}),
              ...(q.maxPrice ? { lte: q.maxPrice } : {}),
            },
          }
        : {}),
    };

    const orderBy: Prisma.VendorOrderByWithRelationInput =
      q.sort === 'popular'
        ? { reviewCount: 'desc' }
        : q.sort === 'priceAsc'
          ? { priceFrom: 'asc' }
          : q.sort === 'priceDesc'
            ? { priceFrom: 'desc' }
            : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { department: true, packages: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.vendor.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(idOrSlug: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        department: true,
        packages: { orderBy: { sortOrder: 'asc' } },
        items: true,
        reviews: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async update(id: string, dto: UpdateVendorDto) {
    await this.ensureExists(id);
    const vendor = await this.prisma.vendor.update({ where: { id }, data: dto });
    // If this vendor was just marked as the "best event" (featured), make it the
    // only featured one in its category by unmarking the others.
    if (dto.featured === true) {
      await this.demoteOtherFeatured(vendor.id, vendor.departmentId);
    }
    return vendor;
  }

  /** Keep at most one featured ("best event") vendor per department/category. */
  private async demoteOtherFeatured(vendorId: string | null, departmentId: string) {
    await this.prisma.vendor.updateMany({
      where: {
        departmentId,
        featured: true,
        ...(vendorId ? { id: { not: vendorId } } : {}),
      },
      data: { featured: false },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.vendor.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.vendor.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Vendor not found');
  }
}
