import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';
import { Project } from './entities/project.entity';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly repo: Repository<Project>,
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
    await this.repo.remove(project);
  }
}
