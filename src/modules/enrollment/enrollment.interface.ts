import type { EnrollmentStatus } from "../../../generated/prisma/client";
import type { TPaginationOptions } from "../../utils/paginate";

/**
 * Payload required to enroll in a course section.
 */
export type TEnrollSectionPayload = {
	sectionId: string;
};

/**
 * Structure of a schedule slot within a section's schedule.
 */
export type TScheduleSlot = {
	day: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
	startTime: string;
	endTime: string;
};

/**
 * Filter options for querying a student's own enrollments.
 */
export type TMyEnrollmentsFilterOptions = TPaginationOptions & {
	semesterId?: string;
	status?: EnrollmentStatus;
	sortOrder?: "asc" | "desc";
};

/**
 * Filter options for querying enrolled students in a section.
 */
export type TSectionStudentsFilterOptions = TPaginationOptions & {
	status?: EnrollmentStatus;
	sortOrder?: "asc" | "desc";
};
