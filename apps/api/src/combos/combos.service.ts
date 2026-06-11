import { Injectable } from '@nestjs/common';
import { ActorContextService } from '../common/cls/actor-context.service';
import { NotFoundError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { CombosRepository } from './combos.repository';
import { Combo, ComboWithDetails } from './entities/combo.entity';
import { CreateComboDto, UpdateComboDto } from './dto/combo.dto';

@Injectable()
export class CombosService {
  constructor(
    private readonly repo: CombosRepository,
    private readonly actorCtx: ActorContextService,
  ) {}

  private businessId(): string {
    return this.actorCtx.getOrThrow().businessId;
  }

  listActive(): Promise<Combo[]> {
    return this.repo.findActiveByBusiness(this.businessId());
  }

  async getOne(id: string): Promise<ComboWithDetails> {
    const combo = await this.repo.findByIdWithDetails(this.businessId(), id);
    if (!combo || !combo.isActive) throw new NotFoundError('Комбо не найдено');
    return combo;
  }

  async adminGetOne(id: string): Promise<ComboWithDetails & { modifierGroupIds: string[] }> {
    const combo = await this.repo.findByIdWithDetails(this.businessId(), id);
    if (!combo) throw new NotFoundError('Комбо не найдено');
    const modifierGroupIds = await this.repo.getComboGroupIds(this.businessId(), id);
    return { ...combo, modifierGroupIds };
  }

  async create(dto: CreateComboDto): Promise<Combo> {
    const combo = await this.repo.save({
      businessId: this.businessId(),
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
      const savedSlot = await this.repo.saveSlot(this.businessId(), {
        comboId: combo.id,
        nameRu: slot.nameRu,
        nameUz: slot.nameUz,
        sortOrder: i,
      });
      for (const [j, opt] of slot.options.entries()) {
        await this.repo.saveOption(this.businessId(), {
          slotId: savedSlot.id,
          menuItemId: opt.menuItemId,
          priceOverride: Money.fromMajor(opt.priceOverride ?? '0'),
          isDefault: opt.isDefault ?? j === 0,
          sortOrder: j,
        });
      }
    }
    if (dto.modifierGroupIds?.length) {
      await this.repo.setComboGroups(this.businessId(), combo.id, dto.modifierGroupIds);
    }
    return combo;
  }

  async update(id: string, dto: UpdateComboDto): Promise<Combo> {
    const businessId = this.businessId();
    const combo = await this.repo.findById(businessId, id);
    if (!combo) throw new NotFoundError('Комбо не найдено');
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
    return this.repo.findAllByBusiness(this.businessId());
  }
}
