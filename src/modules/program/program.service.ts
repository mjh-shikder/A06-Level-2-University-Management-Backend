import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import { buildSearchWhere } from "../../utils/buildWhere";
import { buildPaginationMeta, calculatePagination } from "../../utils/paginate";
import type {
	TCreateProgramPayload,
	TProgramFilterOptions,
	TUpdateProgramPayload,
} from "./program.interface";

/**
 * Create a new program under an existing department with audit logging.
 */
const createProgram = async (
	payload: TCreateProgramPayload,
	actorId: string,
	ip?: string,
) => {
	// Verify that the target department exists and is active
	const department = await prisma.department.findUnique({
		where: { id: payload.departmentId },
	});

	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	// Verify code uniqueness
	const existing = await prisma.program.findUnique({
		where: { code: payload.code },
	});

	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			`Program with code '${payload.code}' already exists`,
		);
	}

	return prisma.$transaction(async (tx) => {
		const program = await tx.program.create({
			data: {
				name: payload.name,
				code: payload.code,
				departmentId: payload.departmentId,
				requiredCredits: payload.requiredCredits,
			},
			include: {
				department: {
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
			action: "PROGRAM_CREATE",
			entity: "Program",
			entityId: program.id,
			after: {
				name: program.name,
				code: program.code,
				departmentId: program.departmentId,
				requiredCredits: program.requiredCredits,
			},
			ip,
		});

		return program;
	});
};

/**
 * Retrieve paginated list of programs with search, department filtering, and sorting.
 */
const getPrograms = async (options: TProgramFilterOptions) => {
	const { page, limit, skip, sortBy, order } = calculatePagination(
		options,
		"createdAt",
	);

	const searchConditions = buildSearchWhere(options.q, ["name", "code"]);
	const where: Prisma.ProgramWhereInput = {
		...searchConditions,
		...(options.departmentId && { departmentId: options.departmentId }),
	};

	const [programs, total] = await Promise.all([
		prisma.program.findMany({
			where,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: order,
			},
			include: {
				department: {
					select: {
						id: true,
						name: true,
						code: true,
					},
				},
				_count: {
					select: {
						students: true,
					},
				},
			},
		}),
		prisma.program.count({ where }),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return {
		meta,
		data: programs,
	};
};

/**
 * Retrieve a single program by its unique ID with linked department info.
 */
const getProgramById = async (id: string) => {
	const program = await prisma.program.findUnique({
		where: { id },
		include: {
			department: {
				select: {
					id: true,
					name: true,
					code: true,
				},
			},
			_count: {
				select: {
					students: true,
				},
			},
		},
	});

	if (!program) {
		throw new AppError(httpStatus.NOT_FOUND, "Program not found");
	}

	return program;
};

/**
 * Update an existing program with duplicate code check and audit logging.
 */
const updateProgram = async (
	id: string,
	payload: TUpdateProgramPayload,
	actorId: string,
	ip?: string,
) => {
	const existing = await prisma.program.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Program not found");
	}

	if (payload.departmentId && payload.departmentId !== existing.departmentId) {
		const department = await prisma.department.findUnique({
			where: { id: payload.departmentId },
		});

		if (!department) {
			throw new AppError(httpStatus.NOT_FOUND, "Department not found");
		}
	}

	if (payload.code && payload.code !== existing.code) {
		const codeExists = await prisma.program.findUnique({
			where: { code: payload.code },
		});

		if (codeExists) {
			throw new AppError(
				httpStatus.CONFLICT,
				`Program code '${payload.code}' is already in use`,
			);
		}
	}

	return prisma.$transaction(async (tx) => {
		const updated = await tx.program.update({
			where: { id },
			data: {
				...(payload.name !== undefined && { name: payload.name }),
				...(payload.code !== undefined && { code: payload.code }),
				...(payload.departmentId !== undefined && {
					departmentId: payload.departmentId,
				}),
				...(payload.requiredCredits !== undefined && {
					requiredCredits: payload.requiredCredits,
				}),
			},
			include: {
				department: {
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
			action: "PROGRAM_UPDATE",
			entity: "Program",
			entityId: id,
			before: {
				name: existing.name,
				code: existing.code,
				departmentId: existing.departmentId,
				requiredCredits: existing.requiredCredits,
			},
			after: {
				name: updated.name,
				code: updated.code,
				departmentId: updated.departmentId,
				requiredCredits: updated.requiredCredits,
			},
			ip,
		});

		return updated;
	});
};

/**
 * Soft delete a program and record the event in audit logs.
 */
const deleteProgram = async (id: string, actorId: string, ip?: string) => {
	const existing = await prisma.program.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Program not found");
	}

	return prisma.$transaction(async (tx) => {
		const deleted = await tx.program.update({
			where: { id },
			data: { deletedAt: new Date() },
		});

		await createAuditLog(tx, {
			actorId,
			action: "PROGRAM_DELETE",
			entity: "Program",
			entityId: id,
			before: {
				name: existing.name,
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

export const programService = {
	createProgram,
	getPrograms,
	getProgramById,
	updateProgram,
	deleteProgram,
};
