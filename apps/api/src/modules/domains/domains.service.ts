import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Domain } from './entities/domain.entity';
import { DomainStatus } from '@paas/shared';

@Injectable()
export class DomainsService {
  constructor(
    @InjectRepository(Domain) private readonly repo: Repository<Domain>,
    private readonly config: ConfigService,
  ) {}

  async provisionDefault(serviceId: string, projectSlug: string, serviceName: string): Promise<Domain> {
    const baseDomain = this.config.get<string>('DOMAIN', 'localhost');
    const hostname = `${serviceName}-${projectSlug}.${baseDomain}`;

    const existing = await this.repo.findOne({ where: { serviceId, isCustom: false } });
    if (existing) return existing;

    const domain = this.repo.create({
      serviceId,
      hostname,
      isCustom: false,
      status: DomainStatus.ACTIVE,
      sslEnabled: baseDomain !== 'localhost',
    });

    return this.repo.save(domain);
  }

  async addCustomDomain(serviceId: string, hostname: string): Promise<Domain> {
    const existing = await this.repo.findOne({ where: { hostname } });
    if (existing) throw new ConflictException(`Domain ${hostname} is already in use`);

    const domain = this.repo.create({
      serviceId,
      hostname,
      isCustom: true,
      status: DomainStatus.PENDING,
    });

    return this.repo.save(domain);
  }

  async findByService(serviceId: string): Promise<Domain[]> {
    return this.repo.find({ where: { serviceId }, order: { isCustom: 'ASC' } });
  }

  async remove(serviceId: string, domainId: string): Promise<void> {
    const domain = await this.repo.findOne({ where: { id: domainId, serviceId } });
    if (!domain) throw new NotFoundException('Domain not found');
    if (!domain.isCustom) throw new ConflictException('Cannot remove the auto-generated domain');
    await this.repo.remove(domain);
  }

  async updateStatus(id: string, status: DomainStatus): Promise<void> {
    await this.repo.update(id, { status });
  }
}
