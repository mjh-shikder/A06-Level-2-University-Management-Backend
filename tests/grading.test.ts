import { describe, expect, it } from "vitest";
import {
	computeCGPA,
	computeGrade,
	computeSGPA,
	filterLatestAttempts,
} from "../src/utils/grading";
import { createMockCourseAttempt } from "./helpers";

describe("Grading and GPA Utilities", () => {
	describe("computeGrade", () => {
		it("should return A+ (4.0) for score >= 80", () => {
			expect(computeGrade(100)).toEqual({ letter: "A+", point: 4.0 });
			expect(computeGrade(85)).toEqual({ letter: "A+", point: 4.0 });
			expect(computeGrade(80)).toEqual({ letter: "A+", point: 4.0 });
		});

		it("should return A (3.75) for 75 <= score < 80", () => {
			expect(computeGrade(79.9)).toEqual({ letter: "A", point: 3.75 });
			expect(computeGrade(75)).toEqual({ letter: "A", point: 3.75 });
		});

		it("should return A- (3.5) for 70 <= score < 75", () => {
			expect(computeGrade(74.5)).toEqual({ letter: "A-", point: 3.5 });
			expect(computeGrade(70)).toEqual({ letter: "A-", point: 3.5 });
		});

		it("should return B+ (3.25) for 65 <= score < 70", () => {
			expect(computeGrade(68)).toEqual({ letter: "B+", point: 3.25 });
			expect(computeGrade(65)).toEqual({ letter: "B+", point: 3.25 });
		});

		it("should return B (3.0) for 60 <= score < 65", () => {
			expect(computeGrade(63)).toEqual({ letter: "B", point: 3.0 });
			expect(computeGrade(60)).toEqual({ letter: "B", point: 3.0 });
		});

		it("should return B- (2.75) for 55 <= score < 60", () => {
			expect(computeGrade(58)).toEqual({ letter: "B-", point: 2.75 });
			expect(computeGrade(55)).toEqual({ letter: "B-", point: 2.75 });
		});

		it("should return C+ (2.5) for 50 <= score < 55", () => {
			expect(computeGrade(54)).toEqual({ letter: "C+", point: 2.5 });
			expect(computeGrade(50)).toEqual({ letter: "C+", point: 2.5 });
		});

		it("should return C (2.25) for 45 <= score < 50", () => {
			expect(computeGrade(49)).toEqual({ letter: "C", point: 2.25 });
			expect(computeGrade(45)).toEqual({ letter: "C", point: 2.25 });
		});

		it("should return D (2.0) for 40 <= score < 45", () => {
			expect(computeGrade(44)).toEqual({ letter: "D", point: 2.0 });
			expect(computeGrade(40)).toEqual({ letter: "D", point: 2.0 });
		});

		it("should return F (0.0) for score < 40", () => {
			expect(computeGrade(39.9)).toEqual({ letter: "F", point: 0.0 });
			expect(computeGrade(15)).toEqual({ letter: "F", point: 0.0 });
			expect(computeGrade(0)).toEqual({ letter: "F", point: 0.0 });
		});

		it("should clamp values outside 0 - 100 range", () => {
			expect(computeGrade(120)).toEqual({ letter: "A+", point: 4.0 });
			expect(computeGrade(-15)).toEqual({ letter: "F", point: 0.0 });
		});
	});

	describe("computeSGPA", () => {
		it("should return 0 when results array is empty", () => {
			expect(computeSGPA([])).toBe(0);
		});

		it("should return 0 when total credits is 0", () => {
			expect(computeSGPA([{ gradePoint: 4.0, credits: 0 }])).toBe(0);
		});

		it("should compute accurate SGPA for a single course", () => {
			expect(computeSGPA([{ gradePoint: 3.75, credits: 3 }])).toBe(3.75);
		});

		it("should compute accurate weighted SGPA for multiple courses", () => {
			// Course 1: 3 credits, 4.00 GP -> 12.00 QP
			// Course 2: 3 credits, 3.50 GP -> 10.50 QP
			// Course 3: 4 credits, 3.00 GP -> 12.00 QP
			// Total QP: 34.5, Total Credits: 10 => 34.5 / 10 = 3.45
			const results = [
				{ gradePoint: 4.0, credits: 3 },
				{ gradePoint: 3.5, credits: 3 },
				{ gradePoint: 3.0, credits: 4 },
			];
			expect(computeSGPA(results)).toBe(3.45);
		});

		it("should round to 2 decimal places", () => {
			// Course 1: 3 credits, 3.75 GP -> 11.25 QP
			// Course 2: 4 credits, 3.25 GP -> 13.00 QP
			// Course 3: 3 credits, 2.75 GP -> 8.25 QP
			// Total QP: 32.5, Total Credits: 10 => 3.25
			const results = [
				{ gradePoint: 3.75, credits: 3 },
				{ gradePoint: 3.25, credits: 4 },
				{ gradePoint: 2.75, credits: 3 },
			];
			expect(computeSGPA(results)).toBe(3.25);
		});

		it("should handle failing grades (0.0 GP)", () => {
			// Course 1: 3 credits, 0.0 GP -> 0 QP
			// Course 2: 3 credits, 0.0 GP -> 0 QP
			// Total QP: 0, Total Credits: 6 => 0.00
			const results = [
				{ gradePoint: 0.0, credits: 3 },
				{ gradePoint: 0.0, credits: 3 },
			];
			expect(computeSGPA(results)).toBe(0);
		});

		it("should handle Decimal-like objects from Prisma", () => {
			const results = [
				{ gradePoint: { toNumber: () => 4.0 }, credits: 3 },
				{ gradePoint: { toNumber: () => 3.0 }, credits: 3 },
			];
			expect(computeSGPA(results)).toBe(3.5);
		});
	});

	describe("computeCGPA", () => {
		it("should return 0 when empty", () => {
			expect(computeCGPA([])).toBe(0);
		});

		it("should compute cumulative GPA across courses", () => {
			const courses = [
				{ gradePoint: 4.0, credits: 3 },
				{ gradePoint: 3.5, credits: 3 },
				{ gradePoint: 3.75, credits: 4 },
				{ gradePoint: 3.0, credits: 3 },
			];
			// Total QP: 12 + 10.5 + 15 + 9 = 46.5
			// Total Credits: 13
			// CGPA: 46.5 / 13 = 3.5769... => 3.58
			expect(computeCGPA(courses)).toBe(3.58);
		});
	});

	describe("filterLatestAttempts (Retake Policy)", () => {
		it("should retain all courses when there are no retakes", () => {
			const attempts = [
				createMockCourseAttempt({
					courseId: "c1",
					enrolledAt: new Date("2026-01-10"),
				}),
				createMockCourseAttempt({
					courseId: "c2",
					enrolledAt: new Date("2026-01-10"),
				}),
			];

			const filtered = filterLatestAttempts(attempts);
			expect(filtered).toHaveLength(2);
			expect(filtered.map((c) => c.courseId)).toEqual(
				expect.arrayContaining(["c1", "c2"]),
			);
		});

		it("should keep only the latest attempt when a course is retaken", () => {
			const earlierAttempt = createMockCourseAttempt({
				courseId: "c1",
				gradePoint: 0.0,
				letterGrade: "F",
				enrolledAt: new Date("2025-09-01"),
			});
			const laterAttempt = createMockCourseAttempt({
				courseId: "c1",
				gradePoint: 3.75,
				letterGrade: "A",
				enrolledAt: new Date("2026-01-15"),
			});

			const attempts = [earlierAttempt, laterAttempt];
			const filtered = filterLatestAttempts(attempts);

			expect(filtered).toHaveLength(1);
			expect(filtered[0]?.gradePoint).toBe(3.75);
			expect(filtered[0]?.enrolledAt).toEqual(new Date("2026-01-15"));
		});

		it("should keep only the most recent attempt when a course is taken 3 times", () => {
			const attempt1 = createMockCourseAttempt({
				courseId: "c1",
				gradePoint: 0.0,
				enrolledAt: new Date("2025-01-01"),
			});
			const attempt2 = createMockCourseAttempt({
				courseId: "c1",
				gradePoint: 2.0,
				enrolledAt: new Date("2025-06-01"),
			});
			const attempt3 = createMockCourseAttempt({
				courseId: "c1",
				gradePoint: 3.5,
				enrolledAt: new Date("2026-01-01"),
			});

			const attempts = [attempt2, attempt1, attempt3];
			const filtered = filterLatestAttempts(attempts);

			expect(filtered).toHaveLength(1);
			expect(filtered[0]?.gradePoint).toBe(3.5);
			expect(filtered[0]?.enrolledAt).toEqual(new Date("2026-01-01"));
		});

		it("should correctly handle multiple courses with some retaken", () => {
			const c1_first = createMockCourseAttempt({
				courseId: "c1",
				credits: 3,
				gradePoint: 0.0,
				enrolledAt: new Date("2025-01-01"),
			});
			const c1_retake = createMockCourseAttempt({
				courseId: "c1",
				credits: 3,
				gradePoint: 4.0,
				enrolledAt: new Date("2025-09-01"),
			});
			const c2_first = createMockCourseAttempt({
				courseId: "c2",
				credits: 3,
				gradePoint: 3.0,
				enrolledAt: new Date("2025-01-01"),
			});

			const attempts = [c1_first, c2_first, c1_retake];
			const filtered = filterLatestAttempts(attempts);

			expect(filtered).toHaveLength(2);
			const c1 = filtered.find((c) => c.courseId === "c1");
			const c2 = filtered.find((c) => c.courseId === "c2");

			expect(c1?.gradePoint).toBe(4.0);
			expect(c2?.gradePoint).toBe(3.0);

			// CGPA should use the retake grade
			const cgpa = computeCGPA(filtered);
			// (4.0 * 3 + 3.0 * 3) / 6 = 3.5
			expect(cgpa).toBe(3.5);
		});

		it("should accurately reflect earned credits when calculating CGPA with retakes", () => {
			// Student took Math (3 cr) and got F (0.0). Failed course.
			// Later student took Math (3 cr) and got B (3.0). Passed course.
			// Student also took Physics (4 cr) and got A (3.75).
			const mathAttempt1 = createMockCourseAttempt({
				courseId: "math",
				credits: 3,
				gradePoint: 0.0,
				enrolledAt: new Date("2025-01-01"),
			});
			const mathAttempt2 = createMockCourseAttempt({
				courseId: "math",
				credits: 3,
				gradePoint: 3.0,
				enrolledAt: new Date("2025-09-01"),
			});
			const physics = createMockCourseAttempt({
				courseId: "physics",
				credits: 4,
				gradePoint: 3.75,
				enrolledAt: new Date("2025-01-01"),
			});

			const attempts = [mathAttempt1, physics, mathAttempt2];
			const latest = filterLatestAttempts(attempts);

			expect(latest).toHaveLength(2);

			const totalAttemptedCredits = latest.reduce((sum, c) => sum + c.credits, 0);
			const totalEarnedCredits = latest
				.filter((c) => c.gradePoint > 0)
				.reduce((sum, c) => sum + c.credits, 0);

			expect(totalAttemptedCredits).toBe(7); // 3 (math) + 4 (physics)
			expect(totalEarnedCredits).toBe(7); // both passed in latest attempt

			const cgpa = computeCGPA(latest);
			// (3.0 * 3 + 3.75 * 4) / 7 = (9 + 15) / 7 = 24 / 7 = 3.4285... => 3.43
			expect(cgpa).toBe(3.43);
		});

		it("should exclude failed retake credits from earned credits", () => {
			const cs101_1 = createMockCourseAttempt({
				courseId: "cs101",
				credits: 3,
				gradePoint: 0.0,
				enrolledAt: new Date("2025-01-01"),
			});
			const cs101_2 = createMockCourseAttempt({
				courseId: "cs101",
				credits: 3,
				gradePoint: 0.0,
				enrolledAt: new Date("2025-09-01"),
			});

			const latest = filterLatestAttempts([cs101_1, cs101_2]);
			expect(latest).toHaveLength(1);

			const totalEarned = latest
				.filter((c) => c.gradePoint > 0)
				.reduce((sum, c) => sum + c.credits, 0);

			expect(totalEarned).toBe(0);
			expect(computeCGPA(latest)).toBe(0);
		});
	});
});
