import type { AttendanceStatus } from "../../../generated/prisma/client";
import type { TPaginationOptions } from "../../utils/paginate";

/**
 * An individual attendance entry for bulk submission.
 */
export type TAttendanceRecordInput = {
	enrollmentId: string;
	status: AttendanceStatus;
	remarks?: string;
};

/**
 * Payload for bulk marking section attendance.
 */
export type TBulkMarkAttendancePayload = {
	date: string;
	records: TAttendanceRecordInput[];
};

/**
 * Filter options for querying a section's attendance list.
 */
export type TSectionAttendanceFilterOptions = TPaginationOptions & {
	date?: string;
	sortOrder?: "asc" | "desc";
};

/**
 * Filter options for querying an individual enrollment's attendance history.
 */
export type TEnrollmentAttendanceFilterOptions = TPaginationOptions & {
	startDate?: string;
	endDate?: string;
	status?: AttendanceStatus;
	sortOrder?: "asc" | "desc";
};

/**
 * Attendance summary metrics for an enrollment.
 */
export type TAttendanceSummary = {
	enrollmentId: string;
	total: number;
	present: number;
	absent: number;
	late: number;
	excused: number;
	percentage: number;
};
