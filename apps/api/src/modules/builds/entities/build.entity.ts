import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BuildStatus } from '@paas/shared';
import { Service } from '../../services/entities/service.entity';

@Entity('builds')
export class Build {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'service_id' })
  serviceId: string;

  @Column({ name: 'commit_sha', length: 40 })
  commitSha: string;

  @Column({ nullable: true, name: 'commit_message', type: 'text' })
  commitMessage: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'commit_author' })
  commitAuthor: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'branch' })
  branch: string | null;

  @Column({ type: 'enum', enum: BuildStatus, default: BuildStatus.PENDING })
  status: BuildStatus;

  @Column({ type: 'varchar', nullable: true, name: 'image_name' })
  imageName: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'image_tag' })
  imageTag: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'log_path' })
  logPath: string | null;

  @Column({ nullable: true, name: 'error_message', type: 'text' })
  errorMessage: string | null;

  @Column({ nullable: true, name: 'duration_seconds', type: 'int' })
  durationSeconds: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
