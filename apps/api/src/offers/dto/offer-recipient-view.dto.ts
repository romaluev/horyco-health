export class OfferRecipientLineDto {
  kind!: 'dish' | 'combo';
  menuItemId!: string | null;
  comboId!: string | null;
  quantity!: number;
  nameRu!: string;
  nameUz!: string;
  calories!: number | null;
  lineTotal!: string;
}

export class OfferRecipientViewDto {
  descriptionRu!: string | null;
  descriptionUz!: string | null;
  estimatedTotal!: string;
  lines!: OfferRecipientLineDto[];
}
