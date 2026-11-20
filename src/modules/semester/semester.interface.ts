import type { SemesterStatus } from "../../../generated/prisma/client";
import type { TPaginationOptions } from "../../utils/paginate";

/**
 * Payload interface for creating a new semester.
 */
export type TCreateSemesterPayload = {
	name: string;
	year: number;
	term: "Spring" | "Summer" | "Fall";
	startDate: string;
	endDate: string;
	registrationStart?: string;
	registrationEnd?: string;
	status?: SemesterStatus;
};

/**
 * Payload interface for updating semester details.
 */
export type TUpdateSemesterPayload = {
	name?: string;
	year?: number;
	term?: "Spring" | "Summer" | "Fall";
	startDate?: string;
	endDate?: string;
	registrationStart?: string;
	registrationEnd?: string;
};

/**
 * Payload interface for updating semester status.
 */
export type TUpdateSemesterStatusPayload = {
	status: SemesterStatus;
};

/**
 * Filter options for querying semesters with pagination and filters.
 */
export type TSemesterFilterOptions = TPaginationOptions & {
	q?: string;
	status?: SemesterStatus;
	year?: number;
};
