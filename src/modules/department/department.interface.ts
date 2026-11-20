import type { TPaginationOptions } from "../../utils/paginate";

/**
 * Payload interface for creating a new department.
 */
export type TCreateDepartmentPayload = {
	name: string;
	code: string;
	description?: string;
};

/**
 * Payload interface for updating an existing department.
 */
export type TUpdateDepartmentPayload = {
	name?: string;
	code?: string;
	description?: string;
};

/**
 * Filter options for querying departments including search and pagination.
 */
export type TDepartmentFilterOptions = TPaginationOptions & {
	q?: string;
};
