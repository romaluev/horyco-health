/**
 * Money value-object. Деньги хранятся в МИНОРНЫХ единицах (тийины/копейки) как целое —
 * никаких float. JS-number для денег запрещён за пределами этого класса.
 * Архитектура §Security/Деньги: единая (де)сериализация, запрет дробной арифметики.
 */
export class Money {
  /** Кол-во знаков после запятой (numeric(12,2)). */
  static readonly SCALE = 2;
  private static readonly FACTOR = 100; // 10 ** SCALE

  private constructor(private readonly minor: number) {
    if (!Number.isInteger(minor) || !Number.isFinite(minor)) {
      throw new Error(`Money: некорректное значение в минорных единицах: ${minor}`);
    }
  }

  /** Из мажорной величины (строка из БД "12000.00" или число). */
  static fromMajor(value: string | number): Money {
    const num = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(num)) {
      throw new Error(`Money.fromMajor: некорректное значение: ${value}`);
    }
    return new Money(Math.round(num * Money.FACTOR));
  }

  /** Из целых минорных единиц. */
  static fromMinor(minor: number): Money {
    return new Money(minor);
  }

  static zero(): Money {
    return new Money(0);
  }

  get minorUnits(): number {
    return this.minor;
  }

  add(other: Money): Money {
    return new Money(this.minor + other.minor);
  }

  subtract(other: Money): Money {
    return new Money(this.minor - other.minor);
  }

  multiply(qty: number): Money {
    if (!Number.isInteger(qty)) {
      throw new Error(`Money.multiply: количество должно быть целым: ${qty}`);
    }
    return new Money(this.minor * qty);
  }

  isNegative(): boolean {
    return this.minor < 0;
  }

  isPositive(): boolean {
    return this.minor > 0;
  }

  isZero(): boolean {
    return this.minor === 0;
  }

  gte(other: Money): boolean {
    return this.minor >= other.minor;
  }

  /** Мажорная строка для БД/JSON: "12000.00". */
  toString(): string {
    return (this.minor / Money.FACTOR).toFixed(Money.SCALE);
  }

  toJSON(): string {
    return this.toString();
  }
}
