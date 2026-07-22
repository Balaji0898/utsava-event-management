import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CmsBlockType, Role } from '@prisma/client';
import { CmsService } from './cms.service';
import {
  CreateBlockDto,
  UpdateBlockDto,
  CreateTestimonialDto,
  UpdateTestimonialDto,
  SubmitTestimonialDto,
  CreateFaqDto,
  UpdateFaqDto,
  UpdateContactDto,
  UpdateStatsDto,
  UpdateLegalDto,
} from './dto/cms.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('cms')
@Controller('cms')
export class CmsController {
  constructor(private readonly service: CmsService) {}

  // ---------- Blocks ----------
  @Public()
  @Get('blocks')
  findBlocks(@Query('type') type?: CmsBlockType, @Query('all') all?: string) {
    return this.service.findBlocks(type, all === 'true');
  }

  @Public()
  @Get('blocks/:key')
  findBlockByKey(@Param('key') key: string) {
    return this.service.findBlockByKey(key);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('blocks')
  createBlock(@Body() dto: CreateBlockDto) {
    return this.service.createBlock(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('blocks/:id')
  updateBlock(@Param('id') id: string, @Body() dto: UpdateBlockDto) {
    return this.service.updateBlock(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete('blocks/:id')
  removeBlock(@Param('id') id: string) {
    return this.service.removeBlock(id);
  }

  // ---------- Testimonials ----------
  @Public()
  @Get('testimonials')
  findTestimonials(@Query('all') all?: string) {
    return this.service.findTestimonials(all === 'true');
  }

  // Public end-user submission — created unapproved, hidden until an admin approves.
  @Public()
  @Post('testimonials/submit')
  submitTestimonial(@Body() dto: SubmitTestimonialDto) {
    return this.service.submitTestimonial(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('testimonials')
  createTestimonial(@Body() dto: CreateTestimonialDto) {
    return this.service.createTestimonial(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('testimonials/:id')
  updateTestimonial(@Param('id') id: string, @Body() dto: UpdateTestimonialDto) {
    return this.service.updateTestimonial(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete('testimonials/:id')
  removeTestimonial(@Param('id') id: string) {
    return this.service.removeTestimonial(id);
  }

  // ---------- FAQs ----------
  @Public()
  @Get('faqs')
  findFaqs(@Query('all') all?: string) {
    return this.service.findFaqs(all === 'true');
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('faqs')
  createFaq(@Body() dto: CreateFaqDto) {
    return this.service.createFaq(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('faqs/:id')
  updateFaq(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.service.updateFaq(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete('faqs/:id')
  removeFaq(@Param('id') id: string) {
    return this.service.removeFaq(id);
  }

  // ---------- Contact details (singleton) ----------
  @Public()
  @Get('contact')
  getContact() {
    return this.service.getContact();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Put('contact')
  updateContact(@Body() dto: UpdateContactDto) {
    return this.service.updateContact(dto);
  }

  // ---------- Home stats / trusted-users counters (singleton) ----------
  @Public()
  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Put('stats')
  updateStats(@Body() dto: UpdateStatsDto) {
    return this.service.updateStats(dto);
  }

  // ---------- Legal pages (terms, privacy, ...) ----------
  @Public()
  @Get('legal/:slug')
  getLegal(@Param('slug') slug: string) {
    return this.service.getLegal(slug);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Put('legal/:slug')
  updateLegal(@Param('slug') slug: string, @Body() dto: UpdateLegalDto) {
    return this.service.updateLegal(slug, dto);
  }
}
