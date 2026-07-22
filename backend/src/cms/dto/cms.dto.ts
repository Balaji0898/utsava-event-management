import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CmsBlockType, Status } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';

// ---- CMS blocks (banners, sliders, sections, footer) ----
export class CreateBlockDto {
  @IsString()
  key: string;

  @ApiPropertyOptional({ enum: CmsBlockType })
  @IsOptional()
  @IsEnum(CmsBlockType)
  type?: CmsBlockType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}

export class UpdateBlockDto extends PartialType(CreateBlockDto) {}

// ---- Testimonials ----
export class CreateTestimonialDto {
  @IsString()
  name: string;

  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  @ApiPropertyOptional({ enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}

export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {}

// ---- Public testimonial submission (from end users) ----
export class SubmitTestimonialDto {
  @IsString()
  name: string;

  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

// ---- FAQs ----
export class CreateFaqDto {
  @IsString()
  question: string;

  @IsString()
  answer: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}

export class UpdateFaqDto extends PartialType(CreateFaqDto) {}

// ---- Site contact details (singleton block: site-contact) ----
export class UpdateContactDto {
  @ApiPropertyOptional() @IsOptional() @IsString() manager?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phoneDisplay?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() whatsapp?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
}

// ---- Home stats / "trusted users" counters (singleton block: home-stats) ----
export class StatItemDto {
  @IsString()
  label: string;

  @IsNumber()
  value: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  suffix?: string;
}

export class UpdateStatsDto {
  @ApiProperty({ type: [StatItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatItemDto)
  items: StatItemDto[];
}

// ---- Legal pages (singleton blocks: legal-terms, legal-privacy, ...) ----
export class UpdateLegalDto {
  @IsString()
  content: string;
}
