import { Injectable, NotFoundException } from '@nestjs/common';
import { CmsBlockType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBlockDto,
  UpdateBlockDto,
  CreateTestimonialDto,
  UpdateTestimonialDto,
  CreateFaqDto,
  UpdateFaqDto,
} from './dto/cms.dto';

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
  createTestimonial(dto: CreateTestimonialDto) {
    return this.prisma.testimonial.create({ data: dto });
  }

  findTestimonials(includeInactive = false) {
    return this.prisma.testimonial.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
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
}
