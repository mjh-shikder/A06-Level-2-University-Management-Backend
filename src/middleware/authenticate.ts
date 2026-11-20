import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import jwt from "jsonwebtoken";
import type { Role } from "../../generated/prisma/client";
import config from "../config";
import { AppError } from "../errors/AppError";
import { prisma } from "../lib/prisma";

type TDecodedUser = {
	userId: string;
	email: string;
	role: Role;
	iat: number;
	exp: number;
};

/**
 * Authentication middleware that verifies JWT Bearer tokens from the Authorization header.
 * Validates token signature, expiration, and ensures user remains active in the database.
 * Attaches the verified user payload to req.user.
 */
export const authenticate = async (
	req: Request,
	_res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader?.startsWith("Bearer ")) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"You are not authorized to access this route",
			);
		}

		const token = authHeader.split(" ")[1];

		if (!token) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"Authorization token is missing",
			);
		}

		let decoded: TDecodedUser;
		try {
			decoded = jwt.verify(token, config.jwt.accessSecret) as TDecodedUser;
		} catch (error) {
			if (error instanceof jwt.TokenExpiredError) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Access token has expired. Please refresh your token.",
				);
			}
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"Invalid or malformed access token",
			);
		}

		// Ensure the user exists and is active (soft-deleted users are excluded automatically by prisma extension)
		const user = await prisma.user.findUnique({
			where: { id: decoded.userId },
			select: {
				id: true,
				email: true,
				role: true,
				status: true,
			},
		});

		if (!user) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"User belonging to this token no longer exists",
			);
		}

		if (user.status !== "ACTIVE") {
			throw new AppError(
				httpStatus.FORBIDDEN,
				`Your account is currently ${user.status.toLowerCase()}. Please contact an administrator.`,
			);
		}

		req.user = {
			id: user.id,
			email: user.email,
			role: user.role,
		};

		next();
	} catch (error) {
		next(error);
	}
};
