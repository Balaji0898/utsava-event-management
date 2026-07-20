import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/booking.dto';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBookingDto, customerId?: string) {
    // In production: dispatch email / WhatsApp / push notification to admin here.
    return this.prisma.booking.create({
      data: {
        customerId,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
        vendorId: dto.vendorId,
        packageId: dto.packageId,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
        location: dto.location,
        guestCount: dto.guestCount,
        budget: dto.budget,
        specialRequirements: dto.specialRequirements,
        items: dto.items ?? undefined,
      },
    });
  }

  async findAll(status?: BookingStatus) {
    return this.prisma.booking.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: { vendor: true, package: true },
    });
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { vendor: true, package: true, customer: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async updateStatus(id: string, status: BookingStatus) {
    await this.findOne(id);
    return this.prisma.booking.update({ where: { id }, data: { status } });
  }

  async stats() {
    const [
      totalVendors,
      totalDepartments,
      totalCategories,
      totalItems,
      totalBookings,
      pending,
      confirmed,
      cancelled,
      revenueAgg,
    ] = await Promise.all([
      this.prisma.vendor.count(),
      this.prisma.department.count(),
      this.prisma.category.count(),
      this.prisma.item.count(),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'PENDING' } }),
      this.prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.booking.count({ where: { status: 'CANCELLED' } }),
      this.prisma.booking.aggregate({
        _sum: { budget: true },
        where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
      }),
    ]);

    return {
      totalVendors,
      totalDepartments,
      totalCategories,
      totalItems,
      totalBookings,
      pending,
      confirmed,
      cancelled,
      revenue: revenueAgg._sum.budget ?? new Prisma.Decimal(0),
    };
  }
}
