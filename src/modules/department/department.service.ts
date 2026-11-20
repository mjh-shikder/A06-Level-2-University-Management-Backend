import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import { buildSearchWhere } from "../../utils/buildWhere";
import { buildPaginationMeta, calculatePagination } from "../../utils/paginate";
import type {
	TCreateDepartmentPayload,
	TDepartmentFilterOptions,
	TUpdateDepartmentPayload,
} from "./department.interface";

/**
 * Create a new department with unique code enforcement and audit logging.
 */
const createDepartment = async (
	payload: TCreateDepartmentPayload,
	actorId: string,
	ip?: string,
) => {
	const existing = await prisma.department.findUnique({
		where: { code: payload.code },
	});

	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			`Department with code '${payload.code}' already exists`,
		);
	}

	return prisma.$transaction(async (tx) => {
		const department = await tx.department.create({
			data: {
				name: payload.name,
				code: payload.code,
				description: payload.description,
			},
		});

		await createAuditLog(tx, {
			actorId,
			action: "DEPARTMENT_CREATE",
			entity: "Department",
			entityId: department.id,
			after: {
				name: department.name,
				code: department.code,
				description: department.description,
			},
			ip,
		});

		return department;
	});
};

/**
 * Retrieve paginated list of departments supporting search and sorting.
 */
const getDepartments = async (options: TDepartmentFilterOptions) => {
	const { page, limit, skip, sortBy, order } = calculatePagination(
		options,
		"createdAt",
	);

	const searchConditions = buildSearchWhere(options.q, ["name", "code"]);
	const where: Prisma.DepartmentWhereInput = searchConditions;

	const [departments, total] = await Promise.all([
		prisma.department.findMany({
			where,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: order,
			},
			include: {
				_count: {
					select: { instructors: true },
				},
			},
		}),
		prisma.department.count({ where }),
	]);

	const meta = buildPaginationMeta(total, page, limit);

	return {
		meta,
		data: departments,
	};
};

/**
 * Retrieve a single department by its unique ID.
 */
const getDepartmentById = async (id: string) => {
	const department = await prisma.department.findUnique({
		where: { id },
		include: {
			_count: {
				select: { instructors: true },
			},
		},
	});

	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	return department;
};

/**
 * Update an existing department with code conflict check and audit logging.
 */
const updateDepartment = async (
	id: string,
	payload: TUpdateDepartmentPayload,
	actorId: string,
	ip?: string,
) => {
	const existing = await prisma.department.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	if (payload.code && payload.code !== existing.code) {
		const codeExists = await prisma.department.findUnique({
			where: { code: payload.code },
		});

		if (codeExists) {
			throw new AppError(
				httpStatus.CONFLICT,
				`Department code '${payload.code}' is already in use`,
			);
		}
	}

	return prisma.$transaction(async (tx) => {
		const updated = await tx.department.update({
			where: { id },
			data: {
				...(payload.name !== undefined && { name: payload.name }),
				...(payload.code !== undefined && { code: payload.code }),
				...(payload.description !== undefined && {
					description: payload.description,
				}),
			},
		});

		await createAuditLog(tx, {
			actorId,
			action: "DEPARTMENT_UPDATE",
			entity: "Department",
			entityId: id,
			before: {
				name: existing.name,
				code: existing.code,
				description: existing.description,
			},
			after: {
				name: updated.name,
				code: updated.code,
				description: updated.description,
			},
			ip,
		});

		return updated;
	});
};

/**
 * Soft delete a department and record the event in audit logs.
 */
const deleteDepartment = async (id: string, actorId: string, ip?: string) => {
	const existing = await prisma.department.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	return prisma.$transaction(async (tx) => {
		const deleted = await tx.department.update({
			where: { id },
			data: { deletedAt: new Date() },
		});

		await createAuditLog(tx, {
			actorId,
			action: "DEPARTMENT_DELETE",
			entity: "Department",
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

export const departmentService = {
	createDepartment,
	getDepartments,
	getDepartmentById,
	updateDepartment,
	deleteDepartment,
};
