import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeploymentStatus } from '@paas/shared';
import { Service } from '../../services/entities/service.entity';
import { Build } from '../../builds/entities/build.entity';

@Entity('deployments')
export class Deployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  version: number;

  @ManyToOne(() => Service, (s) => s.deployments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'service_id' })
  serviceId: string;

  @ManyToOne(() => Build, { eager: true })
  @JoinColumn({ name: 'build_id' })
  build: Build;

  @Column({ name: 'build_id' })
  buildId: string;

  @Column({ type: 'enum', enum: DeploymentStatus, default: DeploymentStatus.PENDING })
  status: DeploymentStatus;

  @Column({ type: 'varchar', nullable: true, name: 'container_id' })
  containerId: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'container_name' })
  containerName: string | null;

  @Column({ nullable: true, name: 'error_message', type: 'text' })
  errorMessage: string | null;

  @Column({ nullable: true, name: 'duration_seconds', type: 'int' })
  durationSeconds: number | null;

  @Column({ type: 'uuid', nullable: true, name: 'deployed_by' })
  deployedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
