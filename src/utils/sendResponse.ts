import type { Response } from "express";

export type TMeta = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
};

export type TResponseData<T> = {
	statusCode: number;
	success: boolean;
	message: string;
	data?: T;
	meta?: TMeta;
};

/**
 * Standardized JSON success response sender per project rules.
 */
export const sendResponse = <T>(
	res: Response,
	data: TResponseData<T>,
): void => {
	res.status(data.statusCode).json({
		success: data.success,
		message: data.message,
		data: data.data !== undefined ? data.data : null,
		...(data.meta ? { meta: data.meta } : {}),
	});
};
