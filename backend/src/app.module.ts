import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DepartmentsModule } from './departments/departments.module';
import { CategoriesModule } from './categories/categories.module';
import { ItemsModule } from './items/items.module';
import { VendorsModule } from './vendors/vendors.module';
import { PackagesModule } from './packages/packages.module';
import { BookingsModule } from './bookings/bookings.module';
import { CmsModule } from './cms/cms.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    DepartmentsModule,
    CategoriesModule,
    ItemsModule,
    VendorsModule,
    PackagesModule,
    BookingsModule,
    CmsModule,
    UploadsModule,
  ],
})
export class AppModule {}
