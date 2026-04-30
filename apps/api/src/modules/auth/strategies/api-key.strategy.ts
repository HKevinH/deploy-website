import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { UsersService } from '../../users/users.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(HeaderAPIKeyStrategy, 'api-key') {
  constructor(private readonly usersService: UsersService) {
    super({ header: 'x-api-key', prefix: '' }, true);
  }

  async validate(apiKey: string) {
    const user = await this.usersService.findByApiKey(apiKey);
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid API key');
    return user;
  }
}
