import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GitProvider } from '@paas/shared';

export class CreateServiceDto {
  @ApiProperty({ example: 'web' })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional({ example: 'https://github.com/user/repo.git' })
  @IsUrl({ require_tld: false })
  @IsOptional()
  gitUrl?: string;

  @ApiPropertyOptional({ example: 'main' })
  @IsString()
  @IsOptional()
  gitBranch?: string;

  @ApiPropertyOptional({ enum: GitProvider })
  @IsEnum(GitProvider)
  @IsOptional()
  gitProvider?: GitProvider;

  @ApiPropertyOptional({ example: 'Dockerfile' })
  @IsString()
  @IsOptional()
  dockerfilePath?: string;

  @ApiPropertyOptional({ example: '.' })
  @IsString()
  @IsOptional()
  dockerContext?: string;

  @ApiPropertyOptional({ example: 3000 })
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  replicas?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsInt()
  @Min(1)
  @Max(100000)
  @IsOptional()
  lbMaxInFlight?: number;

  @ApiPropertyOptional({ example: 512 })
  @IsInt()
  @Min(64)
  @Max(8192)
  @IsOptional()
  memoryLimitMb?: number;

  @ApiPropertyOptional({ example: 0.5 })
  @IsNumber()
  @Min(0.1)
  @Max(8)
  @IsOptional()
  cpuLimit?: number;

  @ApiPropertyOptional({ example: '/health' })
  @IsString()
  @IsOptional()
  healthCheckPath?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  autoDeploy?: boolean;
}

export class UpdateServiceDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  gitBranch?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dockerfilePath?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  port?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  replicas?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  @IsOptional()
  lbMaxInFlight?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  memoryLimitMb?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  cpuLimit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  healthCheckPath?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  autoDeploy?: boolean;
}
