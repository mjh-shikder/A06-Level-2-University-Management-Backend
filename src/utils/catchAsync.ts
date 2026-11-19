import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Higher-order function wrapping async Express route handlers.
 * Any rejected promise or thrown error is passed forward to next()
 * for centralized handling in globalErrorHandler.
 */
export const catchAsync = (fn: RequestHandler) => {
	return async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			await fn(req, res, next);
		} catch (error) {
			next(error);
		}
	};
};
