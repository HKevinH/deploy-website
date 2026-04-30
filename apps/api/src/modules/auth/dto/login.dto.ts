import { IsEmail, IsOptional, IsString, IsUrl, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class CreateApiKeyDto {
  @ApiProperty({ example: 'CI/CD Pipeline' })
  @IsString()
  @MinLength(2)
  name: string;
}

export class ConnectGithubDto {
  @ApiProperty({ example: 'ghp_xxxxxxxxxxxxxxxxxxxx' })
  @IsString()
  @MinLength(8)
  token: string;
}

export class GithubOAuthCallbackDto {
  @ApiProperty({ example: 'github_oauth_code' })
  @IsString()
  code: string;
}

export class UpdateProfileDto {
  @ApiProperty({ example: 'Kevin Alvear' })
  @IsString()
  @Length(2, 120)
  @IsOptional()
  name?: string;

  @ApiProperty({ example: '/avatars/avatar-01.svg' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
