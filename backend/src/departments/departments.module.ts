import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
})
export class DepartmentsModule {}
