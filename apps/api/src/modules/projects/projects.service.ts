import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Repository } from 'typeorm';
import slugify from 'slugify';
import { DockerService } from '../../infrastructure/docker/docker.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { Build } from '../builds/entities/build.entity';
import { Project } from './entities/project.entity';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project) private readonly repo: Repository<Project>,
    @InjectRepository(Build) private readonly buildsRepo: Repository<Build>,
    private readonly dockerService: DockerService,
    private readonly storageService: StorageService,
    private readonly config: ConfigService,
  ) {}

  async create(ownerId: string, dto: CreateProjectDto): Promise<Project> {
    const slug = dto.slug ?? slugify(dto.name, { lower: true, strict: true });

    const project = this.repo.create({
      name: dto.name,
      slug,
      description: dto.description ?? null,
      ownerId,
    });

    return this.repo.save(project);
  }

  async findAllByOwner(ownerId: string): Promise<Project[]> {
    return this.repo.find({
      where: { ownerId },
      relations: ['services'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, ownerId: string): Promise<Project> {
    const project = await this.repo.findOne({
      where: { id },
      relations: ['services', 'services.domains', 'services.activeDeployment'],
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== ownerId) throw new ForbiddenException();

    return project;
  }

  async update(id: string, ownerId: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id, ownerId);
    Object.assign(project, dto);
    return this.repo.save(project);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const project = await this.findOne(id, ownerId);
    const serviceIds = project.services.map((service) => service.id);
    const builds = serviceIds.length
      ? await this.buildsRepo.find({ where: serviceIds.map((serviceId) => ({ serviceId })) })
      : [];

    const dockerCleanup = await this.dockerService.removeProjectContainers(project.id);
    await this.removeTraefikRoutes(serviceIds);
    await this.removeBuildArtifacts(builds);

    await this.repo.remove(project);

    this.logger.log(
      `Project ${project.id} deleted with ${dockerCleanup.containersRemoved} containers and ${dockerCleanup.volumesRemoved} volumes removed`,
    );
  }

  private async removeBuildArtifacts(builds: Build[]): Promise<void> {
    const imageRefs = new Set<string>();

    for (const build of builds) {
      if (build.imageName && build.imageTag) {
        imageRefs.add(`${build.imageName}:${build.imageTag}`);
      }

      if (build.logPath) {
        await this.storageService.removeObject(build.logPath);
      }
    }

    for (const imageRef of imageRefs) {
      const lastColon = imageRef.lastIndexOf(':');
      if (lastColon === -1) continue;

      const imageName = imageRef.slice(0, lastColon);
      const imageTag = imageRef.slice(lastColon + 1);

      try {
        await this.dockerService.removeImage(imageName, imageTag);
      } catch (err) {
        this.logger.warn(`Could not remove image ${imageRef}: ${String(err)}`);
      }
    }
  }

  private async removeTraefikRoutes(serviceIds: string[]): Promise<void> {
    if (serviceIds.length === 0) return;

    const dynamicDir = this.config.get<string>('TRAEFIK_DYNAMIC_DIR', '/app/traefik-dynamic');
    const candidateDirs = [dynamicDir, path.join(dynamicDir, 'generated')];

    for (const serviceId of serviceIds) {
      const routeName = `paas-${serviceId.replace(/[^a-zA-Z0-9-]/g, '-')}.yml`;

      for (const dir of candidateDirs) {
        const filePath = path.join(dir, routeName);
        try {
          await fs.unlink(filePath);
        } catch (err: any) {
          if (err?.code !== 'ENOENT') {
            throw err;
          }
        }
      }
    }
  }
}
