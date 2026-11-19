import type { Request, Response } from "express";
import httpStatus from "http-status";

/**
 * 404 Not Found catch-all middleware for handling undefined endpoints.
 */
export const notFound = (req: Request, res: Response): void => {
	res.status(httpStatus.NOT_FOUND).json({
		success: false,
		message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
		errors: [
			{
				message: `Cannot ${req.method} ${req.originalUrl}`,
			},
		],
	});
};
