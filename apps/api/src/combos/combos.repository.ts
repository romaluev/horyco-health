import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { TransactionalRepository } from '../common/database/transactional-repository';
import {
  Combo,
  ComboModifierGroup,
  ComboSlot,
  ComboSlotOption,
  ComboWithDetails,
} from './entities/combo.entity';
import { ConflictError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { MenuRepository } from '../menu/menu.repository';
import { ComboSlotSnapshot } from '../orders/pricing/line-pricing.types';

@Injectable()
export class CombosRepository extends TransactionalRepository<Combo> {
  protected readonly entity: EntityTarget<Combo> = Combo;

  constructor(
    txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly menu: MenuRepository,
  ) {
    super(txHost);
  }

  findActiveByBusiness(businessId: string): Promise<Combo[]> {
    return this.repo.find({
      where: { businessId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  findAllByBusiness(businessId: string): Promise<Combo[]> {
    return this.repo.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  findById(businessId: string, id: string): Promise<Combo | null> {
    return this.repo.findOne({ where: { id, businessId } });
  }

  async findByIdWithDetails(
    businessId: string,
    id: string,
    opts?: { activeOptionsOnly?: boolean },
  ): Promise<ComboWithDetails | null> {
    const combo = await this.findById(businessId, id);
    if (!combo) return null;

    const slotRepo = this.txHost.tx.getRepository(ComboSlot);
    const optRepo = this.txHost.tx.getRepository(ComboSlotOption);

    const slots = await slotRepo.find({
      where: { comboId: id },
      order: { sortOrder: 'ASC' },
    });

    const slotsWithOptions = await Promise.all(
      slots.map(async (slot) => {
        const options = await optRepo.find({
          where: { slotId: slot.id },
          relations: { menuItem: true },
          order: { sortOrder: 'ASC' },
        });
        const scoped = options.filter(
          (o) => o.menuItem?.businessId === businessId,
        );
        const filtered = opts?.activeOptionsOnly
          ? scoped.filter((o) => o.menuItem?.isActive)
          : scoped;
        return { ...slot, options: filtered };
      }),
    );

    return { ...combo, slots: slotsWithOptions };
  }

  save(data: Partial<Combo>): Promise<Combo> {
    return this.repo.save(this.repo.create(data));
  }

  async deleteCombo(businessId: string, id: string): Promise<void> {
    await this.repo.delete({ id, businessId });
  }

  async replaceSlots(
    businessId: string,
    comboId: string,
    slots: Array<{
      nameRu: string;
      nameUz: string;
      options: Array<{ menuItemId: string; priceOverride?: string; isDefault?: boolean }>;
    }>,
  ): Promise<void> {
    void businessId;
    const slotRepo = this.txHost.tx.getRepository(ComboSlot);
    await slotRepo.delete({ comboId });
    for (const [i, slot] of slots.entries()) {
      const savedSlot = await this.saveSlot(businessId, {
        comboId,
        nameRu: slot.nameRu,
        nameUz: slot.nameUz,
        sortOrder: i,
      });
      for (const [j, opt] of slot.options.entries()) {
        await this.saveOption(businessId, {
          slotId: savedSlot.id,
          menuItemId: opt.menuItemId,
          priceOverride: Money.fromMajor(opt.priceOverride ?? '0'),
          isDefault: opt.isDefault ?? j === 0,
          sortOrder: j,
        });
      }
    }
  }

  saveSlot(businessId: string, data: Partial<ComboSlot>): Promise<ComboSlot> {
    void businessId;
    const slotRepo = this.txHost.tx.getRepository(ComboSlot);
    return slotRepo.save(slotRepo.create(data));
  }

  async saveOption(businessId: string, data: Partial<ComboSlotOption>): Promise<ComboSlotOption> {
    if (!data.menuItemId) {
      throw new ConflictError('Блюдо слота не указано');
    }
    const menuItem = await this.menu.findById(businessId, data.menuItemId);
    if (!menuItem) {
      throw new ConflictError('Блюдо не найдено');
    }
    if (data.priceOverride?.isNegative()) {
      throw new ConflictError('Цена не может быть отрицательной');
    }
    const optRepo = this.txHost.tx.getRepository(ComboSlotOption);
    return optRepo.save(optRepo.create(data));
  }

  getComboGroupIds(businessId: string, comboId: string): Promise<string[]> {
    void businessId;
    const joinRepo = this.txHost.tx.getRepository(ComboModifierGroup);
    return joinRepo
      .find({ where: { comboId }, order: { sortOrder: 'ASC' } })
      .then((rows) => rows.map((r) => r.groupId));
  }

  async setComboGroups(businessId: string, comboId: string, groupIds: string[]): Promise<void> {
    const combo = await this.findById(businessId, comboId);
    if (!combo) {
      throw new ConflictError('Комбо не найдено');
    }
    const joinRepo = this.txHost.tx.getRepository(ComboModifierGroup);
    await joinRepo.delete({ comboId });
    if (groupIds.length === 0) return;
    await joinRepo.save(
      groupIds.map((groupId, i) => joinRepo.create({ comboId, groupId, sortOrder: i })),
    );
  }

  async resolveSlotSelections(
    businessId: string,
    combo: ComboWithDetails,
    selections: Record<string, string>,
  ): Promise<ComboSlotSnapshot[]> {
    const snapshots: ComboSlotSnapshot[] = [];

    for (const slot of combo.slots) {
      const selectedOptionId = selections[slot.id];
      let option: (typeof slot.options)[number] | undefined;
      if (selectedOptionId) {
        option = slot.options.find(
          (o) => o.menuItemId === selectedOptionId || o.id === selectedOptionId,
        );
        if (!option) {
          throw new ConflictError(`Неверный выбор в слоте «${slot.nameRu}»`);
        }
      } else {
        option = slot.options.find((o) => o.isDefault) ?? slot.options[0];
      }
      if (!option) {
        throw new ConflictError(`Слот «${slot.nameRu}» недоступен`);
      }

      const menuItem = option.menuItem ?? (await this.menu.findById(businessId, option.menuItemId));
      if (!menuItem || !menuItem.isActive) {
        throw new ConflictError(`Блюдо в слоте «${slot.nameRu}» недоступно`);
      }

      snapshots.push({
        slotId: slot.id,
        slotNameRu: slot.nameRu,
        slotNameUz: slot.nameUz,
        menuItemId: menuItem.id,
        itemNameRu: menuItem.nameRu,
        itemNameUz: menuItem.nameUz,
        surcharge: option.priceOverride.toString(),
        modifierIds: [],
        modifiers: [],
      });
    }

    return snapshots;
  }
}
