import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { userController } from "./user.controller";
import { userValidation } from "./user.validation";
import { authorize } from "../../middleware/authorize";
import { upload } from "../../lib/multer";

const router = Router();

/**
 * GET /api/v1/users/me
 * Retrieve the current authenticated user's profile
 */
router.get("/me", authenticate, userController.getMe);

/**
 * PATCH /api/v1/users/me
 * Update personal profile information (firstName, lastName)
 */
router.patch(
	"/me",
	authenticate,
	validate(userValidation.updateProfileSchema),
	userController.updateMe,
);

/**
 * PATCH /api/v1/users/me/password
 * Change password and revoke active sessions
 */
router.patch(
	"/me/password",
	authenticate,
	validate(userValidation.changePasswordSchema),
	userController.changePassword,
);

/**
 * PATCH /api/v1/users/profile-image
 * Upload and update profile image
 */
router.patch("/profile-image", authenticate, authorize("ADMIN", "STUDENT", "INSTRUCTOR"), upload.single("profileImage"), userController.updateProfileImage);

export const userRoutes = router;
