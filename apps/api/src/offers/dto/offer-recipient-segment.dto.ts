import { IsEnum } from 'class-validator';

export enum OfferRecipientSegment {
  All = 'all',
  HasBalance = 'has_balance',
  OrderedLast30d = 'ordered_30d',
  NeverOrdered = 'never_ordered',
}

export class SetOfferRecipientsBySegmentDto {
  @IsEnum(OfferRecipientSegment)
  segment!: OfferRecipientSegment;
}
