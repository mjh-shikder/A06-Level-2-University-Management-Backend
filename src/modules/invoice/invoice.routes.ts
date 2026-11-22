import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { InvoiceController } from "./invoice.controller";
import { invoiceValidation } from "./invoice.validation";

const router = Router();

/**
 * POST /api/v1/invoices
 * Generate invoice for student (ADMIN only)
 */
router.post(
	"/",
	authenticate,
	authorize("ADMIN"),
	validate(invoiceValidation.createInvoiceSchema),
	InvoiceController.createInvoice,
);

/**
 * GET /api/v1/invoices
 * List all invoices (ADMIN only)
 */
router.get(
	"/",
	authenticate,
	authorize("ADMIN"),
	validate(invoiceValidation.getInvoicesSchema),
	InvoiceController.getInvoices,
);

/**
 * GET /api/v1/invoices/my
 * List own invoices (STUDENT only)
 */
router.get(
	"/my",
	authenticate,
	authorize("STUDENT"),
	validate(invoiceValidation.getMyInvoicesSchema),
	InvoiceController.getMyInvoices,
);

/**
 * GET /api/v1/invoices/:id
 * Get invoice details with payments (STUDENT own, ADMIN)
 */
router.get(
	"/:id",
	authenticate,
	authorize("ADMIN", "STUDENT"),
	validate(invoiceValidation.invoiceIdParamSchema),
	InvoiceController.getInvoiceById,
);

/**
 * POST /api/v1/invoices/:id/pay
 * Initiate payment checkout session (STUDENT only)
 */
router.post(
	"/:id/pay",
	authenticate,
	authorize("STUDENT"),
	validate(invoiceValidation.invoiceIdParamSchema),
	InvoiceController.initiatePayment,
);

export const invoiceRoutes = router;
