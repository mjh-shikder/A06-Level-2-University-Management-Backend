import Stripe from "stripe";
import config from "../../config";
import type {
	PaymentProvider,
	TCheckoutSessionResult,
	TCreateCheckoutSessionParams,
	TParsedCompletedPayment,
} from "./provider.interface";

/**
 * Stripe SDK client instance.
 */
export const stripeClient = new Stripe(config.stripe.secretKey);

/**
 * Stripe Payment Provider implementation.
 */
export const stripeProvider: PaymentProvider = {
	async createCheckoutSession(
		params: TCreateCheckoutSessionParams,
	): Promise<TCheckoutSessionResult> {
		const session = await stripeClient.checkout.sessions.create({
			mode: "payment",
			line_items: [
				{
					price_data: {
						currency: params.currency.toLowerCase(),
						product_data: { name: params.description },
						unit_amount: params.amount,
					},
					quantity: 1,
				},
			],
			customer_email: params.customerEmail,
			client_reference_id: params.transactionId,
			metadata: params.metadata ?? {},
			success_url: params.successUrl,
			cancel_url: params.cancelUrl,
		});

		return {
			sessionId: session.id,
			sessionUrl: session.url || "",
		};
	},

	verifyWebhookSignature(payload: Buffer, signature: string): Stripe.Event {
		return stripeClient.webhooks.constructEvent(
			payload,
			signature,
			config.stripe.webhookSecret,
		);
	},

	parseCompletedPayment(event: unknown): TParsedCompletedPayment | null {
		const stripeEvent = event as Stripe.Event;
		if (stripeEvent.type !== "checkout.session.completed") {
			return null;
		}

		const session = stripeEvent.data.object as Stripe.Checkout.Session;
		return {
			transactionId: session.client_reference_id ?? "",
			amountPaid: session.amount_total ?? 0,
			metadata: (session.metadata ?? {}) as Record<string, string>,
		};
	},
};
