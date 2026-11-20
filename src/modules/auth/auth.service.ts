import bcrypt from "bcrypt";
import httpStatus from "http-status";
import jwt from "jsonwebtoken";
import config from "../../config";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import type {
	TLoginPayload,
	TLoginResponse,
	TRegisterPayload,
} from "./auth.interface";

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
 * Authenticate user credentials and issue JWT tokens.
 * - Validates email and bcrypt password.
 * - Verifies user status is ACTIVE.
 * - Signs access token (15m expiry) and refresh token (7d expiry).
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
		expiresIn: "15m",
	});

	const refreshToken = jwt.sign(jwtPayload, config.jwt.refreshSecret, {
		expiresIn: "7d",
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

export const authService = {
	register,
	login,
};
