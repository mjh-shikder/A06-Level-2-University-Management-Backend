import { z } from "zod";

/**
 * Validation schema for user registration.
 */
const registerSchema = z.object({
	body: z.object({
		email: z.string().email("Invalid email address"),
		password: z
			.string()
			.min(8, "Password must be at least 8 characters long")
			.max(100, "Password cannot exceed 100 characters"),
		firstName: z
			.string()
			.min(1, "First name is required")
			.max(100, "First name cannot exceed 100 characters"),
		lastName: z
			.string()
			.min(1, "Last name is required")
			.max(100, "Last name cannot exceed 100 characters"),
		role: z
			.enum(["ADMIN", "INSTRUCTOR", "STUDENT"])
			.optional()
			.default("STUDENT"),
	}),
});

/**
 * Validation schema for user login.
 */
const loginSchema = z.object({
	body: z.object({
		email: z.string().email("Invalid email address"),
		password: z.string().min(1, "Password is required"),
	}),
});

/**
 * Validation schema for refresh token in cookies.
 */
const refreshTokenSchema = z.object({
	cookies: z.object({
		refreshToken: z.string().min(1, "Refresh token is required"),
	}),
});

export const authValidation = {
	registerSchema,
	loginSchema,
	refreshTokenSchema,
};
