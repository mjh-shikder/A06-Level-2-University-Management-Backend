import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import type {
	TEnrollSectionPayload,
	TScheduleSlot,
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

export const enrollmentService = {
	enrollSection,
};
