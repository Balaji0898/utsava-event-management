import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackageDto, UpdatePackageDto } from './dto/package.dto';

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreatePackageDto) {
    return this.prisma.package.create({ data: dto });
  }

  findAll(vendorId?: string) {
    return this.prisma.package.findMany({
      where: vendorId ? { vendorId } : {},
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async update(id: string, dto: UpdatePackageDto) {
    await this.findOne(id);
    return this.prisma.package.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.package.delete({ where: { id } });
  }
}
