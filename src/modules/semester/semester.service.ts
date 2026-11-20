import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import { buildSearchWhere } from "../../utils/buildWhere";
import { buildPaginationMeta, calculatePagination } from "../../utils/paginate";
import type {
	TCreateSemesterPayload,
	TSemesterFilterOptions,
	TUpdateSemesterPayload,
	TUpdateSemesterStatusPayload,
} from "./semester.interface";

/**
 * Create a new semester with validation, conflict checks, and audit logging.
 */
const createSemester = async (
	payload: TCreateSemesterPayload,
	actorId: string,
	ip?: string,
) => {
	// Verify (year, term) uniqueness
	const existing = await prisma.semester.findUnique({
		where: {
			year_term: {
				year: payload.year,
				term: payload.term,
			},
		},
	});

	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			`Semester '${payload.term} ${payload.year}' already exists`,
		);
	}

	// Verify only one ACTIVE semester
	if (payload.status === "ACTIVE") {
		const activeSemester = await prisma.semester.findFirst({
			where: { status: "ACTIVE" },
		});

		if (activeSemester) {
			throw new AppError(
				httpStatus.CONFLICT,
				`Another semester ('${activeSemester.name}') is currently ACTIVE. Only one semester can be ACTIVE at a time.`,
			);
		}
	}

	return prisma.$transaction(async (tx) => {
		const semester = await tx.semester.create({
			data: {
				name: payload.name,
				year: payload.year,
				term: payload.term,
				startDate: new Date(payload.startDate),
				endDate: new Date(payload.endDate),
				registrationStart: payload.registrationStart
					? new Date(payload.registrationStart)
					: null,
				registrationEnd: payload.registrationEnd
					? new Date(payload.registrationEnd)
					: null,
				status: payload.status ?? "UPCOMING",
			},
		});

		await createAuditLog(tx, {
			actorId,
			action: "SEMESTER_CREATE",
			entity: "Semester",
			entityId: semester.id,
			after: {
				name: semester.name,
				year: semester.year,
				term: semester.term,
				status: semester.status,
				startDate: semester.startDate,
				endDate: semester.endDate,
			},
			ip,
		});

		return semester;
	});
};

/**
 * Retrieve paginated list of semesters with status, year filters, and search.
 */
const getSemesters = async (options: TSemesterFilterOptions) => {
	const { page, limit, skip, sortBy, order } = calculatePagination(
		options,
		"startDate",
	);

	const searchConditions = buildSearchWhere(options.q, ["name", "term"]);
	const where: Prisma.SemesterWhereInput = {
		...searchConditions,
		...(options.status && { status: options.status }),
		...(options.year !== undefined && { year: Number(options.year) }),
	};

	const [semesters, total] = await Promise.all([
		prisma.semester.findMany({
			where,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: order,
			},
		}),
		prisma.semester.count({ where }),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return {
		meta,
		data: semesters,
	};
};

/**
 * Retrieve a single semester by its unique ID.
 */
const getSemesterById = async (id: string) => {
	const semester = await prisma.semester.findUnique({
		where: { id },
	});

	if (!semester) {
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
	}

	return semester;
};

/**
 * Update an existing semester's details with date and conflict validations.
 */
const updateSemester = async (
	id: string,
	payload: TUpdateSemesterPayload,
	actorId: string,
	ip?: string,
) => {
	const existing = await prisma.semester.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
	}

	// Verify (year, term) uniqueness if modified
	const targetYear = payload.year ?? existing.year;
	const targetTerm = payload.term ?? existing.term;
	if (targetYear !== existing.year || targetTerm !== existing.term) {
		const conflict = await prisma.semester.findUnique({
			where: {
				year_term: {
					year: targetYear,
					term: targetTerm,
				},
			},
		});

		if (conflict && conflict.id !== id) {
			throw new AppError(
				httpStatus.CONFLICT,
				`Semester '${targetTerm} ${targetYear}' already exists`,
			);
		}
	}

	// Verify date logic
	const effStart = payload.startDate
		? new Date(payload.startDate)
		: existing.startDate;
	const effEnd = payload.endDate ? new Date(payload.endDate) : existing.endDate;

	if (effStart >= effEnd) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"startDate must be before endDate",
		);
	}

	const effRegStart =
		payload.registrationStart !== undefined
			? payload.registrationStart
				? new Date(payload.registrationStart)
				: null
			: existing.registrationStart;
	const effRegEnd =
		payload.registrationEnd !== undefined
			? payload.registrationEnd
				? new Date(payload.registrationEnd)
				: null
			: existing.registrationEnd;

	if (effRegStart && effRegEnd && effRegStart >= effRegEnd) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"registrationStart must be before registrationEnd",
		);
	}

	return prisma.$transaction(async (tx) => {
		const updated = await tx.semester.update({
			where: { id },
			data: {
				...(payload.name !== undefined && { name: payload.name }),
				...(payload.year !== undefined && { year: payload.year }),
				...(payload.term !== undefined && { term: payload.term }),
				...(payload.startDate !== undefined && {
					startDate: new Date(payload.startDate),
				}),
				...(payload.endDate !== undefined && {
					endDate: new Date(payload.endDate),
				}),
				...(payload.registrationStart !== undefined && {
					registrationStart: payload.registrationStart
						? new Date(payload.registrationStart)
						: null,
				}),
				...(payload.registrationEnd !== undefined && {
					registrationEnd: payload.registrationEnd
						? new Date(payload.registrationEnd)
						: null,
				}),
			},
		});

		await createAuditLog(tx, {
			actorId,
			action: "SEMESTER_UPDATE",
			entity: "Semester",
			entityId: id,
			before: {
				name: existing.name,
				year: existing.year,
				term: existing.term,
				startDate: existing.startDate,
				endDate: existing.endDate,
				registrationStart: existing.registrationStart,
				registrationEnd: existing.registrationEnd,
			},
			after: {
				name: updated.name,
				year: updated.year,
				term: updated.term,
				startDate: updated.startDate,
				endDate: updated.endDate,
				registrationStart: updated.registrationStart,
				registrationEnd: updated.registrationEnd,
			},
			ip,
		});

		return updated;
	});
};

/**
 * Soft delete a semester and record the event in audit logs.
 */
const deleteSemester = async (id: string, actorId: string, ip?: string) => {
	const existing = await prisma.semester.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
	}

	return prisma.$transaction(async (tx) => {
		const deleted = await tx.semester.update({
			where: { id },
			data: { deletedAt: new Date() },
		});

		await createAuditLog(tx, {
			actorId,
			action: "SEMESTER_DELETE",
			entity: "Semester",
			entityId: id,
			before: {
				name: existing.name,
				year: existing.year,
				term: existing.term,
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
 * Update semester status enforcing strict one-way state transitions:
 * UPCOMING -> ACTIVE -> COMPLETED.
 * Only one semester may be ACTIVE at any given time.
 */
const updateSemesterStatus = async (
	id: string,
	payload: TUpdateSemesterStatusPayload,
	actorId: string,
	ip?: string,
) => {
	const existing = await prisma.semester.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
	}

	const current = existing.status;
	const target = payload.status;

	if (current === target) {
		return existing;
	}

	// Validate one-way state machine: UPCOMING -> ACTIVE -> COMPLETED
	const isValidTransition =
		(current === "UPCOMING" && target === "ACTIVE") ||
		(current === "ACTIVE" && target === "COMPLETED");

	if (!isValidTransition) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Invalid status transition from '${current}' to '${target}'. Allowed transitions are UPCOMING -> ACTIVE -> COMPLETED.`,
		);
	}

	// Verify only one ACTIVE semester
	if (target === "ACTIVE") {
		const existingActive = await prisma.semester.findFirst({
			where: {
				status: "ACTIVE",
				id: { not: id },
			},
		});

		if (existingActive) {
			throw new AppError(
				httpStatus.CONFLICT,
				`Another semester ('${existingActive.name}') is currently ACTIVE. Only one semester can be ACTIVE at a time.`,
			);
		}
	}

	return prisma.$transaction(async (tx) => {
		const updated = await tx.semester.update({
			where: { id },
			data: { status: target },
		});

		await createAuditLog(tx, {
			actorId,
			action: "SEMESTER_STATUS_CHANGE",
			entity: "Semester",
			entityId: id,
			before: { status: current },
			after: { status: target },
			ip,
		});

		return updated;
	});
};

export const semesterService = {
	createSemester,
	getSemesters,
	getSemesterById,
	updateSemester,
	deleteSemester,
	updateSemesterStatus,
};
