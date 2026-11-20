import type { TPaginationOptions } from "../../utils/paginate";

/**
 * Weekly schedule slot representing days and class times.
 */
export type TScheduleSlot = {
	day: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
	startTime: string; // HH:mm format e.g. "09:00"
	endTime: string; // HH:mm format e.g. "10:30"
};

/**
 * Payload interface for creating a course section.
 */
export type TCreateSectionPayload = {
	sectionNumber: string;
	courseId: string;
	semesterId: string;
	instructorId?: string | null;
	capacity: number;
	schedule: TScheduleSlot[];
	room?: string;
};

/**
 * Payload interface for updating an existing section.
 */
export type TUpdateSectionPayload = {
	sectionNumber?: string;
	instructorId?: string | null;
	capacity?: number;
	schedule?: TScheduleSlot[];
	room?: string;
};

/**
 * Payload interface for assigning or unassigning an instructor.
 */
export type TAssignInstructorPayload = {
	instructorId: string | null;
};

/**
 * Filter options for querying sections.
 */
export type TSectionFilterOptions = TPaginationOptions & {
	semesterId?: string;
	courseId?: string;
	instructorId?: string;
	q?: string;
};
