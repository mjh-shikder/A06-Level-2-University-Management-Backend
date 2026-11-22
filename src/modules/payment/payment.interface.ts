export interface TWebhookProcessResult {
	received: boolean;
	success?: boolean;
	message?: string;
	paymentId?: string;
}
