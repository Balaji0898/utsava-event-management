import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CmsBlockType, Status } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  Max,
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

  @ApiPropertyOptional({ enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}

export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {}

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
