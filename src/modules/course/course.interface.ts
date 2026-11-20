import type { TPaginationOptions } from "../../utils/paginate";

/**
 * Payload interface for creating a new course.
 */
export type TCreateCoursePayload = {
	title: string;
	code: string;
	credits: number;
	programId: string;
	description?: string;
};

/**
 * Payload interface for updating an existing course.
 */
export type TUpdateCoursePayload = {
	title?: string;
	code?: string;
	credits?: number;
	programId?: string;
	description?: string;
};

/**
 * Payload interface for adding a prerequisite to a course.
 */
export type TAddPrerequisitePayload = {
	prerequisiteId: string;
};

/**
 * Filter options for querying courses including search, program filtering, and pagination.
 */
export type TCourseFilterOptions = TPaginationOptions & {
	q?: string;
	programId?: string;
};
