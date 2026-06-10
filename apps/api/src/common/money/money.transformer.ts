import { ValueTransformer } from 'typeorm';
import { Money } from './money';

/**
 * TypeORM-трансформер для денежных колонок numeric(12,2).
 * БД отдаёт numeric как СТРОКУ — маппим в Money VO, а не в number.
 */
export const moneyTransformer: ValueTransformer = {
  to: (value?: Money | null): string | null => (value ? value.toString() : null),
  from: (value?: string | null): Money | null =>
    value === null || value === undefined ? null : Money.fromMajor(value),
};
