import httpStatus from "http-status";
import type { Prisma, Role } from "../../../generated/prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import { buildPaginationMeta, calculatePagination } from "../../utils/paginate";
import type {
	TAttendanceSummary,
	TBulkMarkAttendancePayload,
	TEnrollmentAttendanceFilterOptions,
	TSectionAttendanceFilterOptions,
} from "./attendance.interface";

/**
 * Normalizes input date string into a Date object at UTC midnight.
 * Ensures consistent matching against PostgreSQL @db.Date column.
 */
const parseDateOnly = (dateStr: string): Date => {
	if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
		return new Date(`${dateStr}T00:00:00.000Z`);
	}
	const parsed = new Date(dateStr);
	if (Number.isNaN(parsed.getTime())) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid date format");
	}
	return new Date(
		Date.UTC(
			parsed.getUTCFullYear(),
			parsed.getUTCMonth(),
			parsed.getUTCDate(),
		),
	);
};

/**
 * Bulk marks attendance records for a section on a given date.
 * - Enforces that an INSTRUCTOR can only mark attendance for their assigned section.
 * - ADMIN can mark attendance for any section.
 * - Validates that all enrollment IDs belong to the target section.
 * - Upserts attendance records atomically in a transaction.
 * - Records an audit log for the action.
 *
 * @param sectionId ID of the course section
 * @param payload Date and array of attendance records
 * @param user Authenticated user info
 * @param ip Optional client IP
 */
const bulkMarkAttendance = async (
	sectionId: string,
	payload: TBulkMarkAttendancePayload,
	user: { id: string; role: Role },
	ip?: string,
) => {
	return prisma.$transaction(async (tx) => {
		// 1. Fetch section and verify existence
		const section = await tx.section.findUnique({
			where: { id: sectionId },
		});

		if (!section) {
			throw new AppError(httpStatus.NOT_FOUND, "Course section not found");
		}

		// 2. Instructor ownership check
		if (user.role === "INSTRUCTOR") {
			const instructorProfile = await tx.instructorProfile.findUnique({
				where: { userId: user.id },
			});

			if (!instructorProfile) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"Instructor profile not found for user",
				);
			}

			if (section.instructorId !== instructorProfile.id) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"You are not assigned as the instructor for this section",
				);
			}
		}

		// 3. Verify all enrollment IDs belong to this section
		const enrollmentIds = [
			...new Set(payload.records.map((record) => record.enrollmentId)),
		];

		const validEnrollments = await tx.enrollment.findMany({
			where: {
				id: { in: enrollmentIds },
				sectionId: section.id,
				deletedAt: null,
			},
			select: { id: true, status: true },
		});

		if (validEnrollments.length !== enrollmentIds.length) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"One or more enrollments do not belong to this section or do not exist",
			);
		}

		// 4. Upsert attendance records atomically
		const targetDate = parseDateOnly(payload.date);

		const upsertOperations = payload.records.map((record) =>
			tx.attendance.upsert({
				where: {
					enrollmentId_date: {
						enrollmentId: record.enrollmentId,
						date: targetDate,
					},
				},
				update: {
					status: record.status,
					remarks: record.remarks ?? null,
				},
				create: {
					enrollmentId: record.enrollmentId,
					sectionId: section.id,
					date: targetDate,
					status: record.status,
					remarks: record.remarks ?? null,
				},
			}),
		);

		const results = await Promise.all(upsertOperations);

		// 5. Record audit log
		await createAuditLog(tx, {
			actorId: user.id,
			action: "ATTENDANCE_MARK",
			entity: "Section",
			entityId: section.id,
			after: {
				date: payload.date,
				count: results.length,
			},
			ip,
		});

		return {
			count: results.length,
			date: payload.date,
			records: results,
		};
	});
};

/**
 * Retrieve paginated attendance list for a course section.
 * Supports optional date filter.
 *
 * @param sectionId ID of the course section
 * @param options Query options (page, limit, sortBy, order, date)
 * @param user Authenticated user info
 */
const getSectionAttendance = async (
	sectionId: string,
	options: TSectionAttendanceFilterOptions,
	user: { id: string; role: Role },
) => {
	const section = await prisma.section.findUnique({
		where: { id: sectionId },
	});

	if (!section) {
		throw new AppError(httpStatus.NOT_FOUND, "Course section not found");
	}

	if (user.role === "INSTRUCTOR") {
		const instructorProfile = await prisma.instructorProfile.findUnique({
			where: { userId: user.id },
		});

		if (!instructorProfile) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Instructor profile not found for user",
			);
		}

		if (section.instructorId !== instructorProfile.id) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not assigned as the instructor for this section",
			);
		}
	}

	const normalizedOptions = {
		...options,
		order: options.order || options.sortOrder,
	};
	const { page, limit, skip, sortBy, order } = calculatePagination(
		normalizedOptions,
		"date",
	);

	const where: Prisma.AttendanceWhereInput = {
		sectionId,
		...(options.date && { date: parseDateOnly(options.date) }),
	};

	const [total, data] = await Promise.all([
		prisma.attendance.count({ where }),
		prisma.attendance.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: order },
			include: {
				enrollment: {
					include: {
						student: {
							select: {
								id: true,
								studentId: true,
								user: {
									select: {
										id: true,
										firstName: true,
										lastName: true,
										email: true,
									},
								},
								program: {
									select: {
										id: true,
										name: true,
										code: true,
									},
								},
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
 * Retrieve attendance history for an individual enrollment.
 * - STUDENT can only view their own enrollment attendance.
 * - INSTRUCTOR can only view attendance for sections they teach.
 * - ADMIN can view any attendance history.
 *
 * @param enrollmentId ID of the enrollment record
 * @param options Query options (page, limit, sortBy, order, startDate, endDate, status)
 * @param user Authenticated user info
 */
const getEnrollmentAttendance = async (
	enrollmentId: string,
	options: TEnrollmentAttendanceFilterOptions,
	user: { id: string; role: Role },
) => {
	const enrollment = await prisma.enrollment.findUnique({
		where: { id: enrollmentId },
		include: {
			student: true,
			section: true,
		},
	});

	if (!enrollment) {
		throw new AppError(httpStatus.NOT_FOUND, "Enrollment record not found");
	}

	// Authorization verification
	if (user.role === "STUDENT") {
		if (enrollment.student.userId !== user.id) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not authorized to view attendance for this enrollment",
			);
		}
	} else if (user.role === "INSTRUCTOR") {
		const instructorProfile = await prisma.instructorProfile.findUnique({
			where: { userId: user.id },
		});

		if (
			!instructorProfile ||
			enrollment.section.instructorId !== instructorProfile.id
		) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not authorized to view attendance for this section",
			);
		}
	}

	const normalizedOptions = {
		...options,
		order: options.order || options.sortOrder,
	};
	const { page, limit, skip, sortBy, order } = calculatePagination(
		normalizedOptions,
		"date",
	);

	const where: Prisma.AttendanceWhereInput = {
		enrollmentId,
		...(options.status && { status: options.status }),
		...(options.startDate || options.endDate
			? {
					date: {
						...(options.startDate && { gte: parseDateOnly(options.startDate) }),
						...(options.endDate && { lte: parseDateOnly(options.endDate) }),
					},
				}
			: {}),
	};

	const [total, data] = await Promise.all([
		prisma.attendance.count({ where }),
		prisma.attendance.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: order },
		}),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return { meta, data };
};

/**
 * Compute and retrieve attendance summary metrics for an enrollment.
 * Returns total, present, absent, late, excused counts, and overall attendance percentage.
 * Formula: percentage = (present + late) / total * 100
 *
 * @param enrollmentId ID of the enrollment record
 * @param user Authenticated user info
 */
const getEnrollmentAttendanceSummary = async (
	enrollmentId: string,
	user: { id: string; role: Role },
): Promise<TAttendanceSummary> => {
	const enrollment = await prisma.enrollment.findUnique({
		where: { id: enrollmentId },
		include: {
			student: true,
			section: true,
		},
	});

	if (!enrollment) {
		throw new AppError(httpStatus.NOT_FOUND, "Enrollment record not found");
	}

	// Authorization verification
	if (user.role === "STUDENT") {
		if (enrollment.student.userId !== user.id) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not authorized to view attendance summary for this enrollment",
			);
		}
	} else if (user.role === "INSTRUCTOR") {
		const instructorProfile = await prisma.instructorProfile.findUnique({
			where: { userId: user.id },
		});

		if (
			!instructorProfile ||
			enrollment.section.instructorId !== instructorProfile.id
		) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not authorized to view attendance summary for this section",
			);
		}
	}

	const records = await prisma.attendance.findMany({
		where: { enrollmentId },
		select: { status: true },
	});

	const total = records.length;
	let present = 0;
	let absent = 0;
	let late = 0;
	let excused = 0;

	for (const record of records) {
		if (record.status === "PRESENT") present++;
		else if (record.status === "ABSENT") absent++;
		else if (record.status === "LATE") late++;
		else if (record.status === "EXCUSED") excused++;
	}

	const percentage =
		total > 0 ? Math.round(((present + late) / total) * 100 * 100) / 100 : 0;

	return {
		enrollmentId,
		total,
		present,
		absent,
		late,
		excused,
		percentage,
	};
};

export const attendanceService = {
	bulkMarkAttendance,
	getSectionAttendance,
	getEnrollmentAttendance,
	getEnrollmentAttendanceSummary,
};
