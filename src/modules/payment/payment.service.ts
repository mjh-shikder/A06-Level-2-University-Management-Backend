import httpStatus from "http-status";
import { AppError } from "../../errors/AppError";
import { defaultPaymentProvider } from "../../lib/payment";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import type { TWebhookProcessResult } from "./payment.interface";

/**
 * Handle incoming Stripe webhook notifications.
 *
 * Algorithm:
 * 1. Verify webhook signature using the configured webhook secret.
 * 2. Parse the completed payment event.
 * 3. Enforce idempotency: if the payment is already SUCCESS, return 200 without reprocessing.
 * 4. In a transaction:
 *    - Update Payment status to SUCCESS.
 *    - Check total successful payments for the invoice; if fully paid, update Invoice status to PAID.
 *    - Record an audit log entry.
 *
 * @param payload Raw request body Buffer
 * @param signature Value of the stripe-signature header
 * @param ip Client IP
 */
const handleStripeWebhook = async (
	payload: Buffer,
	signature: string,
	ip?: string,
): Promise<TWebhookProcessResult> => {
	let event: unknown;

	try {
		event = defaultPaymentProvider.verifyWebhookSignature(payload, signature);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Invalid webhook signature";
		throw new AppError(httpStatus.BAD_REQUEST, `Webhook error: ${message}`);
	}

	const parsed = defaultPaymentProvider.parseCompletedPayment(event);
	if (!parsed) {
		return {
			received: true,
			message: "Ignored unhandled event type",
		};
	}

	const { transactionId, amountPaid } = parsed;
	if (!transactionId) {
		return {
			received: true,
			message: "Transaction ID not present in webhook event",
		};
	}

	// Fetch payment record
	const existingPayment = await prisma.payment.findUnique({
		where: { transactionId },
		include: {
			invoice: {
				include: {
					student: true,
				},
			},
		},
	});

	if (!existingPayment) {
		return {
			received: true,
			message: `Payment record with transactionId '${transactionId}' not found`,
		};
	}

	// Idempotency check: if already completed, return 200 immediately
	if (existingPayment.status === "SUCCESS") {
		return {
			received: true,
			success: true,
			message: "Payment already successfully processed (idempotent)",
			paymentId: existingPayment.id,
		};
	}

	return prisma.$transaction(async (tx) => {
		// 1. Update Payment status to SUCCESS
		const updatedPayment = await tx.payment.update({
			where: { id: existingPayment.id },
			data: {
				status: "SUCCESS",
				gatewayResponse: event as object,
			},
		});

		// 2. Compute total successful payments for this invoice
		const allSuccessfulPayments = await tx.payment.findMany({
			where: {
				invoiceId: existingPayment.invoiceId,
				status: "SUCCESS",
			},
			select: { amount: true },
		});

		const totalPaid = allSuccessfulPayments.reduce(
			(sum, p) => sum + Number(p.amount),
			0,
		);

		const invoiceAmount = Number(existingPayment.invoice.amount);

		// If total paid equals or exceeds invoice amount, mark invoice as PAID
		if (totalPaid >= invoiceAmount) {
			await tx.invoice.update({
				where: { id: existingPayment.invoiceId },
				data: { status: "PAID" },
			});
		}

		// 3. Record Audit Log
		const studentUserId = existingPayment.invoice.student.userId;
		await createAuditLog(tx, {
			actorId: studentUserId,
			action: "PAYMENT_SUCCESS",
			entity: "Payment",
			entityId: updatedPayment.id,
			before: {
				status: existingPayment.status,
			},
			after: {
				status: updatedPayment.status,
				transactionId: updatedPayment.transactionId,
				amount: Number(updatedPayment.amount),
				amountPaidInCents: amountPaid,
			},
			ip,
		});

		return {
			received: true,
			success: true,
			message: "Payment processed successfully",
			paymentId: updatedPayment.id,
		};
	});
};

export const PaymentService = {
	handleStripeWebhook,
};
