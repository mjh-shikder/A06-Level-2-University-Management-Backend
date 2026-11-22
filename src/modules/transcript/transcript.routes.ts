import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { TranscriptController } from "./transcript.controller";
import { TranscriptValidation } from "./transcript.validation";

const router = Router();

/**
 * GET /api/v1/students/me/transcript
 * Current student's full official transcript
 */
router.get(
	"/me/transcript",
	authenticate,
	authorize("STUDENT"),
	TranscriptController.getMyTranscript,
);


/**
 * GET /api/v1/students/me/gpa
 * GET /api/v1/transcripts/me/gpa
 * Current student's GPA summary (SGPA per semester and overall CGPA)
 */
router.get(
	"/me/gpa",
	authenticate,
	authorize("STUDENT"),
	TranscriptController.getMyGPASummary,
);

/**
 * GET /api/v1/students/:studentId/transcript
 * Student transcript by ID (ADMIN, INSTRUCTOR, or STUDENT viewing self)
 */
router.get(
	"/:studentId/transcript",
	authenticate,
	authorize("ADMIN", "INSTRUCTOR", "STUDENT"),
	validate(TranscriptValidation.getStudentTranscriptParamSchema),
	TranscriptController.getStudentTranscript,
);

/**
 * GET /api/v1/students/:studentId/gpa
 * Student GPA summary by ID (ADMIN, INSTRUCTOR, or STUDENT viewing self)
 */
router.get(
	"/:studentId/gpa",
	authenticate,
	authorize("ADMIN", "INSTRUCTOR", "STUDENT"),
	validate(TranscriptValidation.getStudentTranscriptParamSchema),
	TranscriptController.getStudentGPASummary,
);

/**
 * GET /api/v1/transcripts/:studentId
 * Direct transcript lookup by studentId when mounted under /transcripts
 */
router.get(
	"/:studentId",
	authenticate,
	authorize("ADMIN", "INSTRUCTOR", "STUDENT"),
	validate(TranscriptValidation.getStudentTranscriptParamSchema),
	TranscriptController.getStudentTranscript,
);

export const transcriptRoutes = router;
