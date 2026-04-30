import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { ApiKey } from './entities/api-key.entity';
import { CryptoService } from '../../infrastructure/crypto/crypto.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, ApiKey])],
  providers: [UsersService, CryptoService],
  exports: [UsersService],
})
export class UsersModule {}
