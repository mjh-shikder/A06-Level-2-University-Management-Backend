import httpStatus from "http-status";
import type { Role } from "../../../generated/prisma/client";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { computeCGPA, computeSGPA } from "../../utils/grading";
import type {
	IStudentGPASummaryResponse,
	IStudentTranscriptResponse,
	ITranscriptCourseItem,
	ITranscriptSemesterItem,
} from "./transcript.interface";

/**
 * UUID regex for testing if identifier is a valid UUID string.
 */
const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Helper to retrieve a student profile by either UUID (profile id or user id)
 * or formatted studentId (e.g. "STU-2026-0001").
 */
const resolveStudentProfile = async (identifier: string) => {
	const isUUID = UUID_REGEX.test(identifier);

	const studentProfile = await prisma.studentProfile.findFirst({
		where: {
			...(isUUID
				? {
						OR: [{ id: identifier }, { userId: identifier }],
					}
				: {
						studentId: identifier,
					}),
			deletedAt: null,
		},
		include: {
			user: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					role: true,
					status: true,
				},
			},
			program: {
				select: {
					id: true,
					code: true,
					name: true,
					requiredCredits: true,
				},
			},
		},
	});

	if (!studentProfile) {
		throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
	}

	return studentProfile;
};

/**
 * Internal core engine to compile a student's official transcript and GPA records.
 *
 * Enforces:
 * 1. Only enrollments with PUBLISHED, non-deleted Results are included.
 * 2. Retake Policy (Latest Attempt Counts):
 *    - Each semester's SGPA is calculated from all published results in that specific semester.
 *    - For CGPA and cumulative earned credits, only the latest attempt (by enrolledAt)
 *      of each unique courseId counts. Earlier attempts for the same course are marked
 *      as superseded and excluded from the CGPA.
 *
 * @param studentProfile The student profile record
 * @returns Fully computed transcript object
 */
const buildTranscriptData = async (
	studentProfile: Awaited<ReturnType<typeof resolveStudentProfile>>,
): Promise<IStudentTranscriptResponse> => {
	// 1. Fetch all enrollments having published results, ordered chronologically
	const enrollments = await prisma.enrollment.findMany({
		where: {
			studentId: studentProfile.id,
			deletedAt: null,
			result: {
				status: "PUBLISHED",
				deletedAt: null,
			},
		},
		include: {
			result: true,
			section: {
				include: {
					course: {
						select: {
							id: true,
							code: true,
							title: true,
							credits: true,
						},
					},
					semester: {
						select: {
							id: true,
							name: true,
							year: true,
							term: true,
							startDate: true,
							endDate: true,
						},
					},
				},
			},
		},
		orderBy: [
			{ section: { semester: { startDate: "asc" } } },
			{ enrolledAt: "asc" },
		],
	});

	// 2. Identify latest attempts per courseId for retake policy
	// Map courseId -> array of enrollments sorted by enrolledAt ascending
	const courseAttemptsMap = new Map<string, typeof enrollments>();
	for (const enrollment of enrollments) {
		const courseId = enrollment.section.course.id;
		const existing = courseAttemptsMap.get(courseId) || [];
		existing.push(enrollment);
		courseAttemptsMap.set(courseId, existing);
	}

	// Set of enrollment IDs that are the latest attempt for their course
	const latestAttemptEnrollmentIds = new Set<string>();
	const retakeEnrollmentIds = new Set<string>();

	for (const [, attempts] of courseAttemptsMap.entries()) {
		// Sort chronologically by enrolledAt
		attempts.sort(
			(a, b) =>
				new Date(a.enrolledAt).getTime() - new Date(b.enrolledAt).getTime(),
		);

		// The last element in chronological order is the latest attempt
		const latest = attempts[attempts.length - 1];
		if (latest) {
			latestAttemptEnrollmentIds.add(latest.id);
		}

		// Any attempt after the first attempt is a retake
		for (let i = 1; i < attempts.length; i++) {
			const attempt = attempts[i];
			if (attempt) {
				retakeEnrollmentIds.add(attempt.id);
			}
		}
	}

	// 3. Group courses by semester
	const semesterMap = new Map<
		string,
		{
			semester: {
				id: string;
				name: string;
				year: number;
				term: string;
				startDate: Date;
			};
			courses: ITranscriptCourseItem[];
		}
	>();

	for (const enrollment of enrollments) {
		const sem = enrollment.section.semester;
		const res = enrollment.result;
		if (!res) continue;

		const course = enrollment.section.course;
		const isLatestAttempt = latestAttemptEnrollmentIds.has(enrollment.id);
		const isRetake = retakeEnrollmentIds.has(enrollment.id);

		const gradePoint = Number(res.gradePoint);
		const totalWeightedPercent = Number(res.totalWeightedPercent);
		const credits = course.credits;

		const courseItem: ITranscriptCourseItem = {
			courseId: course.id,
			code: course.code,
			title: course.title,
			credits,
			grade: res.letterGrade,
			gradePoint,
			totalWeightedPercent,
			isRetake,
			isLatestAttempt,
		};

		const existingSem = semesterMap.get(sem.id);
		if (existingSem) {
			existingSem.courses.push(courseItem);
		} else {
			semesterMap.set(sem.id, {
				semester: {
					id: sem.id,
					name: sem.name,
					year: sem.year,
					term: sem.term,
					startDate: sem.startDate,
				},
				courses: [courseItem],
			});
		}
	}

	// Sort semesters chronologically by startDate
	const sortedSemesters = Array.from(semesterMap.values()).sort(
		(a, b) =>
			new Date(a.semester.startDate).getTime() -
			new Date(b.semester.startDate).getTime(),
	);

	const semestersOutput: ITranscriptSemesterItem[] = sortedSemesters.map(
		(s) => {
			const sgpa = computeSGPA(
				s.courses.map((c) => ({
					gradePoint: c.gradePoint,
					credits: c.credits,
				})),
			);
			const totalCredits = s.courses.reduce((sum, c) => sum + c.credits, 0);
			const totalCreditsEarned = s.courses
				.filter((c) => c.gradePoint > 0)
				.reduce((sum, c) => sum + c.credits, 0);

			return {
				semester: {
					id: s.semester.id,
					name: s.semester.name,
					year: s.semester.year,
					term: s.semester.term,
				},
				courses: s.courses,
				sgpa,
				totalCredits,
				totalCreditsEarned,
			};
		},
	);

	// 4. Compute Cumulative CGPA and total earned credits based on latest attempts only
	const latestCoursesForCGPA: Array<{ gradePoint: number; credits: number }> =
		[];
	let totalCreditsAttempted = 0;
	let totalCreditsEarned = 0;

	for (const sem of semestersOutput) {
		for (const course of sem.courses) {
			if (course.isLatestAttempt) {
				latestCoursesForCGPA.push({
					gradePoint: course.gradePoint,
					credits: course.credits,
				});
				totalCreditsAttempted += course.credits;
				if (course.gradePoint > 0) {
					totalCreditsEarned += course.credits;
				}
			}
		}
	}

	const cgpa = computeCGPA(latestCoursesForCGPA);

	return {
		student: {
			id: studentProfile.id,
			userId: studentProfile.userId,
			studentId: studentProfile.studentId,
			name: `${studentProfile.user.firstName} ${studentProfile.user.lastName}`,
			email: studentProfile.user.email,
			program: studentProfile.program?.name || null,
		},
		semesters: semestersOutput,
		cgpa,
		totalCreditsAttempted,
		totalCreditsEarned,
	};
};

/**
 * Get authenticated student's own official transcript.
 *
 * @param userId ID of the authenticated user
 */
const getMyTranscript = async (
	userId: string,
): Promise<IStudentTranscriptResponse> => {
	const studentProfile = await prisma.studentProfile.findUnique({
		where: { userId },
		include: {
			user: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					role: true,
					status: true,
				},
			},
			program: {
				select: {
					id: true,
					code: true,
					name: true,
					requiredCredits: true,
				},
			},
		},
	});

	if (!studentProfile) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Student profile not found for authenticated user",
		);
	}

	return buildTranscriptData(studentProfile);
};

/**
 * Get authenticated student's own GPA summary.
 *
 * @param userId ID of the authenticated user
 */
const getMyGPASummary = async (
	userId: string,
): Promise<IStudentGPASummaryResponse> => {
	const transcript = await getMyTranscript(userId);

	return {
		student: {
			id: transcript.student.id,
			studentId: transcript.student.studentId,
			name: transcript.student.name,
		},
		cgpa: transcript.cgpa,
		totalCreditsAttempted: transcript.totalCreditsAttempted,
		totalCreditsEarned: transcript.totalCreditsEarned,
		semesterGPAs: transcript.semesters.map((s) => ({
			semesterId: s.semester.id,
			semesterName: s.semester.name,
			year: s.semester.year,
			term: s.semester.term,
			sgpa: s.sgpa,
			credits: s.totalCredits,
			creditsEarned: s.totalCreditsEarned,
		})),
	};
};

/**
 * Get any student's transcript by studentId (profile UUID, user UUID, or formatted studentId).
 * Enforces RBAC:
 * - ADMIN and INSTRUCTOR can view any student's transcript.
 * - STUDENT can only view their own transcript.
 *
 * @param identifier Student profile ID, user ID, or formatted student ID
 * @param requestingUser Authenticated user
 */
const getStudentTranscript = async (
	identifier: string,
	requestingUser: { id: string; role: Role },
): Promise<IStudentTranscriptResponse> => {
	const studentProfile = await resolveStudentProfile(identifier);

	// Check access permissions
	if (requestingUser.role === "STUDENT") {
		if (studentProfile.userId !== requestingUser.id) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Access denied: you can only view your own transcript",
			);
		}
	}

	return buildTranscriptData(studentProfile);
};

/**
 * Get any student's GPA summary by studentId.
 * Enforces RBAC matching getStudentTranscript.
 *
 * @param identifier Student profile ID, user ID, or formatted student ID
 * @param requestingUser Authenticated user
 */
const getStudentGPASummary = async (
	identifier: string,
	requestingUser: { id: string; role: Role },
): Promise<IStudentGPASummaryResponse> => {
	const transcript = await getStudentTranscript(identifier, requestingUser);

	return {
		student: {
			id: transcript.student.id,
			studentId: transcript.student.studentId,
			name: transcript.student.name,
		},
		cgpa: transcript.cgpa,
		totalCreditsAttempted: transcript.totalCreditsAttempted,
		totalCreditsEarned: transcript.totalCreditsEarned,
		semesterGPAs: transcript.semesters.map((s) => ({
			semesterId: s.semester.id,
			semesterName: s.semester.name,
			year: s.semester.year,
			term: s.semester.term,
			sgpa: s.sgpa,
			credits: s.totalCredits,
			creditsEarned: s.totalCreditsEarned,
		})),
	};
};

export const TranscriptService = {
	getMyTranscript,
	getMyGPASummary,
	getStudentTranscript,
	getStudentGPASummary,
};
