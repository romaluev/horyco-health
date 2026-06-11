export class BusinessMetricsRowDto {
  id!: string;
  slug!: string;
  name!: string;
  orderCount!: number;
  gmv!: string;
  lastOrderAt!: Date | null;
}

export class PlatformMetricsDto {
  totalBusinesses!: number;
  activeBusinesses!: number;
  onboardingBusinesses!: number;
  suspendedBusinesses!: number;
  businessesWithBot!: number;
  totalOrders!: number;
  totalGmv!: string;
  businesses!: BusinessMetricsRowDto[];
}
