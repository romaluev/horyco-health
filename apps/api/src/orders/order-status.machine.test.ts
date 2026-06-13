import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus, Role } from '@eatfit/shared';
import { assertTransition, allowedTargets } from './order-status.machine';
import { ForbiddenError, InvalidStatusTransitionError } from '../common/errors/domain-error';

describe('order-status.machine', () => {
  it('allows cook pending to cooking', () => {
    assert.doesNotThrow(() =>
      assertTransition(OrderStatus.Pending, OrderStatus.Cooking, Role.Cook),
    );
  });

  it('blocks cook pending to confirmed', () => {
    assert.throws(
      () => assertTransition(OrderStatus.Pending, OrderStatus.Confirmed, Role.Cook),
      ForbiddenError,
    );
  });

  it('allows admin pending to confirmed', () => {
    assert.doesNotThrow(() =>
      assertTransition(OrderStatus.Pending, OrderStatus.Confirmed, Role.Admin),
    );
  });

  it('blocks client from any transition', () => {
    assert.throws(
      () => assertTransition(OrderStatus.Pending, OrderStatus.Confirmed, Role.Client),
      ForbiddenError,
    );
  });

  it('blocks invalid transition', () => {
    assert.throws(
      () => assertTransition(OrderStatus.Pending, OrderStatus.Done, Role.Admin),
      InvalidStatusTransitionError,
    );
  });

  it('courier sees delivering from ready', () => {
    const targets = allowedTargets(OrderStatus.Ready, Role.Courier);
    assert.deepEqual(targets, [OrderStatus.Delivering]);
  });
});
