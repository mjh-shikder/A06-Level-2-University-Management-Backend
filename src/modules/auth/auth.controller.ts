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
			user: result.user,
		},
	});
});

export const authController = {
	register,
	login,
};
