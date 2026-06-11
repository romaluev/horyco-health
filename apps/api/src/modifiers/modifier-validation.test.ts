import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ModifierGroup,
  ModifierSelectionType,
} from './entities/modifier.entity';
import { ConflictError } from '../common/errors/domain-error';

function validateGroupSelection(group: ModifierGroup, count: number): void {
  const min = group.isRequired ? Math.max(1, group.minSelect) : group.minSelect;
  if (count < min) {
    throw new ConflictError(`min ${min}`);
  }
  if (group.selectionType === ModifierSelectionType.Single && count > 1) {
    throw new ConflictError('single only');
  }
}

describe('modifier-validation', () => {
  it('requires selection when isRequired', () => {
    const group = {
      isRequired: true,
      minSelect: 0,
      selectionType: ModifierSelectionType.Single,
    } as ModifierGroup;
    assert.throws(() => validateGroupSelection(group, 0), ConflictError);
    assert.doesNotThrow(() => validateGroupSelection(group, 1));
  });

  it('blocks multiple in SINGLE group', () => {
    const group = {
      isRequired: false,
      minSelect: 0,
      selectionType: ModifierSelectionType.Single,
    } as ModifierGroup;
    assert.throws(() => validateGroupSelection(group, 2), ConflictError);
  });
});
