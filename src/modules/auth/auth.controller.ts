import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { authService } from "./auth.service";

/**
 * Handle new user registration requests.
 */
const register = catchAsync(async (req: Request, res: Response) => {
	const result = await authService.register(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "User registered successfully",
		data: result,
	});
});

/**
 * Handle user authentication and login requests.
 */
const login = catchAsync(async (req: Request, res: Response) => {
	const result = await authService.login(req.body);

	res.cookie("accessToken", result.accessToken, {
		httpOnly: true,
		secure: config.env === "production",
		sameSite: "strict",
		maxAge: 15 * 60 * 1000,
	});

	// Set refresh token in secure, httpOnly cookie
	res.cookie("refreshToken", result.refreshToken, {
		httpOnly: true,
		secure: config.env === "production",
		sameSite: "strict",
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully",
		data: {
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
			user: result.user,
		},
	});
});

/**
 * Rotate refresh token and issue new access token.
 */
const refreshToken = catchAsync(async (req: Request, res: Response) => {
	const currentRefreshToken = req.cookies?.refreshToken;
	const result = await authService.refreshToken(currentRefreshToken);

	res.cookie("accessToken", result.accessToken, {
		httpOnly: true,
		secure: config.env === "production",
		sameSite: "strict",
		maxAge: 1 * 24 * 60 * 60 * 1000,
	});

	// Overwrite existing cookie with rotated refresh token
	res.cookie("refreshToken", result.newRefreshToken, {
		httpOnly: true,
		secure: config.env === "production",
		sameSite: "strict",
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Access token refreshed successfully",
		data: {
			accessToken: result.accessToken,
		},
	});
});

/**
 * Handle user logout: revoke refresh token and clear cookie.
 */
const logout = catchAsync(async (req: Request, res: Response) => {
	const currentRefreshToken = req.cookies?.refreshToken;
	await authService.logout(currentRefreshToken);

	res.clearCookie("accessToken", {
		httpOnly: true,
		secure: config.env === "production",
		sameSite: "strict",
	});
	res.clearCookie("refreshToken", {
		httpOnly: true,
		secure: config.env === "production",
		sameSite: "strict",
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged out successfully",
		data: null,
	});
});

/**
 * Retrieve authenticated user's current profile.
 */
const getMe = catchAsync(async (req: Request, res: Response) => {
	const result = await authService.getMe(req.user.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile retrieved successfully",
		data: result,
	});
});

/**
 * Demo RBAC protected endpoint accessible only by ADMIN role.
 */
const adminDemo = catchAsync(async (req: Request, res: Response) => {
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Admin RBAC authorization verified successfully",
		data: {
			user: req.user,
		},
	});
});

export const authController = {
	register,
	login,
	refreshToken,
	logout,
	getMe,
	adminDemo,
};
