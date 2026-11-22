import type { ResultStatus } from "../../../generated/prisma/client";
import type { TPaginationOptions } from "../../utils/paginate";

/**
 * Result returned after computing grades for a section.
 */
export type TComputeResultsResult = {
	sectionId: string;
	computedCount: number;
	records: Array<{
		enrollmentId: string;
		totalWeightedPercent: number;
		letterGrade: string;
		gradePoint: number;
		status: string;
	}>;
};

/**
 * Result returned after publishing section grades.
 */
export type TPublishResultsResult = {
	sectionId: string;
	publishedCount: number;
	publishedAt: Date;
	publishedBy: string;
};

/**
 * Result returned after unpublishing section grades.
 */
export type TUnpublishResultsResult = {
	sectionId: string;
	unpublishedCount: number;
};

/**
 * Options for filtering section results.
 */
export type TResultFilterOptions = TPaginationOptions & {
	sortOrder?: "asc" | "desc";
	status?: ResultStatus;
};

/**
 * Options for querying student's own published results.
 */
export type TMyResultsFilterOptions = TPaginationOptions & {
	semesterId?: string;
	sortOrder?: "asc" | "desc";
};
