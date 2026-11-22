import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import config from "../src/config";
import { prisma } from "../src/lib/prisma";
import { stripeClient } from "../src/lib/payment/stripe";

describe("Invoices and Payments API", () => {
	it("should reject unauthenticated invoice requests", async () => {
		const res = await request(app).get("/api/v1/invoices");
		expect(res.status).toBe(401);
		expect(res.body.success).toBe(false);
	});

	it("should reject student from creating invoices (ADMIN only)", async () => {
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
			.post("/api/v1/invoices")
			.set("Authorization", `Bearer ${studentToken}`)
			.send({
				studentId: studentProfile.id,
				semesterId: "00000000-0000-0000-0000-000000000000",
				amount: 500,
				dueDate: new Date().toISOString(),
			});

		expect(res.status).toBe(403);
	});

	it("should allow admin to create an invoice and list invoices", async () => {
		const adminUser = await prisma.user.findFirst({
			where: { role: "ADMIN", status: "ACTIVE" },
		});
		const studentProfile = await prisma.studentProfile.findFirst({
			where: { user: { status: "ACTIVE" } },
			include: { user: true },
		});
		const semester = await prisma.semester.findFirst();

		if (!adminUser || !studentProfile || !semester) return;

		const adminToken = jwt.sign(
			{
				userId: adminUser.id,
				email: adminUser.email,
				role: "ADMIN",
			},
			config.jwt.accessSecret,
			{ expiresIn: "1h" },
		);

		// 1. Create Invoice
		const dueDate = new Date();
		dueDate.setDate(dueDate.getDate() + 30);

		const createRes = await request(app)
			.post("/api/v1/invoices")
			.set("Authorization", `Bearer ${adminToken}`)
			.send({
				studentId: studentProfile.id,
				semesterId: semester.id,
				amount: 750.5,
				dueDate: dueDate.toISOString(),
				description: "Spring Semester Tuition Fee",
			});

		expect(createRes.status).toBe(201);
		expect(createRes.body.success).toBe(true);
		expect(createRes.body.data).toHaveProperty("id");
		expect(createRes.body.data.status).toBe("PENDING");

		const invoiceId = createRes.body.data.id;

		// 2. List Invoices as Admin
		const listRes = await request(app)
			.get("/api/v1/invoices")
			.set("Authorization", `Bearer ${adminToken}`)
			.query({ studentId: studentProfile.id });

		expect(listRes.status).toBe(200);
		expect(listRes.body.success).toBe(true);
		expect(Array.isArray(listRes.body.data)).toBe(true);
		const found = listRes.body.data.find((inv: { id: string }) => inv.id === invoiceId);
		expect(found).toBeDefined();

		// 3. Get Invoice By ID as Admin
		const getRes = await request(app)
			.get(`/api/v1/invoices/${invoiceId}`)
			.set("Authorization", `Bearer ${adminToken}`);

		expect(getRes.status).toBe(200);
		expect(getRes.body.data.id).toBe(invoiceId);

		// 4. Student views own invoices via /invoices/my
		const studentToken = jwt.sign(
			{
				userId: studentProfile.user.id,
				email: studentProfile.user.email,
				role: "STUDENT",
			},
			config.jwt.accessSecret,
			{ expiresIn: "1h" },
		);

		const myInvoicesRes = await request(app)
			.get("/api/v1/invoices/my")
			.set("Authorization", `Bearer ${studentToken}`);

		expect(myInvoicesRes.status).toBe(200);
		expect(myInvoicesRes.body.success).toBe(true);
		const myFound = myInvoicesRes.body.data.find(
			(inv: { id: string }) => inv.id === invoiceId,
		);
		expect(myFound).toBeDefined();

		// 5. Student initiates payment -> Stripe checkout session
		vi.spyOn(stripeClient.checkout.sessions, "create").mockResolvedValueOnce({
			id: "cs_test_mock_session_123",
			url: "https://checkout.stripe.com/mock-session",
		} as unknown as Awaited<
			ReturnType<typeof stripeClient.checkout.sessions.create>
		>);

		const payRes = await request(app)
			.post(`/api/v1/invoices/${invoiceId}/pay`)
			.set("Authorization", `Bearer ${studentToken}`);

		expect(payRes.status).toBe(200);
		expect(payRes.body.success).toBe(true);
		expect(payRes.body.data.sessionId).toBe("cs_test_mock_session_123");
		expect(payRes.body.data.sessionUrl).toBe(
			"https://checkout.stripe.com/mock-session",
		);

		const transactionId = payRes.body.data.transactionId;
		expect(transactionId).toBeDefined();

		// Verify payment record in DB
		const paymentRecord = await prisma.payment.findUnique({
			where: { transactionId },
		});
		expect(paymentRecord).toBeDefined();
		expect(paymentRecord?.status).toBe("INITIATED");

		// 6. Test Webhook with mock Stripe event
		const mockEvent = {
			id: "evt_test_123",
			type: "checkout.session.completed",
			data: {
				object: {
					id: "cs_test_mock_session_123",
					client_reference_id: transactionId,
					amount_total: 75050,
					metadata: { invoiceId },
				},
			},
		};

		vi.spyOn(stripeClient.webhooks, "constructEvent").mockReturnValue(
			mockEvent as unknown as ReturnType<
				typeof stripeClient.webhooks.constructEvent
			>,
		);

		const webhookRes = await request(app)
			.post("/api/v1/payments/webhook")
			.set("stripe-signature", "mock_signature")
			.set("Content-Type", "application/json")
			.send(Buffer.from(JSON.stringify(mockEvent)));

		expect(webhookRes.status).toBe(200);
		expect(webhookRes.body.success).toBe(true);

		// Verify Payment updated to SUCCESS and Invoice updated to PAID
		const updatedPayment = await prisma.payment.findUnique({
			where: { transactionId },
		});
		expect(updatedPayment?.status).toBe("SUCCESS");

		const updatedInvoice = await prisma.invoice.findUnique({
			where: { id: invoiceId },
		});
		expect(updatedInvoice?.status).toBe("PAID");

		// 7. Test Idempotency: Trigger same webhook again
		const idempotentRes = await request(app)
			.post("/api/v1/payments/webhook")
			.set("stripe-signature", "mock_signature")
			.set("Content-Type", "application/json")
			.send(Buffer.from(JSON.stringify(mockEvent)));

		expect(idempotentRes.status).toBe(200);
		expect(idempotentRes.body.success).toBe(true);
		expect(idempotentRes.body.data.message).toContain("idempotent");
	});

	it("should reject webhook request with missing stripe-signature header", async () => {
		const res = await request(app)
			.post("/api/v1/payments/webhook")
			.send({ dummy: true });

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});
});
