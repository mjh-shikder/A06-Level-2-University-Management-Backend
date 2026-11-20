import { z } from "zod";

/**
 * Validation schema for enrolling in a section.
 */
const enrollSectionSchema = z.object({
	body: z.object({
		sectionId: z.string().uuid("Invalid section ID format"),
	}),
});

export const enrollmentValidation = {
	enrollSectionSchema,
};
