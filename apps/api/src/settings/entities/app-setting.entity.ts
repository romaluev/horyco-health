import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Настройки приложения key/value (контакты пополнения, назначение «Поддержки» и т.п.).
 * Ключ — первичный, отдельный uuid не нужен.
 */
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar' })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
