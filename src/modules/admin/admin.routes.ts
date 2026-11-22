import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { AdminController } from "./admin.controller";
import { adminValidation } from "./admin.validation";

const router = Router();

// Protect all admin endpoints with authentication and ADMIN role check
router.use(authenticate, authorize("ADMIN"));

/**
 * GET /api/v1/admin/users
 * List users with filtering (role, status, search query) and pagination
 */
router.get(
	"/users",
	validate(adminValidation.listUsersSchema),
	AdminController.listUsers,
);

/**
 * PATCH /api/v1/admin/users/:id/role
 * Change a user's role (audit logged)
 */
router.patch(
	"/users/:id/role",
	validate(adminValidation.updateUserRoleSchema),
	AdminController.updateUserRole,
);

/**
 * PATCH /api/v1/admin/users/:id/status
 * Activate, deactivate, or suspend a user account (audit logged)
 */
router.patch(
	"/users/:id/status",
	validate(adminValidation.updateUserStatusSchema),
	AdminController.updateUserStatus,
);

/**
 * GET /api/v1/admin/dashboard
 * High-level system overview, counts, active semester enrollments, and revenue stats
 */
router.get("/dashboard", AdminController.getDashboardStats);

/**
 * GET /api/v1/admin/audit-logs
 * List audit trail entries with filters and pagination
 */
router.get(
	"/audit-logs",
	validate(adminValidation.listAuditLogsSchema),
	AdminController.listAuditLogs,
);

/**
 * GET /api/v1/admin/semesters/:id/report
 * Detailed semester report (enrollments, revenue, grade distribution, and average GPA)
 */
router.get(
	"/semesters/:id/report",
	validate(adminValidation.semesterReportParamSchema),
	AdminController.getSemesterReport,
);

export const adminRoutes = router;
