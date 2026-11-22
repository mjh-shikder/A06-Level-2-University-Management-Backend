/**
 * Test helper fixtures and utilities for grading, transcript, and integration tests.
 */

export interface IMockCourseAttempt {
	courseId: string;
	code: string;
	title: string;
	credits: number;
	gradePoint: number;
	letterGrade: string;
	enrolledAt: Date;
}

/**
 * Creates a mock course attempt object for testing GPA and transcript calculations.
 */
export const createMockCourseAttempt = (
	overrides: Partial<IMockCourseAttempt> = {},
): IMockCourseAttempt => {
	return {
		courseId: overrides.courseId || "course-uuid-1",
		code: overrides.code || "CSE101",
		title: overrides.title || "Introduction to Computer Science",
		credits: overrides.credits ?? 3,
		gradePoint: overrides.gradePoint ?? 4.0,
		letterGrade: overrides.letterGrade || "A+",
		enrolledAt: overrides.enrolledAt || new Date("2026-01-15T00:00:00Z"),
	};
};
