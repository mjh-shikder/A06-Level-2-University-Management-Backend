import type { ErrorRequestHandler } from "express";
import httpStatus from "http-status";
import multer from "multer";
import { ZodError } from "zod";
import config from "../config";
import { AppError } from "../errors/AppError";

export type TErrorSource = {
	field?: string | number;
	message: string;
};

/**
 * Centralized global error handling middleware for Express.
 * Formats all exceptions into a consistent { success: false, message, errors } shape.
 * Ensures internal stack traces are never exposed in production.
 */
export const globalErrorHandler: ErrorRequestHandler = (
	err,
	_req,
	res,
	_next,
) => {
	let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
	let message = "Internal server error";
	let errors: TErrorSource[] = [];

	if (err instanceof AppError) {
		statusCode = err.statusCode;
		message = err.message;
		errors = [{ message: err.message }];
	} else if (err instanceof ZodError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Validation error";
		errors = err.issues.map((issue) => ({
			field: issue.path.join("."),
			message: issue.message,
		}));
	} else if (err instanceof multer.MulterError) {
		statusCode =
			err.code === "LIMIT_FILE_SIZE"
				? httpStatus.REQUEST_ENTITY_TOO_LARGE
				: httpStatus.BAD_REQUEST;
		message =
			err.code === "LIMIT_FILE_SIZE"
				? "Image must be 5 MB or smaller"
				: err.message;
		errors = [{ message }];
	} else if (err?.name === "PrismaClientKnownRequestError") {
		// Prisma known request errors
		if (err.code === "P2002") {
			statusCode = httpStatus.CONFLICT;
			message = "Duplicate entry detected";
			const target = Array.isArray(err.meta?.target)
				? err.meta.target.join(", ")
				: "field";
			errors = [{ field: target, message: `${target} already exists` }];
		} else if (err.code === "P2025") {
			statusCode = httpStatus.NOT_FOUND;
			message = "Record not found";
			errors = [{ message: "The requested record was not found" }];
		} else {
			statusCode = httpStatus.BAD_REQUEST;
			message = err.message || "Database request error";
			errors = [{ message: err.message || "Database error" }];
		}
	} else if (err instanceof Error) {
		message = err.message;
		errors = [{ message: err.message }];
	}

	if (config.env === "development") {
		console.error("❌ Global Error Handler Caught:", err);
	}

	res.status(statusCode).json({
		success: false,
		message,
		errors,
		...(config.env === "development" && { stack: err?.stack }),
	});
};
