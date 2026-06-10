import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Базовая сущность: uuid-PK (неперечислимый — снижает enumeration/IDOR) + аудит-поля.
 * SnakeNamingStrategy маппит created_at/updated_at автоматически.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
