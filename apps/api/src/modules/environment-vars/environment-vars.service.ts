import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvironmentVar } from './entities/environment-var.entity';
import { CryptoService } from '../../infrastructure/crypto/crypto.service';

export interface UpsertEnvVarsDto {
  vars: Array<{ key: string; value: string; isSecret?: boolean }>;
}

@Injectable()
export class EnvironmentVarsService {
  constructor(
    @InjectRepository(EnvironmentVar) private readonly repo: Repository<EnvironmentVar>,
    private readonly crypto: CryptoService,
  ) {}

  async upsert(serviceId: string, dto: UpsertEnvVarsDto): Promise<EnvironmentVar[]> {
    const results: EnvironmentVar[] = [];

    for (const { key, value, isSecret } of dto.vars) {
      const encryptedValue = this.crypto.encrypt(value);
      const existing = await this.repo.findOne({ where: { serviceId, key } });

      if (existing) {
        existing.encryptedValue = encryptedValue;
        existing.isSecret = isSecret ?? existing.isSecret;
        results.push(await this.repo.save(existing));
      } else {
        const envVar = this.repo.create({ serviceId, key, encryptedValue, isSecret: isSecret ?? false });
        results.push(await this.repo.save(envVar));
      }
    }

    return results;
  }

  async findAll(serviceId: string): Promise<Array<{ id: string; key: string; isSecret: boolean }>> {
    const vars = await this.repo.find({ where: { serviceId }, order: { key: 'ASC' } });
    return vars.map((v) => ({ id: v.id, key: v.key, isSecret: v.isSecret }));
  }

  async getDecryptedVars(serviceId: string): Promise<Record<string, string>> {
    const vars = await this.repo.find({ where: { serviceId } });
    return vars.reduce<Record<string, string>>((acc, v) => {
      acc[v.key] = this.crypto.decrypt(v.encryptedValue);
      return acc;
    }, {});
  }

  async remove(serviceId: string, key: string): Promise<void> {
    const envVar = await this.repo.findOne({ where: { serviceId, key } });
    if (!envVar) throw new NotFoundException(`Variable '${key}' not found`);
    await this.repo.remove(envVar);
  }
}
