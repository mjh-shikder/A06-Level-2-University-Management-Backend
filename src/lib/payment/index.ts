import type { PaymentProvider } from "./provider.interface";
import { stripeProvider } from "./stripe";

/**
 * Default payment provider instance used across the application.
 */
export const defaultPaymentProvider: PaymentProvider = stripeProvider;

export * from "./provider.interface";
export * from "./stripe";
