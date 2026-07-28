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
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
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
          // Raster images only. SVG is intentionally excluded — it can carry
          // <script> and would be a stored-XSS vector when served from /uploads.
          new FileTypeValidator({ fileType: /^image\/(png|jpe?g|webp|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: Request,
    @Query('folder') folder?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    // Build the public base URL from the request that actually reached this
    // backend (proxy-aware), so locally-stored files resolve to THIS server —
    // not whatever APP_URL happens to be set to. Fixes uploads 404'ing when
    // APP_URL points at the frontend domain.
    return this.service.upload(file, safeFolder(folder), baseUrlFromRequest(req));
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

/**
 * Sanitize the client-supplied `folder` so it can never escape the upload root.
 * Only a single simple path segment is allowed; anything with separators, `..`,
 * or unexpected characters falls back to "general".
 */
function safeFolder(folder?: string): string {
  if (!folder) return 'general';
  const trimmed = folder.trim();
  return /^[a-z0-9_-]{1,40}$/i.test(trimmed) ? trimmed : 'general';
}

/**
 * Derive the public base URL (scheme + host) from the request, honouring the
 * reverse-proxy headers Render/Vercel/etc. add. This is the host that served
 * the upload and will serve the file back, so it's always correct.
 */
function baseUrlFromRequest(req: Request): string | undefined {
  const proto = (
    ((req.headers['x-forwarded-proto'] as string) || req.protocol || 'https')
      .split(',')[0]
      .trim()
  );
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  return host ? `${proto}://${host}` : undefined;
}
