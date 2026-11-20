import type { TPaginationOptions } from "../../utils/paginate";

/**
 * Payload interface for creating a new program under a department.
 */
export type TCreateProgramPayload = {
	name: string;
	code: string;
	departmentId: string;
	requiredCredits: number;
};

/**
 * Payload interface for updating an existing program.
 */
export type TUpdateProgramPayload = {
	name?: string;
	code?: string;
	departmentId?: string;
	requiredCredits?: number;
};

/**
 * Filter options for querying programs including search, department filtering, and pagination.
 */
export type TProgramFilterOptions = TPaginationOptions & {
	q?: string;
	departmentId?: string;
};
