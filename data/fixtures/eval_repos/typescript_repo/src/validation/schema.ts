/**
 * Validate customer order payload schema before processing.
 */
export function validateOrderPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  return Boolean(payload.orderId && payload.items && payload.items.length > 0);
}
