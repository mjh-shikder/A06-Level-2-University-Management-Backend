import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import config from "../src/config";
import { prisma } from "../src/lib/prisma";

describe("Transcript and GPA API Integration", () => {
	it("should reject unauthenticated requests with 401", async () => {
		const res = await request(app).get("/api/v1/students/me/transcript");
		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("should reject unauthorized student from viewing another student's transcript", async () => {
		const studentProfile = await prisma.studentProfile.findFirst({
			where: { user: { status: "ACTIVE" } },
			include: { user: true },
		});
		if (!studentProfile) return;

		const studentToken = jwt.sign(
			{
				userId: studentProfile.user.id,
				email: studentProfile.user.email,
				role: "STUDENT",
			},
			config.jwt.accessSecret,
			{ expiresIn: "1h" },
		);

		// Another student's UUID
		const fakeOtherStudentId = "00000000-0000-0000-0000-000000000000";
		const res = await request(app)
			.get(`/api/v1/students/${fakeOtherStudentId}/transcript`)
			.set("Authorization", `Bearer ${studentToken}`);

		expect([403, 404]).toContain(res.status);
	});

	it("should allow student to fetch own transcript and gpa", async () => {
		const studentProfile = await prisma.studentProfile.findFirst({
			where: { user: { status: "ACTIVE" } },
			include: { user: true },
		});
		if (!studentProfile) return;

		const studentToken = jwt.sign(
			{
				userId: studentProfile.user.id,
				email: studentProfile.user.email,
				role: "STUDENT",
			},
			config.jwt.accessSecret,
			{ expiresIn: "1h" },
		);

		const resTranscript = await request(app)
			.get("/api/v1/students/me/transcript")
			.set("Authorization", `Bearer ${studentToken}`);

		expect(resTranscript.status).toBe(200);
		expect(resTranscript.body.success).toBe(true);
		expect(resTranscript.body.data).toHaveProperty("student");
		expect(resTranscript.body.data).toHaveProperty("semesters");
		expect(resTranscript.body.data).toHaveProperty("cgpa");
		expect(resTranscript.body.data).toHaveProperty("totalCreditsEarned");

		const resGPA = await request(app)
			.get("/api/v1/students/me/gpa")
			.set("Authorization", `Bearer ${studentToken}`);

		expect(resGPA.status).toBe(200);
		expect(resGPA.body.success).toBe(true);
		expect(resGPA.body.data).toHaveProperty("cgpa");
		expect(resGPA.body.data).toHaveProperty("semesterGPAs");
	});

	it("should allow admin to view any student's transcript and gpa", async () => {
		const adminUser = await prisma.user.findFirst({
			where: { role: "ADMIN", status: "ACTIVE" },
		});
		const studentProfile = await prisma.studentProfile.findFirst({
			where: { user: { status: "ACTIVE" } },
			include: { user: true },
		});
		if (!adminUser || !studentProfile) return;

		const adminToken = jwt.sign(
			{
				userId: adminUser.id,
				email: adminUser.email,
				role: "ADMIN",
			},
			config.jwt.accessSecret,
			{ expiresIn: "1h" },
		);

		const res = await request(app)
			.get(`/api/v1/students/${studentProfile.studentId}/transcript`)
			.set("Authorization", `Bearer ${adminToken}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.student.studentId).toBe(studentProfile.studentId);

		const resGPA = await request(app)
			.get(`/api/v1/students/${studentProfile.studentId}/gpa`)
			.set("Authorization", `Bearer ${adminToken}`);

		expect(resGPA.status).toBe(200);
		expect(resGPA.body.success).toBe(true);
	});
});
