import { Client } from '../clients/entities/client.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { ActorContext } from '../common/cls/actor-context';
import { deriveActorKind, deriveActorRole } from '../businesses/membership.util';

/** CLS actor для бот-апдейта из клиента и членства в текущем бизнесе. */
export function extractActorFromClient(
  client: Client,
  businessId: string,
  telegramId: string,
  membership: BusinessMember | null,
): ActorContext {
  return {
    userId: client.id,
    telegramId,
    role: deriveActorRole(membership, client),
    businessId,
    kind: deriveActorKind(membership, client),
    source: 'bot',
  };
}
