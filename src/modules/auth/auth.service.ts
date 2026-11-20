import crypto from "node:crypto";
import bcrypt from "bcrypt";
import httpStatus from "http-status";
import jwt from "jsonwebtoken";
import type { Role } from "../../../generated/prisma/client";
import config from "../../config";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import type {
	TLoginPayload,
	TLoginResponse,
	TRefreshTokenResponse,
	TRegisterPayload,
} from "./auth.interface";

/**
 * Hash a plain token string using SHA-256 for secure database lookup.
 */
const hashToken = (token: string): string => {
	return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Register a new user in the system.
 * - Checks for duplicate email.
 * - Hashes password with bcrypt.
 * - Automatically initializes a StudentProfile or InstructorProfile if applicable.
 * - Runs atomically inside a database transaction.
 */
const register = async (payload: TRegisterPayload) => {
	const existingUser = await prisma.user.findUnique({
		where: { email: payload.email },
		select: { id: true },
	});

	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"A user with this email address already exists",
		);
	}

	const passwordHash = await bcrypt.hash(
		payload.password,
		config.bcryptSaltRounds,
	);
	const targetRole = payload.role ?? "STUDENT";
	const currentYear = new Date().getFullYear();

	return prisma.$transaction(async (tx) => {
		if (targetRole === "STUDENT") {
			// Generate next sequential student ID: STU-YYYY-XXXX
			const latestStudent = await tx.studentProfile.findFirst({
				where: {
					enrollmentYear: currentYear,
					studentId: { startsWith: `STU-${currentYear}-` },
				},
				orderBy: { studentId: "desc" },
				select: { studentId: true },
			});

			let nextSeq = 1;
			if (latestStudent?.studentId) {
				const parts = latestStudent.studentId.split("-");
				const lastSeq = Number.parseInt(parts[2] || "0", 10);
				if (!Number.isNaN(lastSeq)) {
					nextSeq = lastSeq + 1;
				}
			}

			const studentId = `STU-${currentYear}-${String(nextSeq).padStart(4, "0")}`;

			return tx.user.create({
				data: {
					email: payload.email,
					passwordHash,
					firstName: payload.firstName,
					lastName: payload.lastName,
					role: targetRole,
					status: "ACTIVE",
					studentProfile: {
						create: {
							studentId,
							enrollmentYear: currentYear,
						},
					},
				},
				select: {
					id: true,
					email: true,
					firstName: true,
					lastName: true,
					role: true,
					status: true,
					createdAt: true,
					updatedAt: true,
					studentProfile: {
						select: {
							id: true,
							studentId: true,
							enrollmentYear: true,
						},
					},
				},
			});
		}

		if (targetRole === "INSTRUCTOR") {
			// Generate next sequential instructor employee ID: INS-YYYY-XXXX
			const latestInstructor = await tx.instructorProfile.findFirst({
				where: {
					employeeId: { startsWith: `INS-${currentYear}-` },
				},
				orderBy: { employeeId: "desc" },
				select: { employeeId: true },
			});

			let nextSeq = 1;
			if (latestInstructor?.employeeId) {
				const parts = latestInstructor.employeeId.split("-");
				const lastSeq = Number.parseInt(parts[2] || "0", 10);
				if (!Number.isNaN(lastSeq)) {
					nextSeq = lastSeq + 1;
				}
			}

			const employeeId = `INS-${currentYear}-${String(nextSeq).padStart(4, "0")}`;

			return tx.user.create({
				data: {
					email: payload.email,
					passwordHash,
					firstName: payload.firstName,
					lastName: payload.lastName,
					role: targetRole,
					status: "ACTIVE",
					instructorProfile: {
						create: {
							employeeId,
						},
					},
				},
				select: {
					id: true,
					email: true,
					firstName: true,
					lastName: true,
					role: true,
					status: true,
					createdAt: true,
					updatedAt: true,
					instructorProfile: {
						select: {
							id: true,
							employeeId: true,
						},
					},
				},
			});
		}

		// ADMIN registration
		return tx.user.create({
			data: {
				email: payload.email,
				passwordHash,
				firstName: payload.firstName,
				lastName: payload.lastName,
				role: targetRole,
				status: "ACTIVE",
			},
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
				status: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	});
};

/**
 * Authenticate user credentials and issue JWT access and refresh tokens.
 * - Validates email and bcrypt password.
 * - Verifies user status is ACTIVE.
 * - Signs access token (15m expiry) and refresh token (7d expiry).
 * - Stores SHA-256 hashed refresh token in the database for rotation.
 */
const login = async (payload: TLoginPayload): Promise<TLoginResponse> => {
	const user = await prisma.user.findUnique({
		where: { email: payload.email },
		select: {
			id: true,
			email: true,
			passwordHash: true,
			firstName: true,
			lastName: true,
			role: true,
			status: true,
		},
	});

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
	}

	const isPasswordMatched = await bcrypt.compare(
		payload.password,
		user.passwordHash,
	);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
	}

	if (user.status !== "ACTIVE") {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`Account is currently ${user.status.toLowerCase()}. Please contact an administrator.`,
		);
	}

	const jwtPayload = {
		userId: user.id,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwt.sign(jwtPayload, config.jwt.accessSecret, {
		expiresIn: "1d",
	});

	const refreshToken = jwt.sign(jwtPayload, config.jwt.refreshSecret, {
		expiresIn: "7d",
	});

	// Store hashed refresh token in database for rotation tracking
	const tokenHash = hashToken(refreshToken);
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

	await prisma.refreshToken.create({
		data: {
			userId: user.id,
			tokenHash,
			expiresAt,
		},
	});

	return {
		accessToken,
		refreshToken,
		user: {
			id: user.id,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role,
		},
	};
};

/**
 * Rotate an active refresh token.
 * - Verifies token signature.
 * - Looks up token in database by SHA-256 hash.
 * - Detects token reuse (compromised token replay): revokes ALL tokens for user if reused.
 * - Revokes current token and issues a new access token and rotated refresh token.
 */
const refreshToken = async (token: string): Promise<TRefreshTokenResponse> => {
	let decoded: { userId: string; email: string; role: Role };

	try {
		decoded = jwt.verify(token, config.jwt.refreshSecret) as {
			userId: string;
			email: string;
			role: Role;
		};
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"Refresh token has expired. Please log in again.",
			);
		}
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or malformed refresh token",
		);
	}

	const incomingTokenHash = hashToken(token);

	// Find the token in the database
	const existingToken = await prisma.refreshToken.findFirst({
		where: { tokenHash: incomingTokenHash },
	});

	if (!existingToken) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
	}

	// Reuse detection: If token was already revoked, someone is replaying a previously used token!
	if (existingToken.revoked) {
		// Immediately revoke all sessions for this user to protect against compromised credentials
		await prisma.refreshToken.updateMany({
			where: { userId: decoded.userId },
			data: { revoked: true },
		});
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Suspicious activity detected: compromised refresh token reused. All sessions have been revoked.",
		);
	}

	// Check expiration in DB
	if (new Date() > existingToken.expiresAt) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Refresh token has expired. Please log in again.",
		);
	}

	// Ensure user exists and is active
	const user = await prisma.user.findUnique({
		where: { id: decoded.userId },
		select: { id: true, email: true, role: true, status: true },
	});

	if (user?.status !== "ACTIVE") {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User account is no longer active",
		);
	}

	// Generate new access and rotated refresh tokens
	const jwtPayload = {
		userId: user.id,
		email: user.email,
		role: user.role,
	};

	const newAccessToken = jwt.sign(jwtPayload, config.jwt.accessSecret, {
		expiresIn: "15m",
	});

	const newRefreshToken = jwt.sign(jwtPayload, config.jwt.refreshSecret, {
		expiresIn: "7d",
	});

	const newTokenHash = hashToken(newRefreshToken);
	const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	// Atomically revoke old token and record new rotated token
	await prisma.$transaction([
		prisma.refreshToken.update({
			where: { id: existingToken.id },
			data: { revoked: true },
		}),
		prisma.refreshToken.create({
			data: {
				userId: user.id,
				tokenHash: newTokenHash,
				expiresAt: newExpiresAt,
			},
		}),
	]);

	return {
		accessToken: newAccessToken,
		newRefreshToken,
	};
};

/**
 * Invalidate a refresh token in the database upon user logout.
 */
const logout = async (token?: string): Promise<void> => {
	if (!token) return;

	try {
		const tokenHash = hashToken(token);
		await prisma.refreshToken.updateMany({
			where: { tokenHash, revoked: false },
			data: { revoked: true },
		});
	} catch {
		// Non-fatal if token was already revoked or not found
	}
};

/**
 * Retrieve the authenticated user's current profile.
 */
const getMe = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			role: true,
			status: true,
			createdAt: true,
			updatedAt: true,
			studentProfile: {
				select: {
					id: true,
					studentId: true,
					enrollmentYear: true,
				},
			},
			instructorProfile: {
				select: {
					id: true,
					employeeId: true,
				},
			},
		},
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User profile not found");
	}

	return user;
};

export const authService = {
	register,
	login,
	refreshToken,
	logout,
	getMe,
};
