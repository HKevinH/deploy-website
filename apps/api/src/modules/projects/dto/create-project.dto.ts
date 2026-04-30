import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'My App' })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional({ example: 'my-app' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase letters, numbers and hyphens' })
  @Length(2, 100)
  slug?: string;

  @ApiPropertyOptional({ example: 'Main web application' })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  description?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 500)
  description?: string;
}
