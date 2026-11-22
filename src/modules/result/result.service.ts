import httpStatus from "http-status";
import type { Prisma, Role } from "../../../generated/prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import { computeGrade } from "../../utils/grading";
import { buildPaginationMeta, calculatePagination } from "../../utils/paginate";
import type {
	TComputeResultsResult,
	TMyResultsFilterOptions,
	TPublishResultsResult,
	TResultFilterOptions,
	TUnpublishResultsResult,
} from "./result.interface";

/**
 * Compute draft grades for all enrollments in a course section based on exam marks.
 *
 * Algorithm per enrollment:
 * 1. Gather all ExamMarks for the enrollment.
 * 2. For each exam: weightedScore = (obtainedMarks / maxMarks) * weightPercent.
 * 3. totalWeightedPercent = sum(weightedScore).
 * 4. Determine letter grade and grade point via grading scale.
 * 5. Upsert Result row with status: "DRAFT".
 *
 * @param sectionId ID of the course section
 * @param user Authenticated user info
 * @param ip Optional client IP
 */
const computeSectionResults = async (
	sectionId: string,
	user: { id: string; role: Role },
	ip?: string,
): Promise<TComputeResultsResult> => {
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

		// 3. Verify results are not already published
		const publishedCount = await tx.result.count({
			where: {
				enrollment: { sectionId },
				status: "PUBLISHED",
			},
		});

		if (publishedCount > 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Results for this section are already published. Unpublish them before recomputing.",
			);
		}

		// 4. Fetch all exams for this section
		const exams = await tx.exam.findMany({
			where: { sectionId },
			select: { id: true, weightPercent: true, maxMarks: true },
		});

		if (exams.length === 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Cannot compute results: no exams exist for this course section",
			);
		}

		// 5. Fetch all active or completed enrollments for this section
		const enrollments = await tx.enrollment.findMany({
			where: {
				sectionId,
				status: { in: ["ENROLLED", "COMPLETED"] },
				deletedAt: null,
			},
			include: {
				examMarks: {
					include: {
						exam: true,
					},
				},
			},
		});

		if (enrollments.length === 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"No enrollments found for this course section",
			);
		}

		// 6. Compute weighted score for each enrollment
		const upsertOperations = enrollments.map((enrollment) => {
			let totalWeightedPercent = 0;

			for (const mark of enrollment.examMarks) {
				const maxMarks = Number(mark.exam.maxMarks);
				const weight = Number(mark.exam.weightPercent);
				const obtained = Number(mark.obtainedMarks ?? 0);

				if (maxMarks > 0) {
					totalWeightedPercent += (obtained / maxMarks) * weight;
				}
			}

			// Clamp and round to 2 decimals
			totalWeightedPercent = Math.round(totalWeightedPercent * 100) / 100;
			totalWeightedPercent = Math.max(0, Math.min(100, totalWeightedPercent));

			const grade = computeGrade(totalWeightedPercent);

			return tx.result.upsert({
				where: { enrollmentId: enrollment.id },
				update: {
					totalWeightedPercent,
					letterGrade: grade.letter,
					gradePoint: grade.point,
					status: "DRAFT",
				},
				create: {
					enrollmentId: enrollment.id,
					totalWeightedPercent,
					letterGrade: grade.letter,
					gradePoint: grade.point,
					status: "DRAFT",
				},
			});
		});

		const results = await Promise.all(upsertOperations);

		// 7. Record audit log
		await createAuditLog(tx, {
			actorId: user.id,
			action: "RESULT_COMPUTE",
			entity: "Section",
			entityId: section.id,
			after: {
				computedCount: results.length,
			},
			ip,
		});

		return {
			sectionId,
			computedCount: results.length,
			records: results.map((r) => ({
				enrollmentId: r.enrollmentId,
				totalWeightedPercent: Number(r.totalWeightedPercent),
				letterGrade: r.letterGrade,
				gradePoint: Number(r.gradePoint),
				status: r.status,
			})),
		};
	});
};

/**
 * List computed results for a section (both DRAFT and PUBLISHED).
 *
 * @param sectionId ID of the course section
 * @param options Query and pagination options
 * @param user Authenticated user info
 */
const getSectionResults = async (
	sectionId: string,
	options: TResultFilterOptions,
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
		"createdAt",
	);

	const where: Prisma.ResultWhereInput = {
		enrollment: { sectionId },
		deletedAt: null,
		...(options.status && { status: options.status }),
	};

	const [total, data] = await Promise.all([
		prisma.result.count({ where }),
		prisma.result.findMany({
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
							},
						},
					},
				},
				publisher: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
					},
				},
			},
		}),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return { meta, data };
};

/**
 * Publish all DRAFT results for a section (ADMIN only).
 * Sets status: "PUBLISHED", publishedAt, publishedBy, and updates enrollment status to "COMPLETED".
 *
 * @param sectionId ID of the course section
 * @param user Authenticated admin user info
 * @param ip Optional client IP
 */
const publishSectionResults = async (
	sectionId: string,
	user: { id: string; role: Role },
	ip?: string,
): Promise<TPublishResultsResult> => {
	return prisma.$transaction(async (tx) => {
		const section = await tx.section.findUnique({
			where: { id: sectionId },
		});

		if (!section) {
			throw new AppError(httpStatus.NOT_FOUND, "Course section not found");
		}

		const draftResults = await tx.result.findMany({
			where: {
				enrollment: { sectionId },
				status: "DRAFT",
			},
			select: { id: true, enrollmentId: true },
		});

		if (draftResults.length === 0) {
			const anyResults = await tx.result.count({
				where: { enrollment: { sectionId } },
			});

			if (anyResults === 0) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					"No computed results found for this section. Please compute results before publishing.",
				);
			}

			throw new AppError(
				httpStatus.BAD_REQUEST,
				"All results for this section have already been published",
			);
		}

		const now = new Date();
		const resultIds = draftResults.map((r) => r.id);
		const enrollmentIds = draftResults.map((r) => r.enrollmentId);

		// Update results to PUBLISHED
		await tx.result.updateMany({
			where: { id: { in: resultIds } },
			data: {
				status: "PUBLISHED",
				publishedAt: now,
				publishedBy: user.id,
			},
		});

		// Mark enrollments as COMPLETED
		await tx.enrollment.updateMany({
			where: { id: { in: enrollmentIds } },
			data: {
				status: "COMPLETED",
			},
		});

		// Record audit log
		await createAuditLog(tx, {
			actorId: user.id,
			action: "RESULT_PUBLISH",
			entity: "Section",
			entityId: section.id,
			after: {
				publishedCount: draftResults.length,
				publishedAt: now,
			},
			ip,
		});

		return {
			sectionId,
			publishedCount: draftResults.length,
			publishedAt: now,
			publishedBy: user.id,
		};
	});
};

/**
 * Unpublish results for a section -> reverts back to DRAFT (ADMIN only).
 * Reverts enrollment status from COMPLETED back to ENROLLED.
 *
 * @param sectionId ID of the course section
 * @param user Authenticated admin user info
 * @param ip Optional client IP
 */
const unpublishSectionResults = async (
	sectionId: string,
	user: { id: string; role: Role },
	ip?: string,
): Promise<TUnpublishResultsResult> => {
	return prisma.$transaction(async (tx) => {
		const section = await tx.section.findUnique({
			where: { id: sectionId },
		});

		if (!section) {
			throw new AppError(httpStatus.NOT_FOUND, "Course section not found");
		}

		const publishedResults = await tx.result.findMany({
			where: {
				enrollment: { sectionId },
				status: "PUBLISHED",
			},
			select: { id: true, enrollmentId: true },
		});

		if (publishedResults.length === 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"No published results found for this section",
			);
		}

		const resultIds = publishedResults.map((r) => r.id);
		const enrollmentIds = publishedResults.map((r) => r.enrollmentId);

		// Revert results to DRAFT
		await tx.result.updateMany({
			where: { id: { in: resultIds } },
			data: {
				status: "DRAFT",
				publishedAt: null,
				publishedBy: null,
			},
		});

		// Revert completed enrollments back to ENROLLED
		await tx.enrollment.updateMany({
			where: {
				id: { in: enrollmentIds },
				status: "COMPLETED",
			},
			data: {
				status: "ENROLLED",
			},
		});

		// Record audit log
		await createAuditLog(tx, {
			actorId: user.id,
			action: "RESULT_UNPUBLISH",
			entity: "Section",
			entityId: section.id,
			after: {
				unpublishedCount: publishedResults.length,
			},
			ip,
		});

		return {
			sectionId,
			unpublishedCount: publishedResults.length,
		};
	});
};

/**
 * Retrieve a student's own published results.
 * Supports filtering by semesterId.
 *
 * @param options Pagination and semester filters
 * @param userId ID of the authenticated user (student)
 */
const getMyResults = async (
	options: TMyResultsFilterOptions,
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

	const where: Prisma.ResultWhereInput = {
		enrollment: {
			studentId: studentProfile.id,
			...(options.semesterId && {
				section: {
					semesterId: options.semesterId,
				},
			}),
		},
		status: "PUBLISHED",
		deletedAt: null,
	};

	const [total, data] = await Promise.all([
		prisma.result.count({ where }),
		prisma.result.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: order },
			include: {
				enrollment: {
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

export const resultService = {
	computeSectionResults,
	getSectionResults,
	publishSectionResults,
	unpublishSectionResults,
	getMyResults,
};
