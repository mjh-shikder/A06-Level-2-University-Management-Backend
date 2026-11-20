import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import { buildSearchWhere } from "../../utils/buildWhere";
import { buildPaginationMeta, calculatePagination } from "../../utils/paginate";
import type {
	TAssignInstructorPayload,
	TCreateSectionPayload,
	TSectionFilterOptions,
	TUpdateSectionPayload,
} from "./section.interface";

/**
 * Common relations to include when retrieving sections.
 */
const sectionInclude = {
	course: {
		select: {
			id: true,
			title: true,
			code: true,
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
} as const;

/**
 * Create a new course section under a course and semester with audit logging.
 */
const createSection = async (
	payload: TCreateSectionPayload,
	actorId: string,
	ip?: string,
) => {
	// Verify course exists
	const course = await prisma.course.findUnique({
		where: { id: payload.courseId },
	});
	if (!course) {
		throw new AppError(httpStatus.NOT_FOUND, "Course not found");
	}

	// Verify semester exists
	const semester = await prisma.semester.findUnique({
		where: { id: payload.semesterId },
	});
	if (!semester) {
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
	}

	// If instructor assigned, verify instructor exists
	if (payload.instructorId) {
		const instructor = await prisma.instructorProfile.findUnique({
			where: { id: payload.instructorId },
		});
		if (!instructor) {
			throw new AppError(httpStatus.NOT_FOUND, "Instructor not found");
		}
	}

	// Verify sectionNumber uniqueness within course and semester
	const existing = await prisma.section.findUnique({
		where: {
			courseId_semesterId_sectionNumber: {
				courseId: payload.courseId,
				semesterId: payload.semesterId,
				sectionNumber: payload.sectionNumber,
			},
		},
	});

	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			`Section '${payload.sectionNumber}' already exists for this course in the specified semester`,
		);
	}

	return prisma.$transaction(async (tx) => {
		const section = await tx.section.create({
			data: {
				sectionNumber: payload.sectionNumber,
				courseId: payload.courseId,
				semesterId: payload.semesterId,
				instructorId: payload.instructorId ?? null,
				capacity: payload.capacity,
				enrolledCount: 0,
				schedule: payload.schedule,
				room: payload.room,
			},
			include: sectionInclude,
		});

		await createAuditLog(tx, {
			actorId,
			action: "SECTION_CREATE",
			entity: "Section",
			entityId: section.id,
			after: {
				sectionNumber: section.sectionNumber,
				courseId: section.courseId,
				semesterId: section.semesterId,
				instructorId: section.instructorId,
				capacity: section.capacity,
				room: section.room,
			},
			ip,
		});

		return section;
	});
};

/**
 * Retrieve paginated list of sections with optional semester, course, instructor filters.
 */
const getSections = async (options: TSectionFilterOptions) => {
	const { page, limit, skip, sortBy, order } = calculatePagination(
		options,
		"createdAt",
	);

	const searchConditions = buildSearchWhere(options.q, [
		"sectionNumber",
		"room",
	]);
	const where: Prisma.SectionWhereInput = {
		...searchConditions,
		...(options.semesterId && { semesterId: options.semesterId }),
		...(options.courseId && { courseId: options.courseId }),
		...(options.instructorId && { instructorId: options.instructorId }),
	};

	const [sections, total] = await Promise.all([
		prisma.section.findMany({
			where,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: order,
			},
			include: sectionInclude,
		}),
		prisma.section.count({ where }),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return {
		meta,
		data: sections,
	};
};

/**
 * Retrieve a single section by its unique ID.
 */
const getSectionById = async (id: string) => {
	const section = await prisma.section.findUnique({
		where: { id },
		include: sectionInclude,
	});

	if (!section) {
		throw new AppError(httpStatus.NOT_FOUND, "Section not found");
	}

	return section;
};

/**
 * Update section details with capacity and section number validations.
 */
const updateSection = async (
	id: string,
	payload: TUpdateSectionPayload,
	actorId: string,
	ip?: string,
) => {
	const existing = await prisma.section.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Section not found");
	}

	// Validate capacity is not less than already enrolled students
	if (
		payload.capacity !== undefined &&
		payload.capacity < existing.enrolledCount
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Capacity cannot be less than current enrolled count (${existing.enrolledCount})`,
		);
	}

	// If instructor assigned, verify instructor exists
	if (payload.instructorId !== undefined && payload.instructorId !== null) {
		const instructor = await prisma.instructorProfile.findUnique({
			where: { id: payload.instructorId },
		});
		if (!instructor) {
			throw new AppError(httpStatus.NOT_FOUND, "Instructor not found");
		}
	}

	// If sectionNumber changed, verify uniqueness
	if (
		payload.sectionNumber &&
		payload.sectionNumber !== existing.sectionNumber
	) {
		const conflict = await prisma.section.findUnique({
			where: {
				courseId_semesterId_sectionNumber: {
					courseId: existing.courseId,
					semesterId: existing.semesterId,
					sectionNumber: payload.sectionNumber,
				},
			},
		});

		if (conflict && conflict.id !== id) {
			throw new AppError(
				httpStatus.CONFLICT,
				`Section '${payload.sectionNumber}' already exists for this course in the specified semester`,
			);
		}
	}

	return prisma.$transaction(async (tx) => {
		const updated = await tx.section.update({
			where: { id },
			data: {
				...(payload.sectionNumber !== undefined && {
					sectionNumber: payload.sectionNumber,
				}),
				...(payload.instructorId !== undefined && {
					instructorId: payload.instructorId,
				}),
				...(payload.capacity !== undefined && {
					capacity: payload.capacity,
				}),
				...(payload.schedule !== undefined && {
					schedule: payload.schedule,
				}),
				...(payload.room !== undefined && { room: payload.room }),
			},
			include: sectionInclude,
		});

		await createAuditLog(tx, {
			actorId,
			action: "SECTION_UPDATE",
			entity: "Section",
			entityId: id,
			before: {
				sectionNumber: existing.sectionNumber,
				instructorId: existing.instructorId,
				capacity: existing.capacity,
				room: existing.room,
			},
			after: {
				sectionNumber: updated.sectionNumber,
				instructorId: updated.instructorId,
				capacity: updated.capacity,
				room: updated.room,
			},
			ip,
		});

		return updated;
	});
};

/**
 * Assign, reassign, or unassign an instructor for a section.
 */
const assignInstructor = async (
	id: string,
	payload: TAssignInstructorPayload,
	actorId: string,
	ip?: string,
) => {
	const existing = await prisma.section.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Section not found");
	}

	if (payload.instructorId !== null) {
		const instructor = await prisma.instructorProfile.findUnique({
			where: { id: payload.instructorId },
		});
		if (!instructor) {
			throw new AppError(httpStatus.NOT_FOUND, "Instructor not found");
		}
	}

	return prisma.$transaction(async (tx) => {
		const updated = await tx.section.update({
			where: { id },
			data: { instructorId: payload.instructorId },
			include: sectionInclude,
		});

		await createAuditLog(tx, {
			actorId,
			action: "SECTION_INSTRUCTOR_ASSIGN",
			entity: "Section",
			entityId: id,
			before: { instructorId: existing.instructorId },
			after: { instructorId: payload.instructorId },
			ip,
		});

		return updated;
	});
};

/**
 * Soft delete a section and record the event in audit logs.
 */
const deleteSection = async (id: string, actorId: string, ip?: string) => {
	const existing = await prisma.section.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Section not found");
	}

	if (existing.enrolledCount > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete section with active enrollments",
		);
	}

	return prisma.$transaction(async (tx) => {
		const deleted = await tx.section.update({
			where: { id },
			data: { deletedAt: new Date() },
		});

		await createAuditLog(tx, {
			actorId,
			action: "SECTION_DELETE",
			entity: "Section",
			entityId: id,
			before: {
				sectionNumber: existing.sectionNumber,
				courseId: existing.courseId,
				semesterId: existing.semesterId,
			},
			after: {
				deletedAt: deleted.deletedAt,
			},
			ip,
		});

		return deleted;
	});
};

export const sectionService = {
	createSection,
	getSections,
	getSectionById,
	updateSection,
	assignInstructor,
	deleteSection,
};
