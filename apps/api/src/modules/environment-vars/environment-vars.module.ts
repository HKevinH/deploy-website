import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentVarsService } from './environment-vars.service';
import { EnvironmentVarsController } from './environment-vars.controller';
import { EnvironmentVar } from './entities/environment-var.entity';
import { CryptoService } from '../../infrastructure/crypto/crypto.service';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [TypeOrmModule.forFeature([EnvironmentVar]), ServicesModule],
  providers: [EnvironmentVarsService, CryptoService],
  controllers: [EnvironmentVarsController],
  exports: [EnvironmentVarsService],
})
export class EnvironmentVarsModule {}
