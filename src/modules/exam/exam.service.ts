import httpStatus from "http-status";
import type { Prisma, Role } from "../../../generated/prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import { buildPaginationMeta, calculatePagination } from "../../utils/paginate";
import type {
	TBulkEnterMarksPayload,
	TCreateExamPayload,
	TExamFilterOptions,
	TExamMarkFilterOptions,
	TUpdateExamPayload,
} from "./exam.interface";

/**
 * Create a new exam under a course section.
 * - Enforces that an INSTRUCTOR can only create exams for their assigned section.
 * - ADMIN can create exams for any section.
 * - Validates that the sum of exam weightPercent in the section does not exceed 100%.
 * - Records an audit log entry.
 *
 * @param sectionId ID of the course section
 * @param payload Exam details (title, weightPercent, maxMarks, examDate)
 * @param user Authenticated user info
 * @param ip Optional client IP
 */
const createExam = async (
	sectionId: string,
	payload: TCreateExamPayload,
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

		// 3. Weight validation: sum of all exams in section cannot exceed 100%
		const existingExams = await tx.exam.findMany({
			where: { sectionId },
			select: { weightPercent: true },
		});

		const currentWeightTotal = existingExams.reduce(
			(sum, e) => sum + Number(e.weightPercent),
			0,
		);

		const newWeight = Number(payload.weightPercent);

		if (currentWeightTotal + newWeight > 100.0001) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Total exam weight cannot exceed 100% (current total: ${currentWeightTotal}%, attempted: ${newWeight}%)`,
			);
		}

		// 4. Create exam
		const exam = await tx.exam.create({
			data: {
				sectionId,
				title: payload.title,
				weightPercent: payload.weightPercent,
				maxMarks: payload.maxMarks,
				examDate: payload.examDate ? new Date(payload.examDate) : null,
			},
		});

		// 5. Create audit log
		await createAuditLog(tx, {
			actorId: user.id,
			action: "EXAM_CREATE",
			entity: "Exam",
			entityId: exam.id,
			after: {
				sectionId,
				title: exam.title,
				weightPercent: Number(exam.weightPercent),
				maxMarks: Number(exam.maxMarks),
			},
			ip,
		});

		return exam;
	});
};

/**
 * Retrieve paginated list of exams for a course section.
 *
 * @param sectionId ID of the course section
 * @param options Query and pagination options
 * @param user Authenticated user info
 */
const getSectionExams = async (
	sectionId: string,
	options: TExamFilterOptions,
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

	const where: Prisma.ExamWhereInput = {
		sectionId,
	};

	const [total, data] = await Promise.all([
		prisma.exam.count({ where }),
		prisma.exam.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: order },
			include: {
				_count: {
					select: { examMarks: true },
				},
			},
		}),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return { meta, data };
};

/**
 * Retrieve a single exam by ID.
 *
 * @param id ID of the exam
 * @param user Authenticated user info
 */
const getExamById = async (id: string, user: { id: string; role: Role }) => {
	const exam = await prisma.exam.findUnique({
		where: { id },
		include: {
			section: true,
			_count: {
				select: { examMarks: true },
			},
		},
	});

	if (!exam) {
		throw new AppError(httpStatus.NOT_FOUND, "Exam not found");
	}

	if (user.role === "INSTRUCTOR") {
		const instructorProfile = await prisma.instructorProfile.findUnique({
			where: { userId: user.id },
		});

		if (
			!instructorProfile ||
			exam.section.instructorId !== instructorProfile.id
		) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not assigned as the instructor for this section",
			);
		}
	}

	return exam;
};

/**
 * Update exam details.
 * - Enforces that total weightPercent does not exceed 100%.
 * - If maxMarks is decreased, ensures no already entered mark exceeds new maxMarks.
 * - Records an audit log entry.
 *
 * @param id ID of the exam
 * @param payload Update payload
 * @param user Authenticated user info
 * @param ip Optional client IP
 */
const updateExam = async (
	id: string,
	payload: TUpdateExamPayload,
	user: { id: string; role: Role },
	ip?: string,
) => {
	return prisma.$transaction(async (tx) => {
		const exam = await tx.exam.findUnique({
			where: { id },
			include: { section: true },
		});

		if (!exam) {
			throw new AppError(httpStatus.NOT_FOUND, "Exam not found");
		}

		if (user.role === "INSTRUCTOR") {
			const instructorProfile = await tx.instructorProfile.findUnique({
				where: { userId: user.id },
			});

			if (
				!instructorProfile ||
				exam.section.instructorId !== instructorProfile.id
			) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"You are not assigned as the instructor for this section",
				);
			}
		}

		// Lock rule: marks cannot be edited if results are already published
		const publishedResult = await tx.result.findFirst({
			where: {
				enrollment: { sectionId: exam.sectionId },
				status: "PUBLISHED",
			},
		});

		if (publishedResult) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Cannot modify marks: results for this section have already been published",
			);
		}

		// Weight validation if updating weightPercent
		if (payload.weightPercent !== undefined) {
			const otherExams = await tx.exam.findMany({
				where: {
					sectionId: exam.sectionId,
					id: { not: id },
				},
				select: { weightPercent: true },
			});

			const otherWeightTotal = otherExams.reduce(
				(sum, e) => sum + Number(e.weightPercent),
				0,
			);

			const newWeight = Number(payload.weightPercent);

			if (otherWeightTotal + newWeight > 100.0001) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					`Total exam weight cannot exceed 100% (other exams: ${otherWeightTotal}%, attempted: ${newWeight}%)`,
				);
			}
		}

		// Validate maxMarks against existing marks
		if (payload.maxMarks !== undefined) {
			const higherMark = await tx.examMark.findFirst({
				where: {
					examId: id,
					obtainedMarks: { gt: payload.maxMarks },
				},
			});

			if (higherMark) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					`Cannot reduce maxMarks to ${payload.maxMarks} because a student has higher obtained marks (${higherMark.obtainedMarks})`,
				);
			}
		}

		const updatedExam = await tx.exam.update({
			where: { id },
			data: {
				...(payload.title !== undefined && { title: payload.title }),
				...(payload.weightPercent !== undefined && {
					weightPercent: payload.weightPercent,
				}),
				...(payload.maxMarks !== undefined && {
					maxMarks: payload.maxMarks,
				}),
				...(payload.examDate !== undefined && {
					examDate: payload.examDate ? new Date(payload.examDate) : null,
				}),
			},
		});

		await createAuditLog(tx, {
			actorId: user.id,
			action: "EXAM_UPDATE",
			entity: "Exam",
			entityId: id,
			before: {
				title: exam.title,
				weightPercent: Number(exam.weightPercent),
				maxMarks: Number(exam.maxMarks),
				examDate: exam.examDate,
			},
			after: {
				title: updatedExam.title,
				weightPercent: Number(updatedExam.weightPercent),
				maxMarks: Number(updatedExam.maxMarks),
				examDate: updatedExam.examDate,
			},
			ip,
		});

		return updatedExam;
	});
};

/**
 * Delete an exam.
 * Enforces hard delete only when no marks have been entered for this exam.
 *
 * @param id ID of the exam
 * @param user Authenticated user info
 * @param ip Optional client IP
 */
const deleteExam = async (
	id: string,
	user: { id: string; role: Role },
	ip?: string,
) => {
	return prisma.$transaction(async (tx) => {
		const exam = await tx.exam.findUnique({
			where: { id },
			include: { section: true },
		});

		if (!exam) {
			throw new AppError(httpStatus.NOT_FOUND, "Exam not found");
		}

		if (user.role === "INSTRUCTOR") {
			const instructorProfile = await tx.instructorProfile.findUnique({
				where: { userId: user.id },
			});

			if (
				!instructorProfile ||
				exam.section.instructorId !== instructorProfile.id
			) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"You are not assigned as the instructor for this section",
				);
			}
		}

		// Ensure no marks entered
		const marksCount = await tx.examMark.count({
			where: { examId: id },
		});

		if (marksCount > 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Cannot delete exam with ${marksCount} existing student mark(s). Remove all marks before deleting.`,
			);
		}

		await tx.exam.delete({
			where: { id },
		});

		await createAuditLog(tx, {
			actorId: user.id,
			action: "EXAM_DELETE",
			entity: "Exam",
			entityId: id,
			before: {
				sectionId: exam.sectionId,
				title: exam.title,
			},
			ip,
		});

		return { id, message: "Exam deleted successfully" };
	});
};

/**
 * Bulk enter marks for students in an exam.
 * - Validates that obtainedMarks does not exceed exam's maxMarks.
 * - Validates that all enrollment IDs belong to the exam's section.
 * - Upserts marks records atomically.
 * - Records an audit log entry.
 *
 * @param examId ID of the exam
 * @param payload List of student mark entries
 * @param user Authenticated user info
 * @param ip Optional client IP
 */
const bulkEnterMarks = async (
	examId: string,
	payload: TBulkEnterMarksPayload,
	user: { id: string; role: Role },
	ip?: string,
) => {
	return prisma.$transaction(async (tx) => {
		const exam = await tx.exam.findUnique({
			where: { id: examId },
			include: { section: true },
		});

		if (!exam) {
			throw new AppError(httpStatus.NOT_FOUND, "Exam not found");
		}

		if (user.role === "INSTRUCTOR") {
			const instructorProfile = await tx.instructorProfile.findUnique({
				where: { userId: user.id },
			});

			if (
				!instructorProfile ||
				exam.section.instructorId !== instructorProfile.id
			) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"You are not assigned as the instructor for this section",
				);
			}
		}

		// Lock rule: marks cannot be edited if results are already published
		const publishedResult = await tx.result.findFirst({
			where: {
				enrollment: { sectionId: exam.sectionId },
				status: "PUBLISHED",
			},
		});

		if (publishedResult) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Cannot modify marks: results for this section have already been published",
			);
		}

		const maxMarksNum = Number(exam.maxMarks);

		// Validate obtained marks <= maxMarks
		for (const item of payload.marks) {
			if (item.obtainedMarks > maxMarksNum) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					`Obtained marks (${item.obtainedMarks}) cannot exceed exam maximum marks (${maxMarksNum})`,
				);
			}
		}

		// Verify all enrollment IDs belong to this section
		const enrollmentIds = [
			...new Set(payload.marks.map((item) => item.enrollmentId)),
		];

		const validEnrollments = await tx.enrollment.findMany({
			where: {
				id: { in: enrollmentIds },
				sectionId: exam.sectionId,
				deletedAt: null,
			},
			select: { id: true },
		});

		if (validEnrollments.length !== enrollmentIds.length) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"One or more enrollments do not belong to this course section or do not exist",
			);
		}

		// Upsert marks
		const upsertOps = payload.marks.map((item) =>
			tx.examMark.upsert({
				where: {
					examId_enrollmentId: {
						examId: exam.id,
						enrollmentId: item.enrollmentId,
					},
				},
				update: {
					obtainedMarks: item.obtainedMarks,
				},
				create: {
					examId: exam.id,
					enrollmentId: item.enrollmentId,
					obtainedMarks: item.obtainedMarks,
				},
			}),
		);

		const results = await Promise.all(upsertOps);

		await createAuditLog(tx, {
			actorId: user.id,
			action: "EXAM_MARKS_ENTRY",
			entity: "Exam",
			entityId: exam.id,
			after: {
				count: results.length,
			},
			ip,
		});

		return {
			count: results.length,
			records: results,
		};
	});
};

/**
 * Retrieve paginated list of marks entered for an exam.
 *
 * @param examId ID of the exam
 * @param options Query and pagination options
 * @param user Authenticated user info
 */
const getExamMarks = async (
	examId: string,
	options: TExamMarkFilterOptions,
	user: { id: string; role: Role },
) => {
	const exam = await prisma.exam.findUnique({
		where: { id: examId },
		include: { section: true },
	});

	if (!exam) {
		throw new AppError(httpStatus.NOT_FOUND, "Exam not found");
	}

	if (user.role === "INSTRUCTOR") {
		const instructorProfile = await prisma.instructorProfile.findUnique({
			where: { userId: user.id },
		});

		if (
			!instructorProfile ||
			exam.section.instructorId !== instructorProfile.id
		) {
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

	const where: Prisma.ExamMarkWhereInput = {
		examId,
	};

	const [total, data] = await Promise.all([
		prisma.examMark.count({ where }),
		prisma.examMark.findMany({
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
			},
		}),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return {
		exam: {
			id: exam.id,
			title: exam.title,
			weightPercent: Number(exam.weightPercent),
			maxMarks: Number(exam.maxMarks),
			sectionId: exam.sectionId,
		},
		meta,
		data,
	};
};

export const examService = {
	createExam,
	getSectionExams,
	getExamById,
	updateExam,
	deleteExam,
	bulkEnterMarks,
	getExamMarks,
};
