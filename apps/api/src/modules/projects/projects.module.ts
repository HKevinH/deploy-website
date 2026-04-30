import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { Build } from '../builds/entities/build.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { Project } from './entities/project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Build])],
  providers: [ProjectsService, StorageService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
