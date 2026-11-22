/**
 * Types and interfaces for Transcript and GPA calculations.
 */

export interface ITranscriptCourseItem {
	courseId: string;
	code: string;
	title: string;
	credits: number;
	grade: string;
	gradePoint: number;
	totalWeightedPercent: number;
	isRetake: boolean;
	isLatestAttempt: boolean;
}

export interface ITranscriptSemesterItem {
	semester: {
		id: string;
		name: string;
		year: number;
		term: string;
	};
	courses: ITranscriptCourseItem[];
	sgpa: number;
	totalCredits: number;
	totalCreditsEarned: number;
}

export interface IStudentTranscriptResponse {
	student: {
		id: string;
		userId: string;
		studentId: string;
		name: string;
		email: string;
		program: string | null;
	};
	semesters: ITranscriptSemesterItem[];
	cgpa: number;
	totalCreditsAttempted: number;
	totalCreditsEarned: number;
}

export interface ISemesterGPASummaryItem {
	semesterId: string;
	semesterName: string;
	year: number;
	term: string;
	sgpa: number;
	credits: number;
	creditsEarned: number;
}

export interface IStudentGPASummaryResponse {
	student: {
		id: string;
		studentId: string;
		name: string;
	};
	cgpa: number;
	totalCreditsAttempted: number;
	totalCreditsEarned: number;
	semesterGPAs: ISemesterGPASummaryItem[];
}
