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
