import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import config from "../config";

const connectionString = config.databaseUrl;
const adapter = new PrismaPg({ connectionString });
const basePrisma = new PrismaClient({ adapter });

/**
 * Models that participate in the soft-delete lifecycle (deletedAt column)
 */
const SOFT_DELETE_MODELS = new Set<string>([
	"User",
	"StudentProfile",
	"InstructorProfile",
	"Department",
	"Program",
	"Course",
	"Semester",
	"Section",
	"Enrollment",
	"Result",
	"Invoice",
]);

/**
 * Extended Prisma Client with centralized soft-delete filtering and operations.
 * - Automatically filters out deleted records (deletedAt: null) on reads.
 * - findUnique returns null if the record was soft-deleted.
 * - Converts delete/deleteMany operations into soft-delete updates setting deletedAt to now.
 */
export const prisma = basePrisma.$extends({
	name: "softDelete",
	query: {
		$allModels: {
			async findMany({ model, args, query }) {
				if (SOFT_DELETE_MODELS.has(model)) {
					args.where = { ...args.where, deletedAt: null };
				}
				return query(args);
			},
			async findFirst({ model, args, query }) {
				if (SOFT_DELETE_MODELS.has(model)) {
					args.where = { ...args.where, deletedAt: null };
				}
				return query(args);
			},
			async findFirstOrThrow({ model, args, query }) {
				if (SOFT_DELETE_MODELS.has(model)) {
					args.where = { ...args.where, deletedAt: null };
				}
				return query(args);
			},
			async findUnique({ model, args, query }) {
				const isSoftDelete = SOFT_DELETE_MODELS.has(model);
				const originalSelect = args.select ? { ...args.select } : null;
				if (isSoftDelete && args.select) {
					args.select = { ...args.select, deletedAt: true };
				}
				const result = await query(args);
				if (
					isSoftDelete &&
					result &&
					(result as { deletedAt?: Date | null }).deletedAt != null
				) {
					return null;
				}
				if (
					result &&
					originalSelect &&
					!(originalSelect as Record<string, unknown>).deletedAt
				) {
					delete (result as Record<string, unknown>).deletedAt;
				}
				return result;
			},
			async findUniqueOrThrow({ model, args, query }) {
				const isSoftDelete = SOFT_DELETE_MODELS.has(model);
				const originalSelect = args.select ? { ...args.select } : null;
				if (isSoftDelete && args.select) {
					args.select = { ...args.select, deletedAt: true };
				}
				const result = await query(args);
				if (
					isSoftDelete &&
					result &&
					(result as { deletedAt?: Date | null }).deletedAt != null
				) {
					const error = new Error(`No ${model} found`);
					(error as { code?: string }).code = "P2025";
					throw error;
				}
				if (
					result &&
					originalSelect &&
					!(originalSelect as Record<string, unknown>).deletedAt
				) {
					delete (result as Record<string, unknown>).deletedAt;
				}
				return result;
			},
			async count({ model, args, query }) {
				if (SOFT_DELETE_MODELS.has(model)) {
					args.where = { ...args.where, deletedAt: null };
				}
				return query(args);
			},
			async delete({ model, args }) {
				if (SOFT_DELETE_MODELS.has(model)) {
					// Convert hard delete to soft delete update
					return (
						basePrisma as unknown as Record<
							string,
							{ update: (options: unknown) => Promise<unknown> }
						>
					)[model]?.update({
						...args,
						data: { deletedAt: new Date() },
					});
				}
				return (
					basePrisma as unknown as Record<
						string,
						{ delete: (options: unknown) => Promise<unknown> }
					>
				)[model]?.delete(args);
			},
			async deleteMany({ model, args }) {
				if (SOFT_DELETE_MODELS.has(model)) {
					return (
						basePrisma as unknown as Record<
							string,
							{ updateMany: (options: unknown) => Promise<unknown> }
						>
					)[model]?.updateMany({
						...args,
						data: { deletedAt: new Date() },
					});
				}
				return (
					basePrisma as unknown as Record<
						string,
						{ deleteMany: (options: unknown) => Promise<unknown> }
					>
				)[model]?.deleteMany(args);
			},
		},
	},
});

export type ExtendedPrismaClient = typeof prisma;
