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
  lat?: number;
  lng?: number;
  radius?: number; // km
}

/**
 * Radius (km) applied to a "near me" query that supplies coordinates but no
 * explicit `radius`.
 *
 * Must stay in sync with NEARBY_RADIUS_KM in the frontend's shared/config/site.ts
 * so that a caller who omits `radius` sees the same results the site shows.
 * The two cannot import one value: frontend and backend are separate
 * deployables with no shared package.
 */
export const DEFAULT_NEARBY_RADIUS_KM = 200;

/** Great-circle distance between two lat/lng points, in km (Haversine). */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Case-insensitive city matching for the `availableCities` string[] (Prisma
 * array `has`/`hasSome` are exact-case): match common casings of the query
 * (as-is, lower, UPPER, Title Case) so a reverse-geocoded "Hyderabad" still
 * finds a stored "hyderabad".
 */
function cityVariants(city: string): string[] {
  const c = city.trim();
  const title = c.replace(/\b\w/g, (m) => m.toUpperCase());
  return Array.from(new Set([c, c.toLowerCase(), c.toUpperCase(), title]));
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
      ...(q.city ? { availableCities: { hasSome: cityVariants(q.city) } } : {}),
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

    const include = { department: true, packages: { orderBy: { sortOrder: 'asc' as const } } };

    // "Near me": when coordinates are provided, return only vendors that have
    // coordinates within `radius` km, sorted by distance (Haversine in JS —
    // Prisma has no geo). Paginated in memory (dataset is small). The caller
    // falls back to the unfiltered list when this comes back empty.
    if (q.lat != null && q.lng != null) {
      const radius = q.radius && q.radius > 0 ? q.radius : DEFAULT_NEARBY_RADIUS_KM;
      const candidates = await this.prisma.vendor.findMany({
        where: { ...where, latitude: { not: null }, longitude: { not: null } },
        include,
        take: 500,
      });
      const withinRadius = candidates
        .map((v) => ({
          v,
          dist: distanceKm(q.lat!, q.lng!, v.latitude as number, v.longitude as number),
        }))
        .filter((x) => x.dist <= radius)
        .sort((a, b) => a.dist - b.dist);
      const total = withinRadius.length;
      const data = withinRadius
        .slice((page - 1) * limit, page * limit)
        .map((x) => x.v);
      return { data, total, page, limit, pages: Math.ceil(total / limit) };
    }

    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include,
      }),
      this.prisma.vendor.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * Look up one vendor by id or slug.
   *
   * Filters to ACTIVE unless `includeInactive` is set. Without that filter this
   * leaked: `findAll` hides an INACTIVE vendor from every listing, but the detail
   * lookup returned it to anyone holding the slug — so deactivating a vendor took
   * it out of the catalogue while leaving its page, packages, items and reviews
   * publicly readable and indexable. VDETAIL-E-07 asserts the 404.
   *
   * `includeInactive` is reachable only through the ADMIN-gated route, because an
   * admin must be able to open a deactivated vendor in order to reactivate it.
   */
  async findOne(idOrSlug: string, { includeInactive = false }: { includeInactive?: boolean } = {}) {
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        ...(includeInactive ? {} : { status: 'ACTIVE' }),
      },
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
