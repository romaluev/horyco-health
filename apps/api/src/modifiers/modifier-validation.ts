import { ConflictError } from '../common/errors/domain-error';
import { Modifier, ModifierGroup, ModifierSelectionType } from './entities/modifier.entity';
import { ModifiersRepository } from './modifiers.repository';

/** Единый источник валидации модификаторов (корзина, офферы, checkout). */
export async function validateLineModifiers(
  repo: ModifiersRepository,
  businessId: string,
  menuItemId: string | null,
  comboId: string | null,
  modifierIds: string[],
  resolved: Modifier[],
): Promise<void> {
  if (modifierIds.length === 0) {
    if (menuItemId) {
      const groups = await repo.findGroupsForMenuItem(businessId, menuItemId);
      for (const g of groups) {
        if (g.isRequired) {
          throw new ConflictError(`Выберите: ${g.nameRu}`);
        }
      }
    }
    return;
  }

  if (resolved.length !== modifierIds.length) {
    throw new ConflictError('Один из модификаторов недоступен');
  }

  const groupIds = menuItemId
    ? await repo.getMenuItemGroupIds(businessId, menuItemId)
    : comboId
      ? await repo.getComboGroupIds(businessId, comboId)
      : [];

  const allowedGroupIds = new Set(groupIds);
  const byGroup = new Map<string, Modifier[]>();

  for (const mod of resolved) {
    if (!allowedGroupIds.has(mod.groupId)) {
      throw new ConflictError('Модификатор не относится к этому блюду');
    }
    const list = byGroup.get(mod.groupId) ?? [];
    list.push(mod);
    byGroup.set(mod.groupId, list);
  }

  const groups = await repo.findGroupsWithModifiers(
    businessId,
    [...byGroup.keys()],
  );
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  for (const [groupId, mods] of byGroup) {
    const group = groupMap.get(groupId);
    if (!group || !group.isActive) {
      throw new ConflictError('Группа модификаторов недоступна');
    }
    validateGroupSelection(group, mods);
  }

  if (menuItemId) {
    const attached = await repo.findGroupsForMenuItem(businessId, menuItemId);
    for (const g of attached) {
      if (g.isRequired && !byGroup.has(g.id)) {
        throw new ConflictError(`Выберите: ${g.nameRu}`);
      }
    }
  }
}

function validateGroupSelection(group: ModifierGroup, selected: Modifier[]): void {
  const count = selected.length;
  const min = group.isRequired ? Math.max(1, group.minSelect) : group.minSelect;
  if (count < min) {
    throw new ConflictError(`Выберите минимум ${min} в «${group.nameRu}»`);
  }
  const max = group.maxSelect ?? (group.selectionType === ModifierSelectionType.Single ? 1 : undefined);
  if (max != null && count > max) {
    throw new ConflictError(`Максимум ${max} в «${group.nameRu}»`);
  }
  if (group.selectionType === ModifierSelectionType.Single && count > 1) {
    throw new ConflictError(`Только один вариант в «${group.nameRu}»`);
  }
}

/** Проверяет, что все обязательные группы удовлетворены для набора modifierIds. */
export function countSelectionsPerGroup(
  modifiers: Modifier[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of modifiers) {
    counts.set(m.groupId, (counts.get(m.groupId) ?? 0) + 1);
  }
  return counts;
}
