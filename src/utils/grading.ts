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
