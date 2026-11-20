import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { Role } from "../../generated/prisma/client";
import { AppError } from "../errors/AppError";

/**
 * Role-based access control (RBAC) middleware.
 * Verifies that the authenticated user possesses one of the authorized roles.
 * Must be executed after the authenticate middleware.
 *
 * @param roles Array of authorized roles allowed to access the endpoint
 */
export const authorize = (...roles: Role[]) => {
	return (req: Request, _res: Response, next: NextFunction): void => {
		if (!req.user) {
			next(
				new AppError(
					httpStatus.UNAUTHORIZED,
					"Authentication required before role verification",
				),
			);
			return;
		}

		if (!roles.includes(req.user.role)) {
			next(
				new AppError(
					httpStatus.FORBIDDEN,
					`Access forbidden: requires one of the following roles: [${roles.join(", ")}]`,
				),
			);
			return;
		}

		next();
	};
};
