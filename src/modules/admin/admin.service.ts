import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import { buildPaginationMeta, calculatePagination } from "../../utils/paginate";
import type {
	TAuditLogFilterOptions,
	TDashboardStats,
	TSemesterReport,
	TUpdateUserRolePayload,
	TUpdateUserStatusPayload,
	TUserFilterOptions,
} from "./admin.interface";

/**
 * List all users with filtering by role, status, search term, and pagination.
 * Excludes sensitive fields such as passwordHash.
 *
 * @param options Query and pagination parameters
 */
const listUsers = async (options: TUserFilterOptions) => {
	const normalizedOptions = {
		...options,
		order: options.order || options.sortOrder,
	};
	const { page, limit, skip, sortBy, order } = calculatePagination(
		normalizedOptions,
		"createdAt",
	);

	const where: Prisma.UserWhereInput = {
		deletedAt: null,
		...(options.role && { role: options.role }),
		...(options.status && { status: options.status }),
		...(options.q && {
			OR: [
				{ firstName: { contains: options.q, mode: "insensitive" } },
				{ lastName: { contains: options.q, mode: "insensitive" } },
				{ email: { contains: options.q, mode: "insensitive" } },
			],
		}),
	};

	const [total, data] = await Promise.all([
		prisma.user.count({ where }),
		prisma.user.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: order },
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
				status: true,
				createdAt: true,
				updatedAt: true,
				studentProfile: {
					select: {
						id: true,
						studentId: true,
						program: {
							select: {
								id: true,
								name: true,
								code: true,
							},
						},
					},
				},
				instructorProfile: {
					select: {
						id: true,
						employeeId: true,
						department: {
							select: {
								id: true,
								name: true,
								code: true,
							},
						},
					},
				},
			},
		}),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return { meta, data };
};

/**
 * Update a user's role (ADMIN, INSTRUCTOR, or STUDENT).
 * Enforces safety guard preventing an admin from demoting themselves.
 * Records a transactional audit log.
 *
 * @param userId Target user UUID
 * @param payload Payload containing the new role
 * @param adminId Authenticated admin user ID
 * @param ip Client IP
 */
const updateUserRole = async (
	userId: string,
	payload: TUpdateUserRolePayload,
	adminId: string,
	ip?: string,
) => {
	if (userId === adminId && payload.role !== "ADMIN") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot remove your own admin privileges",
		);
	}

	const user = await prisma.user.findUnique({
		where: { id: userId, deletedAt: null },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.role === payload.role) {
		return {
			id: user.id,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role,
			status: user.status,
			updatedAt: user.updatedAt,
		};
	}

	return prisma.$transaction(async (tx) => {
		const updatedUser = await tx.user.update({
			where: { id: userId },
			data: { role: payload.role },
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
				status: true,
				updatedAt: true,
			},
		});

		await createAuditLog(tx, {
			actorId: adminId,
			action: "UPDATE_USER_ROLE",
			entity: "User",
			entityId: userId,
			before: { role: user.role },
			after: { role: payload.role },
			ip,
		});

		return updatedUser;
	});
};

/**
 * Update a user's status (ACTIVE, INACTIVE, or SUSPENDED).
 * Enforces safety guard preventing an admin from modifying their own account status.
 * If status is changed to INACTIVE or SUSPENDED, revokes all active refresh tokens immediately.
 * Records a transactional audit log.
 *
 * @param userId Target user UUID
 * @param payload Payload containing the new status
 * @param adminId Authenticated admin user ID
 * @param ip Client IP
 */
const updateUserStatus = async (
	userId: string,
	payload: TUpdateUserStatusPayload,
	adminId: string,
	ip?: string,
) => {
	if (userId === adminId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot modify your own account status",
		);
	}

	const user = await prisma.user.findUnique({
		where: { id: userId, deletedAt: null },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.status === payload.status) {
		return {
			id: user.id,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role,
			status: user.status,
			updatedAt: user.updatedAt,
		};
	}

	return prisma.$transaction(async (tx) => {
		// If deactivating or suspending, revoke active sessions
		if (payload.status === "INACTIVE" || payload.status === "SUSPENDED") {
			await tx.refreshToken.updateMany({
				where: { userId, revoked: false },
				data: { revoked: true },
			});
		}

		const updatedUser = await tx.user.update({
			where: { id: userId },
			data: { status: payload.status },
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
				status: true,
				updatedAt: true,
			},
		});

		await createAuditLog(tx, {
			actorId: adminId,
			action: "UPDATE_USER_STATUS",
			entity: "User",
			entityId: userId,
			before: { status: user.status },
			after: { status: payload.status },
			ip,
		});

		return updatedUser;
	});
};

/**
 * Retrieve high-level operational and dashboard analytics.
 * Includes user counts by role/status, academic assets, enrollments, financial totals, and recent audit activity.
 */
const getDashboardStats = async (): Promise<TDashboardStats> => {
	const [
		totalUsers,
		adminCount,
		instructorCount,
		studentCount,
		activeUsersCount,
		inactiveUsersCount,
		suspendedUsersCount,
		departmentsCount,
		programsCount,
		coursesCount,
		activeSemester,
		totalActiveEnrollments,
		revenueAggregate,
		invoicesAggregate,
		paidInvoicesAggregate,
		pendingInvoicesAggregate,
		recentAuditLogs,
	] = await Promise.all([
		prisma.user.count({ where: { deletedAt: null } }),
		prisma.user.count({ where: { role: "ADMIN", deletedAt: null } }),
		prisma.user.count({ where: { role: "INSTRUCTOR", deletedAt: null } }),
		prisma.user.count({ where: { role: "STUDENT", deletedAt: null } }),
		prisma.user.count({ where: { status: "ACTIVE", deletedAt: null } }),
		prisma.user.count({ where: { status: "INACTIVE", deletedAt: null } }),
		prisma.user.count({ where: { status: "SUSPENDED", deletedAt: null } }),
		prisma.department.count({ where: { deletedAt: null } }),
		prisma.program.count({ where: { deletedAt: null } }),
		prisma.course.count({ where: { deletedAt: null } }),
		prisma.semester.findFirst({
			where: { status: "ACTIVE", deletedAt: null },
			select: { id: true, name: true, year: true, term: true },
		}),
		prisma.enrollment.count({
			where: { status: "ENROLLED", deletedAt: null },
		}),
		prisma.payment.aggregate({
			_sum: { amount: true },
			where: { status: "SUCCESS" },
		}),
		prisma.invoice.aggregate({
			_sum: { amount: true },
			where: { deletedAt: null },
		}),
		prisma.invoice.aggregate({
			_sum: { amount: true },
			where: { status: "PAID", deletedAt: null },
		}),
		prisma.invoice.aggregate({
			_sum: { amount: true },
			where: { status: { in: ["PENDING", "OVERDUE"] }, deletedAt: null },
		}),
		prisma.auditLog.findMany({
			take: 5,
			orderBy: { createdAt: "desc" },
			include: {
				actor: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						role: true,
					},
				},
			},
		}),
	]);

	let activeSemesterEnrollments = 0;
	if (activeSemester) {
		activeSemesterEnrollments = await prisma.enrollment.count({
			where: {
				section: { semesterId: activeSemester.id },
				status: "ENROLLED",
				deletedAt: null,
			},
		});
	}

	return {
		users: {
			total: totalUsers,
			byRole: {
				ADMIN: adminCount,
				INSTRUCTOR: instructorCount,
				STUDENT: studentCount,
			},
			byStatus: {
				ACTIVE: activeUsersCount,
				INACTIVE: inactiveUsersCount,
				SUSPENDED: suspendedUsersCount,
			},
		},
		academics: {
			departmentsCount,
			programsCount,
			coursesCount,
			activeSemester,
		},
		enrollments: {
			totalActiveEnrollments,
			activeSemesterEnrollments,
		},
		financials: {
			totalRevenue: Number(revenueAggregate._sum.amount || 0),
			totalInvoiced: Number(invoicesAggregate._sum.amount || 0),
			totalPaid: Number(paidInvoicesAggregate._sum.amount || 0),
			totalPending: Number(pendingInvoicesAggregate._sum.amount || 0),
		},
		recentActivity: recentAuditLogs.map((log) => ({
			id: log.id,
			action: log.action,
			entity: log.entity,
			entityId: log.entityId,
			createdAt: log.createdAt,
			actor: {
				id: log.actor.id,
				firstName: log.actor.firstName,
				lastName: log.actor.lastName,
				email: log.actor.email,
				role: log.actor.role,
			},
		})),
	};
};

/**
 * List audit logs with comprehensive filtering options (actorId, entity, action, date range)
 * and pagination.
 *
 * @param options Query and pagination parameters
 */
const listAuditLogs = async (options: TAuditLogFilterOptions) => {
	const normalizedOptions = {
		...options,
		order: options.order || options.sortOrder,
	};
	const { page, limit, skip, sortBy, order } = calculatePagination(
		normalizedOptions,
		"createdAt",
	);

	const where: Prisma.AuditLogWhereInput = {
		...(options.actorId && { actorId: options.actorId }),
		...(options.entity && {
			entity: { equals: options.entity, mode: "insensitive" },
		}),
		...(options.action && {
			action: { equals: options.action, mode: "insensitive" },
		}),
		...((options.startDate || options.endDate) && {
			createdAt: {
				...(options.startDate && { gte: new Date(options.startDate) }),
				...(options.endDate && { lte: new Date(options.endDate) }),
			},
		}),
	};

	const [total, data] = await Promise.all([
		prisma.auditLog.count({ where }),
		prisma.auditLog.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: order },
			include: {
				actor: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						role: true,
					},
				},
			},
		}),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return { meta, data };
};

/**
 * Generate a comprehensive semester report detailing enrollments, revenue, and academic performance (average GPA).
 *
 * @param semesterId Semester UUID
 */
const getSemesterReport = async (
	semesterId: string,
): Promise<TSemesterReport> => {
	const semester = await prisma.semester.findUnique({
		where: { id: semesterId, deletedAt: null },
	});

	if (!semester) {
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
	}

	const [sectionsCount, enrollments, invoices, payments, results] =
		await Promise.all([
			prisma.section.count({
				where: { semesterId, deletedAt: null },
			}),
			prisma.enrollment.findMany({
				where: {
					section: { semesterId },
					deletedAt: null,
				},
				select: {
					id: true,
					studentId: true,
					status: true,
				},
			}),
			prisma.invoice.findMany({
				where: {
					semesterId,
					deletedAt: null,
				},
				select: {
					id: true,
					amount: true,
					status: true,
				},
			}),
			prisma.payment.findMany({
				where: {
					invoice: { semesterId },
					status: "SUCCESS",
				},
				select: {
					amount: true,
				},
			}),
			prisma.result.findMany({
				where: {
					enrollment: {
						section: { semesterId },
						deletedAt: null,
					},
					status: "PUBLISHED",
					deletedAt: null,
				},
				include: {
					enrollment: {
						include: {
							section: {
								include: {
									course: { select: { credits: true } },
								},
							},
						},
					},
				},
			}),
		]);

	// Enrollment calculations
	const totalEnrollments = enrollments.length;
	const activeEnrollments = enrollments.filter(
		(e) => e.status === "ENROLLED",
	).length;
	const completedEnrollments = enrollments.filter(
		(e) => e.status === "COMPLETED",
	).length;
	const droppedEnrollments = enrollments.filter(
		(e) => e.status === "DROPPED",
	).length;
	const uniqueStudentsCount = new Set(enrollments.map((e) => e.studentId)).size;

	// Financial calculations
	const invoicesCount = invoices.length;
	const totalInvoiced = invoices.reduce(
		(sum, inv) => sum + Number(inv.amount),
		0,
	);
	const totalRevenueCollected = payments.reduce(
		(sum, p) => sum + Number(p.amount),
		0,
	);
	const paidInvoicesCount = invoices.filter(
		(inv) => inv.status === "PAID",
	).length;
	const pendingInvoicesCount = invoices.filter(
		(inv) => inv.status === "PENDING" || inv.status === "OVERDUE",
	).length;

	// Academic calculations
	const totalPublishedResults = results.length;
	let totalQualityPoints = 0;
	let totalCredits = 0;
	let passedCount = 0;
	const gradeDistribution: Record<string, number> = {
		"A+": 0,
		A: 0,
		"A-": 0,
		"B+": 0,
		B: 0,
		"B-": 0,
		"C+": 0,
		C: 0,
		D: 0,
		F: 0,
	};

	for (const res of results) {
		const gp = Number(res.gradePoint);
		const credits = res.enrollment.section.course.credits;
		totalQualityPoints += gp * credits;
		totalCredits += credits;

		const letter = res.letterGrade;
		gradeDistribution[letter] = (gradeDistribution[letter] || 0) + 1;
		if (gp > 0) {
			passedCount++;
		}
	}

	const averageGPA =
		totalCredits > 0
			? Math.round((totalQualityPoints / totalCredits) * 100) / 100
			: 0;

	const passRatePercent =
		totalPublishedResults > 0
			? Math.round((passedCount / totalPublishedResults) * 10000) / 100
			: 0;

	return {
		semester: {
			id: semester.id,
			name: semester.name,
			year: semester.year,
			term: semester.term,
			status: semester.status,
			startDate: semester.startDate,
			endDate: semester.endDate,
		},
		enrollments: {
			totalEnrollments,
			activeEnrollments,
			completedEnrollments,
			droppedEnrollments,
			uniqueStudentsCount,
			sectionsCount,
		},
		financials: {
			invoicesCount,
			totalInvoiced: Math.round(totalInvoiced * 100) / 100,
			totalRevenueCollected: Math.round(totalRevenueCollected * 100) / 100,
			paidInvoicesCount,
			pendingInvoicesCount,
		},
		academics: {
			totalPublishedResults,
			averageGPA,
			passRatePercent,
			gradeDistribution,
		},
	};
};

export const AdminService = {
	listUsers,
	updateUserRole,
	updateUserStatus,
	getDashboardStats,
	listAuditLogs,
	getSemesterReport,
};
