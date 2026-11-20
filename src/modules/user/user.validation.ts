import { z } from "zod";

/**
 * Validation schema for updating user profile.
 */
const updateProfileSchema = z.object({
	body: z
		.object({
			firstName: z
				.string()
				.min(1, "First name cannot be empty")
				.max(100, "First name cannot exceed 100 characters")
				.optional(),
			lastName: z
				.string()
				.min(1, "Last name cannot be empty")
				.max(100, "Last name cannot exceed 100 characters")
				.optional(),
		})
		.refine(
			(data) => data.firstName !== undefined || data.lastName !== undefined,
			{
				message:
					"At least one field (firstName or lastName) must be provided for update",
			},
		),
});

/**
 * Validation schema for changing user password.
 */
const changePasswordSchema = z.object({
	body: z
		.object({
			currentPassword: z.string().min(1, "Current password is required"),
			newPassword: z
				.string()
				.min(8, "New password must be at least 8 characters long")
				.max(100, "New password cannot exceed 100 characters"),
		})
		.refine((data) => data.currentPassword !== data.newPassword, {
			message: "New password must be different from current password",
			path: ["newPassword"],
		}),
});

export const userValidation = {
	updateProfileSchema,
	changePasswordSchema,
};
