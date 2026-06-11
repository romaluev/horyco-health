import { ConflictError } from '../common/errors/domain-error';
import { Modifier, ModifierGroup, ModifierSelectionType } from './entities/modifier.entity';
import { ModifiersRepository } from './modifiers.repository';

async function attachedGroups(
  repo: ModifiersRepository,
  businessId: string,
  menuItemId: string | null,
  comboId: string | null,
): Promise<ModifierGroup[]> {
  if (menuItemId) {
    return repo.findGroupsForMenuItem(businessId, menuItemId);
  }
  if (comboId) {
    const groupIds = await repo.getComboGroupIds(businessId, comboId);
    if (groupIds.length === 0) return [];
    return repo.findGroupsWithModifiers(businessId, groupIds);
  }
  return [];
}

/** Единый источник валидации модификаторов (корзина, офферы, checkout). */
export async function validateLineModifiers(
  repo: ModifiersRepository,
  businessId: string,
  menuItemId: string | null,
  comboId: string | null,
  modifierIds: string[],
  resolved: Modifier[],
): Promise<void> {
  const attached = await attachedGroups(repo, businessId, menuItemId, comboId);

  if (modifierIds.length === 0) {
    for (const g of attached) {
      validateGroupSelection(g, []);
    }
    return;
  }

  if (resolved.length !== modifierIds.length) {
    throw new ConflictError('Один из модификаторов недоступен');
  }

  const allowedGroupIds = new Set(attached.map((g) => g.id));
  const byGroup = new Map<string, Modifier[]>();

  for (const mod of resolved) {
    if (!allowedGroupIds.has(mod.groupId)) {
      throw new ConflictError('Модификатор не относится к этому блюду');
    }
    const list = byGroup.get(mod.groupId) ?? [];
    list.push(mod);
    byGroup.set(mod.groupId, list);
  }

  for (const g of attached) {
    validateGroupSelection(g, byGroup.get(g.id) ?? []);
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
