import { Router } from "express";
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

export const authRoutes = router;
