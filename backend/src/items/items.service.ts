import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';

export interface ItemQuery {
  departmentId?: string;
  categoryId?: string;
  vendorId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateItemDto) {
    return this.prisma.item.create({ data: dto });
  }

  async findAll(q: ItemQuery) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Number(q.limit) || 20);
    const where = {
      ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.vendorId ? { vendorId: q.vendorId } : {}),
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.item.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: { department: true, category: true, vendor: true },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async update(id: string, dto: UpdateItemDto) {
    await this.ensureExists(id);
    return this.prisma.item.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.item.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.item.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Item not found');
  }
}
