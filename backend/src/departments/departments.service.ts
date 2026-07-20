import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { slugify } from '../common/slug.util';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: { ...dto, slug: dto.slug ?? slugify(dto.name) },
    });
  }

  findAll(includeInactive = false) {
    return this.prisma.department.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { vendors: true, categories: true, items: true } } },
    });
  }

  async findOne(idOrSlug: string) {
    const dept = await this.prisma.department.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { categories: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.ensureExists(id);
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.department.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.department.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Department not found');
  }
}
