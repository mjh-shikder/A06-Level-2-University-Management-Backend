import express, { Router } from "express";
import { PaymentController } from "./payment.controller";

const router = Router();

/**
 * POST /api/v1/payments/webhook
 * Public webhook endpoint verified via Stripe signature.
 * Uses express.raw middleware to retain raw payload buffer for signature check.
 */
router.post(
	"/webhook",
	express.raw({ type: "application/json" }),
	PaymentController.handleWebhook,
);

export const paymentRoutes = router;
