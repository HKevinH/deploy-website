import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Service } from '../../services/entities/service.entity';

@Entity('environment_vars')
export class EnvironmentVar {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Service, (s) => s.environmentVars, { onDelete: 'CASCADE' })
  service: Service;

  @Column({ name: 'service_id' })
  serviceId: string;

  @Column({ length: 255 })
  key: string;

  @Column({ type: 'text', name: 'encrypted_value' })
  encryptedValue: string;

  @Column({ default: false, name: 'is_secret' })
  isSecret: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
