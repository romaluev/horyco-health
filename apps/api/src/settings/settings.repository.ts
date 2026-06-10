import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { TransactionalRepository } from '../common/database/transactional-repository';
import { AppSetting } from './entities/app-setting.entity';

@Injectable()
export class SettingsRepository extends TransactionalRepository<AppSetting> {
  protected readonly entity: EntityTarget<AppSetting> = AppSetting;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  findAll(): Promise<AppSetting[]> {
    return this.repo.find();
  }

  get(key: string): Promise<AppSetting | null> {
    return this.repo.findOne({ where: { key } });
  }

  /** Upsert по ключу (save обновляет updatedAt и вставляет при отсутствии). */
  async set(key: string, value: string): Promise<void> {
    await this.repo.save(this.repo.create({ key, value }));
  }
}
