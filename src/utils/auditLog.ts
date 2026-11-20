import { Prisma } from "../../generated/prisma/client";

export type TAuditLogData = {
	actorId: string;
	action: string;
	entity: string;
	entityId: string;
	before?: unknown;
	after?: unknown;
	ip?: string;
};

/**
 * Structural type matching either the extended root Prisma client or an interactive transaction client.
 */
export type TPrismaClientOrTx = {
	auditLog: {
		create: (args: {
			data: {
				actorId: string;
				action: string;
				entity: string;
				entityId: string;
				before?: Prisma.InputJsonValue;
				after?: Prisma.InputJsonValue;
				ip?: string | null;
			};
		}) => Promise<unknown>;
	};
};

/**
 * Reusable transaction-aware audit log helper.
 * Can be called with either the root Prisma client or inside a prisma.$transaction client.
 *
 * @param client Prisma root or transaction client
 * @param data Audit event details
 */
export const createAuditLog = async (
	client: TPrismaClientOrTx,
	data: TAuditLogData,
): Promise<void> => {
	await client.auditLog.create({
		data: {
			actorId: data.actorId,
			action: data.action,
			entity: data.entity,
			entityId: data.entityId,
			before:
				data.before !== undefined
					? (data.before as Prisma.InputJsonValue)
					: undefined,
			after:
				data.after !== undefined
					? (data.after as Prisma.InputJsonValue)
					: undefined,
			ip: data.ip ?? null,
		},
	});
};
