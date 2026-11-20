import httpStatus from "http-status";
import type { Prisma, Role } from "../../../generated/prisma/client";
import config from "../../config";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import { buildPaginationMeta, calculatePagination } from "../../utils/paginate";
import type {
	TEnrollSectionPayload,
	TMyEnrollmentsFilterOptions,
	TScheduleSlot,
	TSectionStudentsFilterOptions,
} from "./enrollment.interface";

/**
 * Common relations to include when returning an enrollment object.
 */
const enrollmentInclude = {
	section: {
		include: {
			course: {
				select: {
					id: true,
					code: true,
					title: true,
					credits: true,
				},
			},
			semester: {
				select: {
					id: true,
					name: true,
					year: true,
					term: true,
					status: true,
				},
			},
		},
	},
} as const;

/**
 * Enroll a student into a course section with comprehensive transaction safety.
 *
 * Transactional Validations Enforced:
 * 1. Authenticated user has an ACTIVE student profile.
 * 2. Section exists and is locked with row-level locking (`SELECT ... FOR UPDATE`) to prevent concurrency races.
 * 3. Associated semester is ACTIVE and current time is within the registration window (if configured).
 * 4. Student is not already actively enrolled in this section.
 * 5. Student is not already actively enrolled in another section of the same course in this semester.
 * 6. All course prerequisites have been completed with a COMPLETED status.
 * 7. Section capacity has not been exceeded.
 * 8. Total enrolled credits for the semester do not exceed the configured credit limit.
 * 9. Section class schedule does not conflict (day and time overlap) with any active enrollments in the same semester.
 * 10. Outstanding unpaid invoices do not block enrollment (guarded until Invoice model is active).
 * 11. Increments `section.enrolledCount` and records an audit log atomically.
 *
 * @param payload Object containing the target sectionId
 * @param userId ID of the authenticated user (must be a student)
 * @param ip Optional client IP address for the audit record
 */
const enrollSection = async (
	payload: TEnrollSectionPayload,
	userId: string,
	ip?: string,
) => {
	return prisma.$transaction(async (tx) => {
		// 1. Identify and validate StudentProfile
		const studentProfile = await tx.studentProfile.findUnique({
			where: { userId },
			include: {
				user: {
					select: {
						id: true,
						email: true,
						status: true,
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

		if (studentProfile.user.status !== "ACTIVE") {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Your user account is not active. Enrollment cannot proceed.",
			);
		}

		// 2. Lock section row for update to ensure concurrency safety
		const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
			SELECT "id" FROM "Section" WHERE "id" = ${payload.sectionId}::uuid FOR UPDATE
		`;

		if (!locked) {
			throw new AppError(httpStatus.NOT_FOUND, "Course section not found");
		}

		// Fetch the full section with course and semester relations
		const section = await tx.section.findUnique({
			where: { id: payload.sectionId },
			include: {
				course: true,
				semester: true,
			},
		});

		if (!section) {
			throw new AppError(httpStatus.NOT_FOUND, "Course section not found");
		}

		// 3. Validate semester status and registration window
		const semester = section.semester;
		const now = new Date();

		if (semester.status !== "ACTIVE") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Enrollment is only allowed for an ACTIVE semester",
			);
		}

		if (semester.registrationStart && now < semester.registrationStart) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Registration window has not yet opened for this semester",
			);
		}

		if (semester.registrationEnd && now > semester.registrationEnd) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Registration window has closed for this semester",
			);
		}

		// 4. Check duplicate enrollment in this specific section
		const [existingRow] = await tx.$queryRaw<
			Array<{ id: string; status: string; deletedAt: Date | null }>
		>`
			SELECT "id", "status", "deletedAt" FROM "Enrollment"
			WHERE "studentId" = ${studentProfile.id}::uuid AND "sectionId" = ${section.id}::uuid
		`;

		if (
			existingRow &&
			existingRow.status === "ENROLLED" &&
			existingRow.deletedAt === null
		) {
			throw new AppError(
				httpStatus.CONFLICT,
				"You are already actively enrolled in this section",
			);
		}

		// 5. Check if already enrolled in another section of the same course in this semester
		const sameCourseEnrollment = await tx.enrollment.findFirst({
			where: {
				studentId: studentProfile.id,
				status: "ENROLLED",
				section: {
					courseId: section.courseId,
					semesterId: section.semesterId,
				},
			},
			include: {
				section: {
					select: {
						sectionNumber: true,
					},
				},
			},
		});

		if (sameCourseEnrollment) {
			throw new AppError(
				httpStatus.CONFLICT,
				`Already enrolled in section '${sameCourseEnrollment.section.sectionNumber}' of this course for this semester`,
			);
		}

		// 6. Check prerequisite requirements
		const prerequisites = await tx.coursePrerequisite.findMany({
			where: { courseId: section.courseId },
			include: {
				prerequisite: {
					select: {
						id: true,
						code: true,
						title: true,
					},
				},
			},
		});

		if (prerequisites.length > 0) {
			for (const item of prerequisites) {
				const completedPrereq = await tx.enrollment.findFirst({
					where: {
						studentId: studentProfile.id,
						status: "COMPLETED",
						section: {
							courseId: item.prerequisiteId,
						},
					},
				});

				if (!completedPrereq) {
					throw new AppError(
						httpStatus.BAD_REQUEST,
						`Prerequisite requirement not satisfied: Course ${item.prerequisite.code} (${item.prerequisite.title}) must be completed before enrolling`,
					);
				}
			}
		}

		// 7. Check section capacity
		if (section.enrolledCount >= section.capacity) {
			throw new AppError(
				httpStatus.CONFLICT,
				"This course section has reached its maximum enrollment capacity",
			);
		}

		// 8. Fetch student's existing active enrollments for this semester to check credits & schedule
		const activeSemesterEnrollments = await tx.enrollment.findMany({
			where: {
				studentId: studentProfile.id,
				status: "ENROLLED",
				section: {
					semesterId: section.semesterId,
				},
			},
			include: {
				section: {
					include: {
						course: {
							select: {
								id: true,
								code: true,
								title: true,
								credits: true,
							},
						},
					},
				},
			},
		});

		// Calculate total credits including target course
		const currentCredits = activeSemesterEnrollments.reduce(
			(sum, item) => sum + item.section.course.credits,
			0,
		);

		if (
			currentCredits + section.course.credits >
			config.maxCreditsPerSemester
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Enrollment exceeds maximum credit limit of ${config.maxCreditsPerSemester} credits for this semester (current: ${currentCredits}, attempted course: ${section.course.credits})`,
			);
		}

		// 9. Check class schedule conflicts with enrolled sections
		const targetSchedule: TScheduleSlot[] = Array.isArray(section.schedule)
			? (section.schedule as unknown as TScheduleSlot[])
			: [];

		for (const enrolled of activeSemesterEnrollments) {
			const enrolledSchedule: TScheduleSlot[] = Array.isArray(
				enrolled.section.schedule,
			)
				? (enrolled.section.schedule as unknown as TScheduleSlot[])
				: [];

			for (const tSlot of targetSchedule) {
				for (const eSlot of enrolledSchedule) {
					const hasOverlap =
						tSlot.day === eSlot.day &&
						tSlot.startTime < eSlot.endTime &&
						tSlot.endTime > eSlot.startTime;

					if (hasOverlap) {
						throw new AppError(
							httpStatus.CONFLICT,
							`Schedule conflict: Section ${section.sectionNumber} overlaps with enrolled course ${enrolled.section.course.code} (Section ${enrolled.section.sectionNumber}) on ${tSlot.day} (${eSlot.startTime}-${eSlot.endTime})`,
						);
					}
				}
			}
		}

		// 10. Check unpaid invoice block (guarded until Invoice model is introduced in Commit 18)
		if (config.enrollmentBlockOnUnpaid && "invoice" in tx) {
			const unpaid = await (
				tx as unknown as {
					invoice: { findFirst: (args: unknown) => Promise<unknown> };
				}
			).invoice.findFirst({
				where: {
					studentId: studentProfile.id,
					status: { in: ["PENDING", "OVERDUE"] },
				},
			});
			if (unpaid) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"Outstanding unpaid invoices prevent new course enrollment",
				);
			}
		}

		// 11. Increment section's enrolled count
		await tx.section.update({
			where: { id: section.id },
			data: {
				enrolledCount: { increment: 1 },
			},
		});

		// 12. Create or reactivate enrollment record
		const enrollment = existingRow
			? await tx.enrollment.update({
					where: { id: existingRow.id },
					data: {
						status: "ENROLLED",
						enrolledAt: new Date(),
						droppedAt: null,
						deletedAt: null,
					},
					include: enrollmentInclude,
				})
			: await tx.enrollment.create({
					data: {
						studentId: studentProfile.id,
						sectionId: section.id,
						status: "ENROLLED",
					},
					include: enrollmentInclude,
				});

		// 13. Record audit log entry
		await createAuditLog(tx, {
			actorId: userId,
			action: "ENROLL",
			entity: "Enrollment",
			entityId: enrollment.id,
			after: {
				studentId: studentProfile.id,
				sectionId: section.id,
				status: enrollment.status,
				enrolledAt: enrollment.enrolledAt,
			},
			ip,
		});

		return enrollment;
	});
};

/**
 * Drop an enrollment for the authenticated student within the allowed drop window.
 *
 * Transactional Validations:
 * 1. Authenticated user has an ACTIVE student profile.
 * 2. Enrollment exists and belongs to the requesting student.
 * 3. Enrollment status must be ENROLLED (cannot drop if already DROPPED or COMPLETED).
 * 4. Associated semester is ACTIVE and drop window has not closed (registrationEnd).
 * 5. Section's enrolledCount is decremented by 1.
 * 6. Enrollment status is updated to DROPPED with droppedAt timestamp.
 * 7. Audit log is recorded for the drop action.
 *
 * @param enrollmentId ID of the enrollment record to drop
 * @param userId ID of the authenticated user (must own this enrollment)
 * @param ip Optional client IP address
 */
const dropEnrollment = async (
	enrollmentId: string,
	userId: string,
	ip?: string,
) => {
	return prisma.$transaction(async (tx) => {
		// 1. Identify StudentProfile for the requesting user
		const studentProfile = await tx.studentProfile.findUnique({
			where: { userId },
		});

		if (!studentProfile) {
			throw new AppError(
				httpStatus.NOT_FOUND,
				"Student profile not found for authenticated user",
			);
		}

		// 2. Fetch enrollment with section and semester
		const enrollment = await tx.enrollment.findUnique({
			where: { id: enrollmentId },
			include: {
				section: {
					include: {
						semester: true,
						course: {
							select: {
								id: true,
								code: true,
								title: true,
								credits: true,
							},
						},
					},
				},
			},
		});

		if (!enrollment) {
			throw new AppError(httpStatus.NOT_FOUND, "Enrollment record not found");
		}

		// 3. Verify ownership: must belong to the requesting student
		if (enrollment.studentId !== studentProfile.id) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not authorized to drop this enrollment",
			);
		}

		// 4. Verify enrollment status is ENROLLED
		if (enrollment.status === "DROPPED") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Enrollment has already been dropped",
			);
		}

		if (enrollment.status === "COMPLETED") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Completed course enrollment cannot be dropped",
			);
		}

		if (enrollment.status !== "ENROLLED") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Enrollment with status '${enrollment.status}' cannot be dropped`,
			);
		}

		// 5. Check semester and drop deadline
		const semester = enrollment.section.semester;
		const now = new Date();

		if (semester.status !== "ACTIVE") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Cannot drop course from an inactive semester",
			);
		}

		if (semester.registrationEnd && now > semester.registrationEnd) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Course drop deadline has passed for this semester",
			);
		}

		// 6. Lock section row and decrement enrolledCount
		await tx.$queryRaw<Array<{ id: string }>>`
			SELECT "id" FROM "Section" WHERE "id" = ${enrollment.sectionId}::uuid FOR UPDATE
		`;

		if (enrollment.section.enrolledCount > 0) {
			await tx.section.update({
				where: { id: enrollment.sectionId },
				data: {
					enrolledCount: { decrement: 1 },
				},
			});
		}

		// 7. Update enrollment status to DROPPED
		const updatedEnrollment = await tx.enrollment.update({
			where: { id: enrollment.id },
			data: {
				status: "DROPPED",
				droppedAt: now,
			},
			include: enrollmentInclude,
		});

		// 8. Create audit log
		await createAuditLog(tx, {
			actorId: userId,
			action: "DROP",
			entity: "Enrollment",
			entityId: enrollment.id,
			before: {
				status: enrollment.status,
			},
			after: {
				status: "DROPPED",
				droppedAt: now,
			},
			ip,
		});

		return updatedEnrollment;
	});
};

/**
 * Retrieve a paginated list of enrollments for the authenticated student.
 * Supports filtering by semesterId and enrollment status.
 *
 * @param options Query filters including page, limit, sortBy, order, semesterId, status
 * @param userId ID of the authenticated user (student)
 */
const getMyEnrollments = async (
	options: TMyEnrollmentsFilterOptions,
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
		"enrolledAt",
	);

	const where: Prisma.EnrollmentWhereInput = {
		studentId: studentProfile.id,
		deletedAt: null,
		...(options.status && { status: options.status }),
		...(options.semesterId && {
			section: {
				semesterId: options.semesterId,
			},
		}),
	};

	const [total, data] = await Promise.all([
		prisma.enrollment.count({ where }),
		prisma.enrollment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: order },
			include: {
				section: {
					include: {
						course: {
							select: {
								id: true,
								code: true,
								title: true,
								credits: true,
							},
						},
						semester: {
							select: {
								id: true,
								name: true,
								year: true,
								term: true,
								status: true,
							},
						},
						instructor: {
							select: {
								id: true,
								employeeId: true,
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
					},
				},
			},
		}),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return { meta, data };
};

/**
 * Retrieve student roster for a section.
 * - ADMIN can view any section roster.
 * - INSTRUCTOR can only view roster for sections assigned to them.
 *
 * @param sectionId ID of the course section
 * @param options Query filters including page, limit, sortBy, order, status
 * @param user Authenticated user info (id, role)
 */
const getSectionStudents = async (
	sectionId: string,
	options: TSectionStudentsFilterOptions,
	user: { id: string; role: Role },
) => {
	const section = await prisma.section.findUnique({
		where: { id: sectionId },
		include: {
			instructor: true,
		},
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
		"enrolledAt",
	);

	const where: Prisma.EnrollmentWhereInput = {
		sectionId,
		deletedAt: null,
		...(options.status && { status: options.status }),
	};

	const [total, data] = await Promise.all([
		prisma.enrollment.count({ where }),
		prisma.enrollment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: order },
			include: {
				student: {
					select: {
						id: true,
						studentId: true,
						enrollmentYear: true,
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
		}),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return { meta, data };
};

export const enrollmentService = {
	enrollSection,
	dropEnrollment,
	getMyEnrollments,
	getSectionStudents,
};
