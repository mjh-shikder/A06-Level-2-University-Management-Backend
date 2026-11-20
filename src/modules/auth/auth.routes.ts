import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { authController } from "./auth.controller";
import { authValidation } from "./auth.validation";

const router = Router();

/**
 * POST /api/v1/auth/register
 * Public registration endpoint with input validation
 */
router.post(
	"/register",
	validate(authValidation.registerSchema),
	authController.register,
);

/**
 * POST /api/v1/auth/login
 * Public authentication endpoint with input validation
 */
router.post(
	"/login",
	validate(authValidation.loginSchema),
	authController.login,
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using httpOnly refreshToken cookie
 */
router.post(
	"/refresh",
	validate(authValidation.refreshTokenSchema),
	authController.refreshToken,
);

/**
 * POST /api/v1/auth/logout
 * Invalidate refresh token and clear cookie
 */
router.post("/logout", authController.logout);

/**
 * GET /api/v1/auth/me
 * Protected endpoint returning the authenticated user's profile
 */
router.get("/me", authenticate, authController.getMe);

/**
 * GET /api/v1/auth/admin-demo
 * Protected endpoint demonstrating RBAC: accessible exclusively by ADMIN
 */
router.get(
	"/admin-demo",
	authenticate,
	authorize("ADMIN"),
	authController.adminDemo,
);

export const authRoutes = router;
