import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../errors/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";

/**
 * Controller to handle incoming Stripe webhook notifications.
 * Route: POST /api/v1/payments/webhook
 */
const handleWebhook = catchAsync(async (req: Request, res: Response) => {
	const signature = req.headers["stripe-signature"] as string | undefined;

	if (!signature) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Missing stripe-signature header",
		);
	}

	let rawBody: Buffer;
	if ((req as unknown as { rawBody?: Buffer }).rawBody) {
		rawBody = (req as unknown as { rawBody: Buffer }).rawBody;
	} else if (Buffer.isBuffer(req.body)) {
		rawBody = req.body;
	} else if (typeof req.body === "string") {
		rawBody = Buffer.from(req.body);
	} else if (req.body && typeof req.body === "object") {
		rawBody = Buffer.from(JSON.stringify(req.body));
	} else {
		rawBody = Buffer.from("");
	}

	if (rawBody.length === 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Webhook request body cannot be empty",
		);
	}

	const result = await PaymentService.handleStripeWebhook(
		rawBody,
		signature,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message || "Webhook processed successfully",
		data: result,
	});
});

export const PaymentController = {
	handleWebhook,
};
