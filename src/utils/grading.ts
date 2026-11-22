import { GRADE_SCALE } from "./constants";

/**
 * Computes letter grade and grade point from a total weighted percent score.
 *
 * @param weightedPercent Total weighted score (0 to 100)
 * @returns Object with letter grade and grade point
 */
export const computeGrade = (
	weightedPercent: number,
): { letter: string; point: number } => {
	const clampedPercent = Math.max(0, Math.min(100, weightedPercent));
	const entry = GRADE_SCALE.find((g) => clampedPercent >= g.min);
	if (!entry) {
		return { letter: "F", point: 0.0 };
	}
	return { letter: entry.letter, point: entry.point };
};

/**
 * Helper to safely extract a numeric value from a number or Prisma Decimal object.
 */
const extractNumericValue = (
	val: number | { toNumber?: () => number } | string | null | undefined,
): number => {
	if (typeof val === "number") {
		return val;
	}
	if (
		val &&
		typeof val === "object" &&
		"toNumber" in val &&
		typeof (val as { toNumber?: () => number }).toNumber === "function"
	) {
		return (val as { toNumber: () => number }).toNumber();
	}
	return Number(val) || 0;
};

/**
 * Computes the Semester Grade Point Average (SGPA) for a single semester.
 *
 * Formula:
 * SGPA = (Sum of [Grade Point * Credits]) / (Total Credits)
 * Rounded to 2 decimal places. If total credits is 0, returns 0.
 *
 * @param results Array of course results with gradePoint and credits
 * @returns SGPA rounded to 2 decimal places
 */
export const computeSGPA = (
	results: Array<{
		gradePoint: number | { toNumber?: () => number };
		credits: number | { toNumber?: () => number };
	}>,
): number => {
	let totalQualityPoints = 0;
	let totalCredits = 0;

	for (const r of results) {
		const gp = extractNumericValue(r.gradePoint);
		const credits = extractNumericValue(r.credits);

		totalQualityPoints += gp * credits;
		totalCredits += credits;
	}

	if (totalCredits === 0) {
		return 0;
	}

	return Math.round((totalQualityPoints / totalCredits) * 100) / 100;
};

/**
 * Computes the Cumulative Grade Point Average (CGPA) across all completed courses.
 * Uses the same formula as SGPA across all qualifying course attempts.
 *
 * @param allResults Array of qualifying course results with gradePoint and credits
 * @returns CGPA rounded to 2 decimal places
 */
export const computeCGPA = (
	allResults: Array<{
		gradePoint: number | { toNumber?: () => number };
		credits: number | { toNumber?: () => number };
	}>,
): number => {
	return computeSGPA(allResults);
};

/**
 * Retake policy: Filters course attempts so that only the latest attempt
 * (by enrolledAt timestamp, or createdAt as fallback) for each unique courseId
 * counts toward cumulative GPA.
 *
 * @param attempts Array of course attempts with courseId and enrolledAt
 * @returns Array containing only the latest attempt for each unique course
 */
export const filterLatestAttempts = <
	T extends { courseId: string; enrolledAt: Date | string | number },
>(
	attempts: T[],
): T[] => {
	// Sort descending by enrolledAt (latest first)
	const sorted = [...attempts].sort(
		(a, b) =>
			new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime(),
	);
	const seenCourses = new Set<string>();
	const latest: T[] = [];

	for (const attempt of sorted) {
		if (!seenCourses.has(attempt.courseId)) {
			seenCourses.add(attempt.courseId);
			latest.push(attempt);
		}
	}

	return latest;
};
