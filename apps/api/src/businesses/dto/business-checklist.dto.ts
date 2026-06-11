export class ChecklistItemDto {
  key!: string;
  ok!: boolean;
  label!: string;
  hint?: string;
}

export class BusinessChecklistDto {
  ready!: boolean;
  items!: ChecklistItemDto[];
}
