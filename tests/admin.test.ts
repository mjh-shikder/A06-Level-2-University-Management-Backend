import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import config from "../src/config";
import { prisma } from "../src/lib/prisma";

describe("Admin Operations API", () => {
	it("should reject unauthenticated requests to /admin endpoints", async () => {
		const res = await request(app).get("/api/v1/admin/dashboard");
		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("should reject non-admin users (STUDENT, INSTRUCTOR) from admin endpoints", async () => {
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

		const res = await request(app)
			.get("/api/v1/admin/dashboard")
			.set("Authorization", `Bearer ${studentToken}`);

		expect(res.status).toBe(403);
		expect(res.body.success).toBe(false);
	});

	it("should allow admin to list users with filtering and pagination without exposing passwordHash", async () => {
		const adminUser = await prisma.user.findFirst({
			where: { role: "ADMIN", status: "ACTIVE" },
		});
		if (!adminUser) return;

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
			.get("/api/v1/admin/users")
			.set("Authorization", `Bearer ${adminToken}`)
			.query({ page: 1, limit: 10, role: "STUDENT" });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.meta).toHaveProperty("total");
		expect(Array.isArray(res.body.data)).toBe(true);

		// Ensure passwordHash is never returned
		for (const u of res.body.data) {
			expect(u).not.toHaveProperty("passwordHash");
			expect(u).toHaveProperty("id");
			expect(u).toHaveProperty("email");
			expect(u).toHaveProperty("role");
		}
	});

	it("should allow admin to update a user's role and record an audit log", async () => {
		const adminUser = await prisma.user.findFirst({
			where: { role: "ADMIN", status: "ACTIVE" },
		});
		if (!adminUser) return;

		// Create isolated target user for role modification test
		const targetStudent = await prisma.user.create({
			data: {
				email: `admin-role-target-${Date.now()}@example.com`,
				passwordHash: "$2b$12$dummyhashforadmintestingonly",
				firstName: "RoleTarget",
				lastName: "Student",
				role: "STUDENT",
				status: "ACTIVE",
			},
		});

		const adminToken = jwt.sign(
			{
				userId: adminUser.id,
				email: adminUser.email,
				role: "ADMIN",
			},
			config.jwt.accessSecret,
			{ expiresIn: "1h" },
		);

		// Attempt to demote self -> should be blocked
		const selfDemoteRes = await request(app)
			.patch(`/api/v1/admin/users/${adminUser.id}/role`)
			.set("Authorization", `Bearer ${adminToken}`)
			.send({ role: "STUDENT" });

		expect(selfDemoteRes.status).toBe(400);

		// Change target student to INSTRUCTOR
		const changeRes = await request(app)
			.patch(`/api/v1/admin/users/${targetStudent.id}/role`)
			.set("Authorization", `Bearer ${adminToken}`)
			.send({ role: "INSTRUCTOR" });

		expect(changeRes.status).toBe(200);
		expect(changeRes.body.data.role).toBe("INSTRUCTOR");

		// Verify audit log exists
		const audit = await prisma.auditLog.findFirst({
			where: {
				action: "UPDATE_USER_ROLE",
				entityId: targetStudent.id,
			},
			orderBy: { createdAt: "desc" },
		});
		expect(audit).toBeDefined();
		expect(audit?.actorId).toBe(adminUser.id);

		// Clean up isolated test user
		await prisma.user.delete({ where: { id: targetStudent.id } });
	});

	it("should allow admin to update a user's status and revoke refresh tokens on suspension", async () => {
		const adminUser = await prisma.user.findFirst({
			where: { role: "ADMIN", status: "ACTIVE" },
		});
		if (!adminUser) return;

		// Create isolated target user for status modification test
		const targetStudent = await prisma.user.create({
			data: {
				email: `admin-status-target-${Date.now()}@example.com`,
				passwordHash: "$2b$12$dummyhashforadmintestingonly",
				firstName: "StatusTarget",
				lastName: "Student",
				role: "STUDENT",
				status: "ACTIVE",
			},
		});

		const adminToken = jwt.sign(
			{
				userId: adminUser.id,
				email: adminUser.email,
				role: "ADMIN",
			},
			config.jwt.accessSecret,
			{ expiresIn: "1h" },
		);

		// Self-status modification blocked
		const selfStatusRes = await request(app)
			.patch(`/api/v1/admin/users/${adminUser.id}/status`)
			.set("Authorization", `Bearer ${adminToken}`)
			.send({ status: "SUSPENDED" });

		expect(selfStatusRes.status).toBe(400);

		// Create a mock active refresh token for target user
		const mockRefreshToken = await prisma.refreshToken.create({
			data: {
				userId: targetStudent.id,
				tokenHash: `test-hash-${Date.now()}`,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				revoked: false,
			},
		});

		// Suspend target student
		const suspendRes = await request(app)
			.patch(`/api/v1/admin/users/${targetStudent.id}/status`)
			.set("Authorization", `Bearer ${adminToken}`)
			.send({ status: "SUSPENDED" });

		expect(suspendRes.status).toBe(200);
		expect(suspendRes.body.data.status).toBe("SUSPENDED");

		// Verify refresh token was revoked
		const updatedToken = await prisma.refreshToken.findUnique({
			where: { id: mockRefreshToken.id },
		});
		expect(updatedToken?.revoked).toBe(true);

		// Clean up token & target test user
		await prisma.refreshToken.delete({ where: { id: mockRefreshToken.id } });
		await prisma.user.delete({ where: { id: targetStudent.id } });
	});

	it("should retrieve dashboard statistics", async () => {
		const adminUser = await prisma.user.findFirst({
			where: { role: "ADMIN", status: "ACTIVE" },
		});
		if (!adminUser) return;

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
			.get("/api/v1/admin/dashboard")
			.set("Authorization", `Bearer ${adminToken}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toHaveProperty("users");
		expect(res.body.data.users).toHaveProperty("total");
		expect(res.body.data.users).toHaveProperty("byRole");
		expect(res.body.data.users).toHaveProperty("byStatus");
		expect(res.body.data).toHaveProperty("academics");
		expect(res.body.data).toHaveProperty("enrollments");
		expect(res.body.data).toHaveProperty("financials");
		expect(res.body.data).toHaveProperty("recentActivity");
	});

	it("should list audit logs with filters", async () => {
		const adminUser = await prisma.user.findFirst({
			where: { role: "ADMIN", status: "ACTIVE" },
		});
		if (!adminUser) return;

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
			.get("/api/v1/admin/audit-logs")
			.set("Authorization", `Bearer ${adminToken}`)
			.query({ page: 1, limit: 10 });

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.meta).toHaveProperty("total");
		expect(Array.isArray(res.body.data)).toBe(true);
	});

	it("should generate a comprehensive semester report", async () => {
		const adminUser = await prisma.user.findFirst({
			where: { role: "ADMIN", status: "ACTIVE" },
		});
		const semester = await prisma.semester.findFirst();

		if (!adminUser || !semester) return;

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
			.get(`/api/v1/admin/semesters/${semester.id}/report`)
			.set("Authorization", `Bearer ${adminToken}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toHaveProperty("semester");
		expect(res.body.data).toHaveProperty("enrollments");
		expect(res.body.data).toHaveProperty("financials");
		expect(res.body.data).toHaveProperty("academics");
		expect(res.body.data.academics).toHaveProperty("averageGPA");
		expect(res.body.data.academics).toHaveProperty("passRatePercent");
		expect(res.body.data.academics).toHaveProperty("gradeDistribution");
	});
});
