import { Injectable } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { OrderStatus } from '@eatfit/shared';
import { TransactionalRepository } from '../common/database/transactional-repository';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';

@Injectable()
export class OrderRepository extends TransactionalRepository<Order> {
  protected readonly entity: EntityTarget<Order> = Order;

  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost);
  }

  createOrder(data: Partial<Order>): Promise<Order> {
    return this.repo.save(this.repo.create(data));
  }

  saveItems(items: Partial<OrderItem>[]): Promise<OrderItem[]> {
    const itemRepo = this.txHost.tx.getRepository(OrderItem);
    return itemRepo.save(itemRepo.create(items));
  }

  getItems(orderId: string): Promise<OrderItem[]> {
    // withDeleted: блюдо могло быть удалено (soft-delete) после оформления заказа —
    // подтягиваем и удалённые, чтобы имя позиции в истории заказа не терялось.
    return this.txHost.tx
      .getRepository(OrderItem)
      .find({ where: { orderId }, relations: { menuItem: true }, withDeleted: true });
  }

  findById(id: string): Promise<Order | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByClient(clientId: string): Promise<Order[]> {
    return this.repo.find({ where: { clientId }, order: { createdAt: 'DESC' } });
  }

  findAll(status?: OrderStatus): Promise<Order[]> {
    return this.repo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  save(order: Order): Promise<Order> {
    return this.repo.save(order);
  }
}
