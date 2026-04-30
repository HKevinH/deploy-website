import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DomainStatus } from '@paas/shared';
import { Service } from '../../services/entities/service.entity';

@Entity('domains')
export class Domain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Service, (s) => s.domains, { onDelete: 'CASCADE' })
  service: Service;

  @Column({ name: 'service_id' })
  serviceId: string;

  @Column({ unique: true })
  hostname: string;

  @Column({ name: 'is_custom', default: false })
  isCustom: boolean;

  @Column({ type: 'enum', enum: DomainStatus, default: DomainStatus.PENDING })
  status: DomainStatus;

  @Column({ name: 'ssl_enabled', default: false })
  sslEnabled: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'ssl_expires_at' })
  sslExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
