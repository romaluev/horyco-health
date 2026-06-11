import { Injectable } from '@nestjs/common';
import { ActorContextService } from '../common/cls/actor-context.service';
import { DefaultBusinessService } from '../businesses/default-business.service';
import { ConflictError, NotFoundError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { ModifiersRepository } from '../modifiers/modifiers.repository';
import { CombosRepository } from './combos.repository';
import { Combo, ComboWithDetails } from './entities/combo.entity';
import { ComboSlotDto, CreateComboDto, UpdateComboDto } from './dto/combo.dto';

@Injectable()
export class CombosService {
  constructor(
    private readonly repo: CombosRepository,
    private readonly modifiers: ModifiersRepository,
    private readonly actorCtx: ActorContextService,
    private readonly defaultBusiness: DefaultBusinessService,
  ) {}

  private async bizId(): Promise<string> {
    return this.actorCtx.get()?.businessId ?? this.defaultBusiness.getId();
  }

  listActive(): Promise<Combo[]> {
    return this.bizId().then((id) => this.repo.findActiveByBusiness(id));
  }

  async getOne(id: string): Promise<ComboWithDetails> {
    const businessId = await this.bizId();
    const combo = await this.repo.findByIdWithDetails(businessId, id, {
      activeOptionsOnly: true,
    });
    if (!combo || !combo.isActive) throw new NotFoundError('Комбо не найдено');
    return combo;
  }

  async adminGetOne(id: string): Promise<ComboWithDetails & { modifierGroupIds: string[] }> {
    const businessId = await this.bizId();
    const combo = await this.repo.findByIdWithDetails(businessId, id);
    if (!combo) throw new NotFoundError('Комбо не найдено');
    const modifierGroupIds = await this.repo.getComboGroupIds(businessId, id);
    return { ...combo, modifierGroupIds };
  }

  async create(dto: CreateComboDto): Promise<Combo> {
    const businessId = await this.bizId();
    if (dto.slots?.length) {
      this.validateSlots(dto.slots);
    }
    if (dto.modifierGroupIds?.length) {
      await this.validateModifierGroupIds(businessId, dto.modifierGroupIds);
    }
    const combo = await this.repo.save({
      businessId,
      nameRu: dto.nameRu,
      nameUz: dto.nameUz,
      descriptionRu: dto.descriptionRu ?? null,
      descriptionUz: dto.descriptionUz ?? null,
      price: Money.fromMajor(dto.price),
      originalPrice: dto.originalPrice != null ? Money.fromMajor(dto.originalPrice) : null,
      photoFileId: dto.photoFileId ?? null,
      photoUrl: dto.photoUrl ?? null,
      orderDeadline: dto.orderDeadline ?? null,
      days: dto.days ?? [],
      isActive: dto.isActive ?? true,
    });
    for (const [i, slot] of (dto.slots ?? []).entries()) {
      const savedSlot = await this.repo.saveSlot(businessId, {
        comboId: combo.id,
        nameRu: slot.nameRu,
        nameUz: slot.nameUz,
        sortOrder: i,
      });
      for (const [j, opt] of slot.options.entries()) {
        await this.repo.saveOption(businessId, {
          slotId: savedSlot.id,
          menuItemId: opt.menuItemId,
          priceOverride: Money.fromMajor(opt.priceOverride ?? '0'),
          isDefault: opt.isDefault ?? j === 0,
          sortOrder: j,
        });
      }
    }
    if (dto.modifierGroupIds?.length) {
      await this.repo.setComboGroups(businessId, combo.id, dto.modifierGroupIds);
    }
    return combo;
  }

  async update(id: string, dto: UpdateComboDto): Promise<Combo> {
    const businessId = await this.bizId();
    const combo = await this.repo.findById(businessId, id);
    if (!combo) throw new NotFoundError('Комбо не найдено');
    if (dto.slots != null) {
      this.validateSlots(dto.slots);
    }
    if (dto.modifierGroupIds != null && dto.modifierGroupIds.length > 0) {
      await this.validateModifierGroupIds(businessId, dto.modifierGroupIds);
    }
    if (dto.nameRu != null) combo.nameRu = dto.nameRu;
    if (dto.nameUz != null) combo.nameUz = dto.nameUz;
    if (dto.descriptionRu !== undefined) combo.descriptionRu = dto.descriptionRu;
    if (dto.descriptionUz !== undefined) combo.descriptionUz = dto.descriptionUz;
    if (dto.price != null) combo.price = Money.fromMajor(dto.price);
    if (dto.originalPrice !== undefined) {
      combo.originalPrice = dto.originalPrice != null ? Money.fromMajor(dto.originalPrice) : null;
    }
    if (dto.photoUrl !== undefined) combo.photoUrl = dto.photoUrl;
    if (dto.isActive != null) combo.isActive = dto.isActive;
    if (dto.days != null) combo.days = dto.days;
    const saved = await this.repo.save(combo);
    if (dto.slots != null) {
      await this.repo.replaceSlots(businessId, id, dto.slots);
    }
    if (dto.modifierGroupIds != null) {
      await this.repo.setComboGroups(businessId, id, dto.modifierGroupIds);
    }
    return saved;
  }

  adminList(): Promise<Combo[]> {
    return this.bizId().then((id) => this.repo.findAllByBusiness(id));
  }

  private validateSlots(slots: ComboSlotDto[]): void {
    for (const slot of slots) {
      const explicitDefaults = slot.options.filter((o) => o.isDefault);
      if (explicitDefaults.length > 1) {
        throw new ConflictError(`Слот «${slot.nameRu}»: только один вариант по умолчанию`);
      }
      for (const opt of slot.options) {
        if (opt.priceOverride != null && Number(opt.priceOverride) < 0) {
          throw new ConflictError('Цена не может быть отрицательной');
        }
      }
    }
  }

  private async validateModifierGroupIds(businessId: string, groupIds: string[]): Promise<void> {
    for (const groupId of groupIds) {
      const group = await this.modifiers.findGroupById(businessId, groupId);
      if (!group) {
        throw new NotFoundError('Группа модификаторов не найдена');
      }
    }
  }
}
