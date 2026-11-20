import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import { buildSearchWhere } from "../../utils/buildWhere";
import { buildPaginationMeta, calculatePagination } from "../../utils/paginate";
import type {
	TAddPrerequisitePayload,
	TCreateCoursePayload,
	TCourseFilterOptions,
	TUpdateCoursePayload,
} from "./course.interface";

/**
 * Detect whether adding `prerequisiteId` as a prerequisite to `courseId` creates a circular dependency.
 * If we can reach `courseId` starting from `prerequisiteId` by following existing prerequisites, a cycle exists.
 */
const detectCycle = async (
	courseId: string,
	prerequisiteId: string,
): Promise<boolean> => {
	const visited = new Set<string>();
	const queue: string[] = [prerequisiteId];

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) {
			continue;
		}
		if (current === courseId) {
			return true;
		}
		if (visited.has(current)) {
			continue;
		}
		visited.add(current);

		const prereqs = await prisma.coursePrerequisite.findMany({
			where: { courseId: current },
			select: { prerequisiteId: true },
		});

		for (const p of prereqs) {
			if (!visited.has(p.prerequisiteId)) {
				queue.push(p.prerequisiteId);
			}
		}
	}

	return false;
};

/**
 * Create a new course under an existing academic program with audit logging.
 */
const createCourse = async (
	payload: TCreateCoursePayload,
	actorId: string,
	ip?: string,
) => {
	// Verify that the target program exists and is active
	const program = await prisma.program.findUnique({
		where: { id: payload.programId },
	});

	if (!program) {
		throw new AppError(httpStatus.NOT_FOUND, "Program not found");
	}

	// Verify course code uniqueness
	const existing = await prisma.course.findUnique({
		where: { code: payload.code },
	});

	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			`Course with code '${payload.code}' already exists`,
		);
	}

	return prisma.$transaction(async (tx) => {
		const course = await tx.course.create({
			data: {
				title: payload.title,
				code: payload.code,
				credits: payload.credits,
				programId: payload.programId,
				description: payload.description,
			},
			include: {
				program: {
					select: {
						id: true,
						name: true,
						code: true,
					},
				},
			},
		});

		await createAuditLog(tx, {
			actorId,
			action: "COURSE_CREATE",
			entity: "Course",
			entityId: course.id,
			after: {
				title: course.title,
				code: course.code,
				credits: course.credits,
				programId: course.programId,
				description: course.description,
			},
			ip,
		});

		return course;
	});
};

/**
 * Retrieve paginated list of courses with optional search, program filtering, and sorting.
 */
const getCourses = async (options: TCourseFilterOptions) => {
	const { page, limit, skip, sortBy, order } = calculatePagination(
		options,
		"createdAt",
	);

	const searchConditions = buildSearchWhere(options.q, ["title", "code"]);
	const where: Prisma.CourseWhereInput = {
		...searchConditions,
		...(options.programId && { programId: options.programId }),
	};

	const [courses, total] = await Promise.all([
		prisma.course.findMany({
			where,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: order,
			},
			include: {
				program: {
					select: {
						id: true,
						name: true,
						code: true,
					},
				},
				prerequisites: {
					select: {
						prerequisite: {
							select: {
								id: true,
								title: true,
								code: true,
								credits: true,
							},
						},
					},
				},
			},
		}),
		prisma.course.count({ where }),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return {
		meta,
		data: courses,
	};
};

/**
 * Retrieve a single course by its unique ID with linked program and prerequisites.
 */
const getCourseById = async (id: string) => {
	const course = await prisma.course.findUnique({
		where: { id },
		include: {
			program: {
				select: {
					id: true,
					name: true,
					code: true,
					department: {
						select: {
							id: true,
							name: true,
							code: true,
						},
					},
				},
			},
			prerequisites: {
				select: {
					prerequisite: {
						select: {
							id: true,
							title: true,
							code: true,
							credits: true,
						},
					},
				},
			},
			prerequisiteFor: {
				select: {
					course: {
						select: {
							id: true,
							title: true,
							code: true,
							credits: true,
						},
					},
				},
			},
		},
	});

	if (!course) {
		throw new AppError(httpStatus.NOT_FOUND, "Course not found");
	}

	return course;
};

/**
 * Update an existing course with duplicate code check and audit logging.
 */
const updateCourse = async (
	id: string,
	payload: TUpdateCoursePayload,
	actorId: string,
	ip?: string,
) => {
	const existing = await prisma.course.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Course not found");
	}

	if (payload.programId && payload.programId !== existing.programId) {
		const program = await prisma.program.findUnique({
			where: { id: payload.programId },
		});

		if (!program) {
			throw new AppError(httpStatus.NOT_FOUND, "Program not found");
		}
	}

	if (payload.code && payload.code !== existing.code) {
		const codeExists = await prisma.course.findUnique({
			where: { code: payload.code },
		});

		if (codeExists) {
			throw new AppError(
				httpStatus.CONFLICT,
				`Course code '${payload.code}' is already in use`,
			);
		}
	}

	return prisma.$transaction(async (tx) => {
		const updated = await tx.course.update({
			where: { id },
			data: {
				...(payload.title !== undefined && { title: payload.title }),
				...(payload.code !== undefined && { code: payload.code }),
				...(payload.credits !== undefined && { credits: payload.credits }),
				...(payload.programId !== undefined && {
					programId: payload.programId,
				}),
				...(payload.description !== undefined && {
					description: payload.description,
				}),
			},
			include: {
				program: {
					select: {
						id: true,
						name: true,
						code: true,
					},
				},
			},
		});

		await createAuditLog(tx, {
			actorId,
			action: "COURSE_UPDATE",
			entity: "Course",
			entityId: id,
			before: {
				title: existing.title,
				code: existing.code,
				credits: existing.credits,
				programId: existing.programId,
				description: existing.description,
			},
			after: {
				title: updated.title,
				code: updated.code,
				credits: updated.credits,
				programId: updated.programId,
				description: updated.description,
			},
			ip,
		});

		return updated;
	});
};

/**
 * Soft delete a course and record the event in audit logs.
 */
const deleteCourse = async (id: string, actorId: string, ip?: string) => {
	const existing = await prisma.course.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Course not found");
	}

	return prisma.$transaction(async (tx) => {
		const deleted = await tx.course.update({
			where: { id },
			data: { deletedAt: new Date() },
		});

		await createAuditLog(tx, {
			actorId,
			action: "COURSE_DELETE",
			entity: "Course",
			entityId: id,
			before: {
				title: existing.title,
				code: existing.code,
			},
			after: {
				deletedAt: deleted.deletedAt,
			},
			ip,
		});

		return deleted;
	});
};

/**
 * Add a prerequisite course to an existing course with cycle detection and audit logging.
 */
const addPrerequisite = async (
	courseId: string,
	payload: TAddPrerequisitePayload,
	actorId: string,
	ip?: string,
) => {
	const { prerequisiteId } = payload;

	// Check self-reference
	if (courseId === prerequisiteId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"A course cannot be its own prerequisite",
		);
	}

	// Verify target course exists
	const course = await prisma.course.findUnique({
		where: { id: courseId },
	});

	if (!course) {
		throw new AppError(httpStatus.NOT_FOUND, "Course not found");
	}

	// Verify prerequisite course exists
	const prerequisiteCourse = await prisma.course.findUnique({
		where: { id: prerequisiteId },
	});

	if (!prerequisiteCourse) {
		throw new AppError(httpStatus.NOT_FOUND, "Prerequisite course not found");
	}

	// Verify if link already exists
	const existingLink = await prisma.coursePrerequisite.findUnique({
		where: {
			courseId_prerequisiteId: {
				courseId,
				prerequisiteId,
			},
		},
	});

	if (existingLink) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Prerequisite already assigned to this course",
		);
	}

	// Check for circular dependency
	const hasCycle = await detectCycle(courseId, prerequisiteId);
	if (hasCycle) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Circular dependency detected: adding this prerequisite creates a cycle",
		);
	}

	return prisma.$transaction(async (tx) => {
		const created = await tx.coursePrerequisite.create({
			data: {
				courseId,
				prerequisiteId,
			},
			include: {
				prerequisite: {
					select: {
						id: true,
						title: true,
						code: true,
						credits: true,
					},
				},
			},
		});

		await createAuditLog(tx, {
			actorId,
			action: "COURSE_PREREQUISITE_ADD",
			entity: "CoursePrerequisite",
			entityId: `${courseId}_${prerequisiteId}`,
			after: {
				courseId,
				prerequisiteId,
			},
			ip,
		});

		return created;
	});
};

/**
 * Remove a prerequisite from a course and record the event in audit logs.
 */
const removePrerequisite = async (
	courseId: string,
	prerequisiteId: string,
	actorId: string,
	ip?: string,
) => {
	// Verify target course exists
	const course = await prisma.course.findUnique({
		where: { id: courseId },
	});

	if (!course) {
		throw new AppError(httpStatus.NOT_FOUND, "Course not found");
	}

	// Check if the prerequisite link exists
	const existingLink = await prisma.coursePrerequisite.findUnique({
		where: {
			courseId_prerequisiteId: {
				courseId,
				prerequisiteId,
			},
		},
	});

	if (!existingLink) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Prerequisite link not found for this course",
		);
	}

	return prisma.$transaction(async (tx) => {
		await tx.coursePrerequisite.delete({
			where: {
				courseId_prerequisiteId: {
					courseId,
					prerequisiteId,
				},
			},
		});

		await createAuditLog(tx, {
			actorId,
			action: "COURSE_PREREQUISITE_REMOVE",
			entity: "CoursePrerequisite",
			entityId: `${courseId}_${prerequisiteId}`,
			before: {
				courseId,
				prerequisiteId,
			},
			ip,
		});

		return null;
	});
};

export const courseService = {
	createCourse,
	getCourses,
	getCourseById,
	updateCourse,
	deleteCourse,
	addPrerequisite,
	removePrerequisite,
};
