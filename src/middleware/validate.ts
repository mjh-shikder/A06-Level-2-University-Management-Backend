import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

/**
 * Middleware factory that validates incoming request data (body, query, params, cookies)
 * against a provided Zod schema. Passes validation errors to next().
 *
 * @param schema Zod schema defining the expected shape of request inputs
 */
export const validate =
	(schema: ZodType) =>
	async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
		try {
			await schema.parseAsync({
				body: req.body,
				query: req.query,
				params: req.params,
				cookies: req.cookies,
			});
			next();
		} catch (error) {
			next(error);
		}
	};
