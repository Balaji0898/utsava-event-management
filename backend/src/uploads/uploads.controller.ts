import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UploadsService } from './uploads.service';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly service: UploadsService) {}

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string', example: 'vendors' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
    }),
  )
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 8 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^(image\/(png|jpe?g|webp|gif|svg\+xml))$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.service.upload(file, folder ?? 'general');
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get()
  findAll(@Query('folder') folder?: string) {
    return this.service.findAll(folder);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
