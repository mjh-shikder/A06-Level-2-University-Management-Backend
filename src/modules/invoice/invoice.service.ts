import httpStatus from "http-status";
import type { Prisma, Role } from "../../../generated/prisma/client";
import config from "../../config";
import { AppError } from "../../errors/AppError";
import { defaultPaymentProvider } from "../../lib/payment";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import { buildPaginationMeta, calculatePagination } from "../../utils/paginate";
import type {
	TCreateInvoicePayload,
	TInvoiceFilterOptions,
	TMyInvoicesFilterOptions,
} from "./invoice.interface";

/**
 * UUID regex for matching valid UUID strings.
 */
const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a StudentProfile by profile UUID, user UUID, or formatted studentId.
 */
const resolveStudentProfile = async (identifier: string) => {
	const isUUID = UUID_REGEX.test(identifier);

	const studentProfile = await prisma.studentProfile.findFirst({
		where: {
			...(isUUID
				? {
						OR: [{ id: identifier }, { userId: identifier }],
					}
				: {
						studentId: identifier,
					}),
			deletedAt: null,
		},
		include: {
			user: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
				},
			},
		},
	});

	if (!studentProfile) {
		throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
	}

	return studentProfile;
};

/**
 * Generate a new tuition or fee invoice for a student.
 * ADMIN only.
 *
 * @param payload Invoice creation parameters
 * @param actorId ID of the admin generating the invoice
 * @param ip Client IP
 */
const createInvoice = async (
	payload: TCreateInvoicePayload,
	actorId: string,
	ip?: string,
) => {
	const studentProfile = await resolveStudentProfile(payload.studentId);

	// Verify semester exists
	const semester = await prisma.semester.findUnique({
		where: { id: payload.semesterId },
	});

	if (!semester) {
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
	}

	return prisma.$transaction(async (tx) => {
		const invoice = await tx.invoice.create({
			data: {
				studentId: studentProfile.id,
				semesterId: semester.id,
				amount: payload.amount,
				dueDate: new Date(payload.dueDate),
				description: payload.description,
				status: "PENDING",
			},
			include: {
				student: {
					include: {
						user: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								email: true,
							},
						},
					},
				},
				semester: {
					select: {
						id: true,
						name: true,
						year: true,
						term: true,
					},
				},
				payments: true,
			},
		});

		await createAuditLog(tx, {
			actorId,
			action: "CREATE_INVOICE",
			entity: "Invoice",
			entityId: invoice.id,
			after: {
				studentId: invoice.studentId,
				semesterId: invoice.semesterId,
				amount: Number(invoice.amount),
				status: invoice.status,
				dueDate: invoice.dueDate,
			},
			ip,
		});

		return invoice;
	});
};

/**
 * List all invoices with filtering and pagination.
 * ADMIN only.
 *
 * @param options Query and pagination parameters
 */
const getInvoices = async (options: TInvoiceFilterOptions) => {
	const normalizedOptions = {
		...options,
		order: options.order || options.sortOrder,
	};
	const { page, limit, skip, sortBy, order } = calculatePagination(
		normalizedOptions,
		"createdAt",
	);

	let resolvedStudentProfileId: string | undefined;
	if (options.studentId) {
		try {
			const profile = await resolveStudentProfile(options.studentId);
			resolvedStudentProfileId = profile.id;
		} catch {
			// If not found, use a non-matching UUID so query returns empty list
			resolvedStudentProfileId = "00000000-0000-0000-0000-000000000000";
		}
	}

	const where: Prisma.InvoiceWhereInput = {
		deletedAt: null,
		...(resolvedStudentProfileId && {
			studentId: resolvedStudentProfileId,
		}),
		...(options.semesterId && {
			semesterId: options.semesterId,
		}),
		...(options.status && {
			status: options.status,
		}),
	};

	const [total, data] = await Promise.all([
		prisma.invoice.count({ where }),
		prisma.invoice.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: order },
			include: {
				student: {
					include: {
						user: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								email: true,
							},
						},
					},
				},
				semester: {
					select: {
						id: true,
						name: true,
						year: true,
						term: true,
					},
				},
				payments: {
					orderBy: { createdAt: "desc" },
				},
			},
		}),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return { meta, data };
};

/**
 * List authenticated student's own invoices.
 *
 * @param options Query and pagination parameters
 * @param userId Authenticated user ID (student)
 */
const getMyInvoices = async (
	options: TMyInvoicesFilterOptions,
	userId: string,
) => {
	const studentProfile = await prisma.studentProfile.findUnique({
		where: { userId },
	});

	if (!studentProfile) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Student profile not found for authenticated user",
		);
	}

	const normalizedOptions = {
		...options,
		order: options.order || options.sortOrder,
	};
	const { page, limit, skip, sortBy, order } = calculatePagination(
		normalizedOptions,
		"createdAt",
	);

	const where: Prisma.InvoiceWhereInput = {
		studentId: studentProfile.id,
		deletedAt: null,
		...(options.semesterId && {
			semesterId: options.semesterId,
		}),
		...(options.status && {
			status: options.status,
		}),
	};

	const [total, data] = await Promise.all([
		prisma.invoice.count({ where }),
		prisma.invoice.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: order },
			include: {
				semester: {
					select: {
						id: true,
						name: true,
						year: true,
						term: true,
					},
				},
				payments: {
					orderBy: { createdAt: "desc" },
				},
			},
		}),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return { meta, data };
};

/**
 * Get detailed invoice by ID, including payments.
 * Authorized for ADMIN or the owning STUDENT.
 *
 * @param id Invoice UUID
 * @param user Authenticated user
 */
const getInvoiceById = async (id: string, user: { id: string; role: Role }) => {
	const invoice = await prisma.invoice.findUnique({
		where: { id },
		include: {
			student: {
				include: {
					user: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
						},
					},
				},
			},
			semester: {
				select: {
					id: true,
					name: true,
					year: true,
					term: true,
				},
			},
			payments: {
				orderBy: { createdAt: "desc" },
			},
		},
	});

	if (!invoice) {
		throw new AppError(httpStatus.NOT_FOUND, "Invoice not found");
	}

	if (user.role === "STUDENT" && invoice.student.userId !== user.id) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Access denied: you can only view your own invoices",
		);
	}

	return invoice;
};

/**
 * Initiate an online payment for an invoice.
 * Creates a Stripe Checkout Session and records an INITIATED Payment row.
 * STUDENT only (own invoice).
 *
 * @param invoiceId Invoice UUID
 * @param userId Authenticated user ID (student)
 */
const initiatePayment = async (invoiceId: string, userId: string) => {
	const studentProfile = await prisma.studentProfile.findUnique({
		where: { userId },
		include: {
			user: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
				},
			},
		},
	});

	if (!studentProfile) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Student profile not found for authenticated user",
		);
	}

	const invoice = await prisma.invoice.findUnique({
		where: { id: invoiceId },
		include: {
			semester: true,
		},
	});

	if (!invoice) {
		throw new AppError(httpStatus.NOT_FOUND, "Invoice not found");
	}

	if (invoice.studentId !== studentProfile.id) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only pay for your own invoice",
		);
	}

	if (invoice.status === "PAID") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This invoice is already fully paid",
		);
	}

	if (invoice.status === "CANCELLED") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot make payment for a cancelled invoice",
		);
	}

	// Generate transaction ID
	const transactionId = `txn_${Date.now()}_${Math.random()
		.toString(36)
		.substring(2, 9)}`;

	// Convert decimal amount to smallest unit (cents)
	const amountInCents = Math.round(Number(invoice.amount) * 100);

	const successUrl = `${config.frontendUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}&invoice_id=${invoice.id}`;
	const cancelUrl = `${config.frontendUrl}/payments/cancel?invoice_id=${invoice.id}`;

	// Create Stripe checkout session via payment provider
	const session = await defaultPaymentProvider.createCheckoutSession({
		transactionId,
		amount: amountInCents,
		currency: config.stripe.currency,
		customerEmail: studentProfile.user.email,
		description:
			invoice.description || `Tuition & Fees - ${invoice.semester.name}`,
		successUrl,
		cancelUrl,
		metadata: {
			invoiceId: invoice.id,
			studentId: studentProfile.id,
		},
	});

	// Record the INITIATED payment row in DB
	await prisma.payment.create({
		data: {
			invoiceId: invoice.id,
			transactionId,
			amount: invoice.amount,
			method: "STRIPE",
			status: "INITIATED",
			gatewayResponse: {
				sessionId: session.sessionId,
				sessionUrl: session.sessionUrl,
			},
		},
	});

	return {
		sessionId: session.sessionId,
		sessionUrl: session.sessionUrl,
		transactionId,
	};
};

export const InvoiceService = {
	createInvoice,
	getInvoices,
	getMyInvoices,
	getInvoiceById,
	initiatePayment,
};
