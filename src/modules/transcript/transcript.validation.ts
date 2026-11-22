import { z } from "zod";

/**
 * Validation schemas for transcript and GPA endpoints.
 */
const getStudentTranscriptParamSchema = z.object({
	params: z.object({
		studentId: z
			.string({
				error: "studentId parameter is required",
			})
			.min(1, "studentId cannot be empty"),
	}),
});

export const TranscriptValidation = {
	getStudentTranscriptParamSchema,
};
