import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ServiceStatus, GitProvider } from '@paas/shared';
import { Project } from '../../projects/entities/project.entity';
import { Deployment } from '../../deployments/entities/deployment.entity';
import { EnvironmentVar } from '../../environment-vars/entities/environment-var.entity';
import { Domain } from '../../domains/entities/domain.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @ManyToOne(() => Project, (p) => p.services, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  // ─── Git Source ─────────────────────────────────────────────────────────────

  @Column({ type: 'text', nullable: true, name: 'git_url' })
  gitUrl: string | null;

  @Column({ nullable: true, name: 'git_branch', default: 'main' })
  gitBranch: string;

  @Column({ nullable: true, name: 'git_provider', type: 'enum', enum: GitProvider })
  gitProvider: GitProvider | null;

  @Column({ type: 'varchar', nullable: true, name: 'git_repo_id' })
  gitRepoId: string | null;

  // ─── Build Config ────────────────────────────────────────────────────────────

  @Column({ nullable: true, name: 'dockerfile_path', default: 'Dockerfile' })
  dockerfilePath: string;

  @Column({ nullable: true, name: 'docker_context', default: '.' })
  dockerContext: string;

  @Column({ nullable: true, name: 'build_args', type: 'jsonb' })
  buildArgs: Record<string, string> | null;

  @Column({ name: 'auto_deploy', default: false })
  autoDeploy: boolean;

  // ─── Runtime Config ──────────────────────────────────────────────────────────

  @Column({ type: 'int', default: 3000 })
  port: number;

  @Column({ type: 'int', default: 1 })
  replicas: number;

  @Column({ type: 'int', nullable: true, name: 'memory_limit_mb' })
  memoryLimitMb: number | null;

  @Column({ type: 'float', nullable: true, name: 'cpu_limit' })
  cpuLimit: number | null;

  @Column({ type: 'varchar', nullable: true, name: 'health_check_path', default: '/health' })
  healthCheckPath: string | null;

  // ─── Status ──────────────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: ServiceStatus, default: ServiceStatus.IDLE })
  status: ServiceStatus;

  @OneToOne(() => Deployment, { nullable: true, eager: false })
  @JoinColumn({ name: 'active_deployment_id' })
  activeDeployment: Deployment | null;

  @Column({ type: 'uuid', nullable: true, name: 'active_deployment_id' })
  activeDeploymentId: string | null;

  // ─── Relations ───────────────────────────────────────────────────────────────

  @OneToMany(() => Deployment, (d) => d.service, { cascade: false })
  deployments: Deployment[];

  @OneToMany(() => EnvironmentVar, (e) => e.service, { cascade: true })
  environmentVars: EnvironmentVar[];

  @OneToMany(() => Domain, (d) => d.service, { cascade: true })
  domains: Domain[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
