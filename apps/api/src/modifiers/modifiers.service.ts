import { Injectable } from '@nestjs/common';
import { ActorContextService } from '../common/cls/actor-context.service';
import { DefaultBusinessService } from '../businesses/default-business.service';
import { NotFoundError } from '../common/errors/domain-error';
import { Money } from '../common/money/money';
import { ModifiersRepository } from './modifiers.repository';
import { Modifier, ModifierGroup } from './entities/modifier.entity';
import { CreateModifierGroupDto, CreateModifierDto, UpdateModifierGroupDto } from './dto/modifier.dto';

@Injectable()
export class ModifiersService {
  constructor(
    private readonly repo: ModifiersRepository,
    private readonly actorCtx: ActorContextService,
    private readonly defaultBusiness: DefaultBusinessService,
  ) {}

  private async businessId(): Promise<string> {
    return this.actorCtx.get()?.businessId ?? this.defaultBusiness.getId();
  }

  async listGroups(): Promise<Array<ModifierGroup & { modifiers: Modifier[] }>> {
    const businessId = await this.businessId();
    const groups = await this.repo.findGroupsByBusiness(businessId);
    return Promise.all(
      groups.map(async (g) => ({
        ...g,
        modifiers: await this.repo.findModifiersByGroup(businessId, g.id),
      })),
    );
  }

  async createGroup(dto: CreateModifierGroupDto): Promise<ModifierGroup> {
    return this.repo.save({ ...dto, businessId: await this.businessId() });
  }

  async updateGroup(id: string, dto: UpdateModifierGroupDto): Promise<ModifierGroup> {
    const businessId = await this.businessId();
    const group = await this.repo.findGroupById(businessId, id);
    if (!group) throw new NotFoundError('Группа не найдена');
    Object.assign(group, dto);
    return this.repo.save(group);
  }

  async deleteGroup(id: string): Promise<void> {
    await this.repo.deleteGroup(await this.businessId(), id);
  }

  async createModifier(groupId: string, dto: CreateModifierDto): Promise<Modifier> {
    const businessId = await this.businessId();
    const group = await this.repo.findGroupById(businessId, groupId);
    if (!group) throw new NotFoundError('Группа не найдена');
    return this.repo.saveModifier(businessId, {
      groupId,
      nameRu: dto.nameRu,
      nameUz: dto.nameUz,
      priceDelta: Money.fromMajor(dto.priceDelta ?? '0'),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async updateModifier(groupId: string, id: string, dto: Partial<CreateModifierDto>): Promise<Modifier> {
    const businessId = await this.businessId();
    const mod = await this.repo.findModifierById(businessId, groupId, id);
    if (!mod) throw new NotFoundError('Модификатор не найден');
    if (dto.nameRu != null) mod.nameRu = dto.nameRu;
    if (dto.nameUz != null) mod.nameUz = dto.nameUz;
    if (dto.priceDelta != null) mod.priceDelta = Money.fromMajor(dto.priceDelta);
    if (dto.isActive != null) mod.isActive = dto.isActive;
    if (dto.sortOrder != null) mod.sortOrder = dto.sortOrder;
    return this.repo.saveModifier(businessId, mod);
  }

  async deleteModifier(groupId: string, id: string): Promise<void> {
    await this.repo.deleteModifier(await this.businessId(), groupId, id);
  }

  async getGroupsForMenuItem(menuItemId: string) {
    const businessId = await this.businessId();
    const groups = await this.repo.findGroupsForMenuItem(businessId, menuItemId);
    return Promise.all(
      groups.map(async (g) => ({
        ...g,
        modifiers: (await this.repo.findModifiersByGroup(businessId, g.id)).filter(
          (m) => m.isActive,
        ),
      })),
    );
  }

  async getGroupsForCombo(comboId: string) {
    const businessId = await this.businessId();
    const groupIds = await this.repo.getComboGroupIds(businessId, comboId);
    if (groupIds.length === 0) return [];
    const groups = await this.repo.findGroupsWithModifiers(businessId, groupIds);
    return Promise.all(
      groups.map(async (g) => ({
        ...g,
        modifiers: (await this.repo.findModifiersByGroup(businessId, g.id)).filter(
          (m) => m.isActive,
        ),
      })),
    );
  }

  async setMenuItemGroups(menuItemId: string, groupIds: string[]): Promise<void> {
    await this.repo.setMenuItemGroups(await this.businessId(), menuItemId, groupIds);
  }

  async hasRequiredModifiers(menuItemId: string): Promise<boolean> {
    return this.repo.hasRequiredModifiers(await this.businessId(), menuItemId);
  }

  async requiredModifierMenuItemIds(): Promise<Set<string>> {
    return this.repo.findMenuItemIdsWithRequiredModifiers(await this.businessId());
  }
}
