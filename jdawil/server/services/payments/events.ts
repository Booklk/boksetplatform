import { EventEmitter } from 'events';
import type { NormalizedPayment, PaymentStatus, ProviderSlug } from './types.js';

export interface PaymentEvent {
  vendorId: number;
  provider: ProviderSlug;
  payment: NormalizedPayment;
  metadata: Record<string, string>;
}

/**
 * Typed event bus for payment-gateway webhooks. Subscribe with:
 *   bookingPaymentEvents.on('paid', (e) => ...)
 *
 * We stay in-process for now — scaling out to multiple nodes will mean
 * replacing this with a real pub/sub, but the shape stays identical.
 */
class TypedEmitter extends EventEmitter {
  override on(event: PaymentStatus, listener: (e: PaymentEvent) => void): this {
    return super.on(event, listener);
  }
  override emit(event: PaymentStatus, e: PaymentEvent): boolean {
    return super.emit(event, e);
  }
}

export const bookingPaymentEvents = new TypedEmitter();
