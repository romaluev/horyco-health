import {
  ModifierGroupKind,
  ModifierPricingType,
  ModifierSelectionType,
} from '../../modifiers/entities/modifier.entity';
import { ModifierGroupKey } from './seed-helpers';

export interface ModifierOptionSeed {
  nameRu: string;
  nameUz: string;
  priceDelta: string;
  sortOrder: number;
}

export interface ModifierGroupSeed {
  key: ModifierGroupKey;
  nameRu: string;
  nameUz: string;
  selectionType: ModifierSelectionType;
  isRequired: boolean;
  pricingType: ModifierPricingType;
  kind: ModifierGroupKind;
  sortOrder: number;
  options: ModifierOptionSeed[];
}

export const MODIFIER_GROUP_SEEDS: ModifierGroupSeed[] = [
  {
    key: 'portionSize',
    nameRu: 'Размер порции',
    nameUz: 'Размер порции',
    selectionType: ModifierSelectionType.Single,
    isRequired: true,
    pricingType: ModifierPricingType.Paid,
    kind: ModifierGroupKind.Modifier,
    sortOrder: 0,
    options: [
      { nameRu: 'Стандарт', nameUz: 'Стандарт', priceDelta: '0', sortOrder: 0 },
      { nameRu: 'Большая', nameUz: 'Большая', priceDelta: '15000', sortOrder: 1 },
    ],
  },
  {
    key: 'portionWeight',
    nameRu: 'Вес порции',
    nameUz: 'Вес порции',
    selectionType: ModifierSelectionType.Single,
    isRequired: true,
    pricingType: ModifierPricingType.Free,
    kind: ModifierGroupKind.Modifier,
    sortOrder: 1,
    options: [
      { nameRu: '300 г', nameUz: '300 г', priceDelta: '0', sortOrder: 0 },
      { nameRu: '400 г', nameUz: '400 г', priceDelta: '0', sortOrder: 1 },
      { nameRu: '500 г', nameUz: '500 г', priceDelta: '0', sortOrder: 2 },
    ],
  },
  {
    key: 'meatType',
    nameRu: 'Тип мяса',
    nameUz: 'Тип мяса',
    selectionType: ModifierSelectionType.Single,
    isRequired: true,
    pricingType: ModifierPricingType.Free,
    kind: ModifierGroupKind.Modifier,
    sortOrder: 2,
    options: [
      { nameRu: 'Индейка', nameUz: 'Индейка', priceDelta: '0', sortOrder: 0 },
      { nameRu: 'Курица', nameUz: 'Курица', priceDelta: '0', sortOrder: 1 },
      { nameRu: 'Говядина', nameUz: 'Говядина', priceDelta: '5000', sortOrder: 2 },
    ],
  },
];
