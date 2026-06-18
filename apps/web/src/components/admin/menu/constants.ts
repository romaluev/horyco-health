import { Category } from '@eatfit/shared';
import type { I18nKey } from '@/lib/i18n';

export const CATS: { cat: Category; key: I18nKey }[] = [
  { cat: Category.Main, key: 'cat_main' },
  { cat: Category.Drink, key: 'cat_drink' },
  { cat: Category.Dessert, key: 'cat_dessert' },
];

export const DAY_KEYS: I18nKey[] = [
  'day_1',
  'day_2',
  'day_3',
  'day_4',
  'day_5',
  'day_6',
  'day_7',
];
