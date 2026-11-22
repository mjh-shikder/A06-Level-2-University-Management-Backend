/**
 * Payment Provider Abstraction Interface.
 * Allows pluggable payment gateways (e.g. Stripe, SSLCommerz, PayPal).
 */
export interface TCreateCheckoutSessionParams {
	transactionId: string;
	amount: number; // in smallest currency unit (e.g. cents)
	currency: string;
	customerEmail: string;
	description: string;
	successUrl: string;
	cancelUrl: string;
	metadata?: Record<string, string>;
}

export interface TCheckoutSessionResult {
	sessionId: string;
	sessionUrl: string;
}

export interface TParsedCompletedPayment {
	transactionId: string;
	amountPaid: number; // in smallest currency unit (e.g. cents)
	metadata: Record<string, string>;
}

export interface PaymentProvider {
	createCheckoutSession(
		params: TCreateCheckoutSessionParams,
	): Promise<TCheckoutSessionResult>;

	verifyWebhookSignature(payload: Buffer, signature: string): unknown;

	parseCompletedPayment(event: unknown): TParsedCompletedPayment | null;
}
