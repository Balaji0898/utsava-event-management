import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CmsBlockType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBlockDto,
  UpdateBlockDto,
  CreateTestimonialDto,
  UpdateTestimonialDto,
  SubmitTestimonialDto,
  CreateFaqDto,
  UpdateFaqDto,
  UpdateContactDto,
  UpdateStatsDto,
  UpdateLegalDto,
} from './dto/cms.dto';

/** Legal pages that can be edited from the admin dashboard. */
const LEGAL_SLUGS = ['terms', 'privacy'] as const;
type LegalSlug = (typeof LEGAL_SLUGS)[number];

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  // -------------------- Blocks --------------------
  createBlock(dto: CreateBlockDto) {
    return this.prisma.cmsBlock.create({ data: dto });
  }

  findBlocks(type?: CmsBlockType, includeInactive = false) {
    return this.prisma.cmsBlock.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(includeInactive ? {} : { status: 'ACTIVE' }),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findBlockByKey(key: string) {
    const block = await this.prisma.cmsBlock.findUnique({ where: { key } });
    if (!block) throw new NotFoundException('Block not found');
    return block;
  }

  async updateBlock(id: string, dto: UpdateBlockDto) {
    await this.ensureBlock(id);
    return this.prisma.cmsBlock.update({ where: { id }, data: dto });
  }

  async removeBlock(id: string) {
    await this.ensureBlock(id);
    return this.prisma.cmsBlock.delete({ where: { id } });
  }

  private async ensureBlock(id: string) {
    const found = await this.prisma.cmsBlock.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Block not found');
  }

  // -------------------- Testimonials --------------------
  // Admin-authored testimonials are approved by default; a public submission
  // (submitTestimonial) stays unapproved until an admin approves it.
  createTestimonial(dto: CreateTestimonialDto) {
    return this.prisma.testimonial.create({
      data: { approved: true, ...dto },
    });
  }

  /** Public submission from an end user — hidden until an admin approves. */
  submitTestimonial(dto: SubmitTestimonialDto) {
    return this.prisma.testimonial.create({
      data: {
        name: dto.name,
        message: dto.message,
        role: dto.role,
        rating: dto.rating ?? 5,
        approved: false,
        status: 'ACTIVE',
      },
    });
  }

  findTestimonials(includeInactive = false) {
    return this.prisma.testimonial.findMany({
      // Public site: only approved + active. Admin (?all=true): everything,
      // so pending submissions can be moderated.
      where: includeInactive ? {} : { status: 'ACTIVE', approved: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateTestimonial(id: string, dto: UpdateTestimonialDto) {
    await this.ensure('testimonial', id);
    return this.prisma.testimonial.update({ where: { id }, data: dto });
  }

  async removeTestimonial(id: string) {
    await this.ensure('testimonial', id);
    return this.prisma.testimonial.delete({ where: { id } });
  }

  // -------------------- FAQs --------------------
  createFaq(dto: CreateFaqDto) {
    return this.prisma.faq.create({ data: dto });
  }

  findFaqs(includeInactive = false) {
    return this.prisma.faq.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateFaq(id: string, dto: UpdateFaqDto) {
    await this.ensure('faq', id);
    return this.prisma.faq.update({ where: { id }, data: dto });
  }

  async removeFaq(id: string) {
    await this.ensure('faq', id);
    return this.prisma.faq.delete({ where: { id } });
  }

  private async ensure(model: 'testimonial' | 'faq', id: string) {
    const found = await (this.prisma[model] as any).findUnique({ where: { id } });
    if (!found) throw new NotFoundException(`${model} not found`);
  }

  // -------------------- Singleton keyed blocks --------------------
  /** Create-or-update a CmsBlock by its unique key, merging into `data`. */
  private async upsertBlockData(
    key: string,
    data: Record<string, any>,
    title?: string,
  ) {
    return this.prisma.cmsBlock.upsert({
      where: { key },
      update: { data },
      create: { key, type: CmsBlockType.SECTION, title: title ?? key, data },
    });
  }

  // ----- Contact (site-contact) -----
  async getContact() {
    const block = await this.prisma.cmsBlock.findUnique({
      where: { key: 'site-contact' },
    });
    return (block?.data as Record<string, any>) ?? null;
  }

  async updateContact(dto: UpdateContactDto) {
    const current = (await this.getContact()) ?? {};
    const merged = { ...current, ...dto };
    const block = await this.upsertBlockData('site-contact', merged, 'Contact');
    return block.data;
  }

  // ----- Home stats (home-stats) -----
  async getStats() {
    const block = await this.prisma.cmsBlock.findUnique({
      where: { key: 'home-stats' },
    });
    return (block?.data as Record<string, any>) ?? null;
  }

  async updateStats(dto: UpdateStatsDto) {
    const block = await this.upsertBlockData('home-stats', { items: dto.items }, 'Home stats');
    return block.data;
  }

  // ----- Legal pages (legal-<slug>) -----
  private assertLegalSlug(slug: string): asserts slug is LegalSlug {
    if (!LEGAL_SLUGS.includes(slug as LegalSlug)) {
      throw new BadRequestException(
        `Unknown legal page "${slug}". Allowed: ${LEGAL_SLUGS.join(', ')}.`,
      );
    }
  }

  async getLegal(slug: string) {
    this.assertLegalSlug(slug);
    const block = await this.prisma.cmsBlock.findUnique({
      where: { key: `legal-${slug}` },
    });
    return { slug, content: block?.content ?? '' };
  }

  async updateLegal(slug: string, dto: UpdateLegalDto) {
    this.assertLegalSlug(slug);
    const key = `legal-${slug}`;
    const block = await this.prisma.cmsBlock.upsert({
      where: { key },
      update: { content: dto.content },
      create: {
        key,
        type: CmsBlockType.SECTION,
        title: `Legal: ${slug}`,
        content: dto.content,
      },
    });
    return { slug, content: block.content ?? '' };
  }
}
