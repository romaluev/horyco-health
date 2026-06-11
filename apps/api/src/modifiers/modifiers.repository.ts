import { Injectable } from '@nestjs/common';
import { EntityTarget, In } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { TransactionalRepository } from '../common/database/transactional-repository';
import { ComboModifierGroup } from '../combos/entities/combo.entity';
import { Modifier, ModifierGroup, MenuItemModifierGroup } from './entities/modifier.entity';

@Injectable()
export class ModifiersRepository extends TransactionalRepository<ModifierGroup> {
  protected readonly entity: EntityTarget<ModifierGroup> = ModifierGroup;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  findGroupsByBusiness(businessId: string): Promise<ModifierGroup[]> {
    return this.repo.find({
      where: { businessId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  findGroupById(businessId: string, id: string): Promise<ModifierGroup | null> {
    return this.repo.findOne({ where: { id, businessId } });
  }

  save(data: Partial<ModifierGroup>): Promise<ModifierGroup> {
    return this.repo.save(this.repo.create(data));
  }

  async deleteGroup(businessId: string, id: string): Promise<void> {
    await this.repo.delete({ id, businessId });
  }

  findModifiersByGroup(businessId: string, groupId: string): Promise<Modifier[]> {
    void businessId;
    const modRepo = this.txHost.tx.getRepository(Modifier);
    return modRepo.find({ where: { groupId }, order: { sortOrder: 'ASC' } });
  }

  findModifierById(businessId: string, groupId: string, id: string): Promise<Modifier | null> {
    void businessId;
    const modRepo = this.txHost.tx.getRepository(Modifier);
    return modRepo.findOne({ where: { id, groupId } });
  }

  saveModifier(businessId: string, data: Partial<Modifier>): Promise<Modifier> {
    void businessId;
    const modRepo = this.txHost.tx.getRepository(Modifier);
    return modRepo.save(modRepo.create(data));
  }

  async deleteModifier(businessId: string, groupId: string, id: string): Promise<void> {
    void businessId;
    const modRepo = this.txHost.tx.getRepository(Modifier);
    await modRepo.delete({ id, groupId });
  }

  findByIds(businessId: string, ids: string[]): Promise<Modifier[]> {
    if (ids.length === 0) return Promise.resolve([]);
    const modRepo = this.txHost.tx.getRepository(Modifier);
    return modRepo
      .createQueryBuilder('m')
      .innerJoin(ModifierGroup, 'g', 'g.id = m.group_id')
      .where('m.id IN (:...ids)', { ids })
      .andWhere('g.business_id = :businessId', { businessId })
      .andWhere('m.is_active = true')
      .andWhere('g.is_active = true')
      .getMany();
  }

  findGroupsForMenuItem(businessId: string, menuItemId: string): Promise<ModifierGroup[]> {
    return this.repo
      .createQueryBuilder('g')
      .innerJoin(MenuItemModifierGroup, 'j', 'j.group_id = g.id')
      .where('j.menu_item_id = :menuItemId', { menuItemId })
      .andWhere('g.business_id = :businessId', { businessId })
      .andWhere('g.is_active = true')
      .orderBy('j.sort_order', 'ASC')
      .getMany();
  }

  async hasRequiredModifiers(businessId: string, menuItemId: string): Promise<boolean> {
    const groups = await this.findGroupsForMenuItem(businessId, menuItemId);
    return groups.some((g) => g.isRequired);
  }

  async findMenuItemIdsWithRequiredModifiers(businessId: string): Promise<Set<string>> {
    const rows: { menu_item_id: string }[] = await this.txHost.tx.query(
      `SELECT DISTINCT j.menu_item_id
       FROM menu_item_modifier_groups j
       INNER JOIN modifier_groups g ON g.id = j.group_id
       WHERE g.business_id = $1 AND g.is_required = true AND g.is_active = true`,
      [businessId],
    );
    return new Set(rows.map((r) => r.menu_item_id));
  }

  getMenuItemGroupIds(businessId: string, menuItemId: string): Promise<string[]> {
    void businessId;
    const joinRepo = this.txHost.tx.getRepository(MenuItemModifierGroup);
    return joinRepo
      .find({ where: { menuItemId }, order: { sortOrder: 'ASC' } })
      .then((rows) => rows.map((r) => r.groupId));
  }

  async setMenuItemGroups(businessId: string, menuItemId: string, groupIds: string[]): Promise<void> {
    void businessId;
    const joinRepo = this.txHost.tx.getRepository(MenuItemModifierGroup);
    await joinRepo.delete({ menuItemId });
    if (groupIds.length === 0) return;
    await joinRepo.save(
      groupIds.map((groupId, i) => joinRepo.create({ menuItemId, groupId, sortOrder: i })),
    );
  }

  findGroupsWithModifiers(businessId: string, groupIds: string[]): Promise<ModifierGroup[]> {
    if (groupIds.length === 0) return Promise.resolve([]);
    return this.repo.find({
      where: { businessId, id: In(groupIds), isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  getComboGroupIds(businessId: string, comboId: string): Promise<string[]> {
    void businessId;
    const joinRepo = this.txHost.tx.getRepository(ComboModifierGroup);
    return joinRepo
      .find({ where: { comboId }, order: { sortOrder: 'ASC' } })
      .then((rows) => rows.map((r) => r.groupId));
  }
}
