import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CmsService } from './cms.service';
import { CmsController } from './cms.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CmsController],
  providers: [CmsService],
})
export class CmsModule {}
