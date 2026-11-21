import type { TPaginationOptions } from "../../utils/paginate";

/**
 * Payload for creating a new exam under a course section.
 */
export type TCreateExamPayload = {
	title: string;
	weightPercent: number;
	maxMarks: number;
	examDate?: string;
};

/**
 * Payload for updating exam details.
 */
export type TUpdateExamPayload = {
	title?: string;
	weightPercent?: number;
	maxMarks?: number;
	examDate?: string | null;
};

/**
 * An individual student's exam mark entry.
 */
export type TMarkItem = {
	enrollmentId: string;
	obtainedMarks: number;
};

/**
 * Payload for bulk entering marks for an exam.
 */
export type TBulkEnterMarksPayload = {
	marks: TMarkItem[];
};

/**
 * Filter and pagination options for listing exams.
 */
export type TExamFilterOptions = TPaginationOptions & {
	sortOrder?: "asc" | "desc";
};

/**
 * Filter and pagination options for listing exam marks.
 */
export type TExamMarkFilterOptions = TPaginationOptions & {
	sortOrder?: "asc" | "desc";
};
