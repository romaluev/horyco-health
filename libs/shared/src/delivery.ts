const MIN_ADDRESS_LENGTH = 5;

function parseCoord(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** GPS coordinates present and valid. */
export function hasDeliveryLocation(client: {
  deliveryLat?: string | number | null;
  deliveryLng?: string | number | null;
}): boolean {
  return parseCoord(client.deliveryLat) != null && parseCoord(client.deliveryLng) != null;
}

/** Delivery point: map pin OR sufficient text address (desktop / admin CRM fallback). */
export function hasDeliveryInfo(client: {
  deliveryLat?: string | number | null;
  deliveryLng?: string | number | null;
  address?: string | null;
}): boolean {
  return hasDeliveryLocation(client) || (client.address?.trim().length ?? 0) >= MIN_ADDRESS_LENGTH;
}

export { MIN_ADDRESS_LENGTH };
