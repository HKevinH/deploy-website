import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { ProjectsService } from '../projects/projects.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';
import { ServiceStatus } from '@paas/shared';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service) private readonly repo: Repository<Service>,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(projectId: string, ownerId: string, dto: CreateServiceDto): Promise<Service> {
    // Verify project ownership
    await this.projectsService.findOne(projectId, ownerId);

    const service = this.repo.create({
      ...dto,
      projectId,
      gitBranch: dto.gitBranch ?? 'main',
      dockerfilePath: dto.dockerfilePath ?? 'Dockerfile',
      dockerContext: dto.dockerContext ?? '.',
      port: dto.port ?? 3000,
      autoDeploy: dto.autoDeploy ?? false,
    });

    return this.repo.save(service);
  }

  async findAllByProject(projectId: string, ownerId: string): Promise<Service[]> {
    await this.projectsService.findOne(projectId, ownerId);

    return this.repo.find({
      where: { projectId },
      relations: ['activeDeployment', 'domains'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, ownerId: string): Promise<Service> {
    const service = await this.repo.findOne({
      where: { id },
      relations: ['project', 'activeDeployment', 'domains', 'environmentVars'],
    });

    if (!service?.project) throw new NotFoundException('Service not found');
    if (service.project.ownerId !== ownerId) throw new ForbiddenException();

    return service;
  }

  async findById(id: string): Promise<Service> {
    const service = await this.repo.findOne({
      where: { id },
      relations: ['project'],
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async update(id: string, ownerId: string, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.findOne(id, ownerId);
    Object.assign(service, dto);
    return this.repo.save(service);
  }

  async updateStatus(id: string, status: ServiceStatus): Promise<void> {
    await this.repo.update(id, { status });
  }

  async updateActiveDeployment(serviceId: string, deploymentId: string): Promise<void> {
    await this.repo.update(serviceId, { activeDeploymentId: deploymentId });
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const service = await this.findOne(id, ownerId);
    await this.repo.remove(service);
  }
}
