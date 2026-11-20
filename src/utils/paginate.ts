export type TPaginationOptions = {
	page?: number;
	limit?: number;
	sortBy?: string;
	order?: "asc" | "desc";
};

export type TPaginationResult = {
	page: number;
	limit: number;
	skip: number;
	sortBy: string;
	order: "asc" | "desc";
};

export type TPaginationMeta = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
};

/**
 * Calculate pagination offsets, limits, and order directions.
 *
 * @param options User supplied page, limit, sortBy, order parameters
 * @param defaultSortBy Fallback sort column when unspecified
 */
export const calculatePagination = (
	options: TPaginationOptions,
	defaultSortBy = "createdAt",
): TPaginationResult => {
	const page = Number(options.page && options.page > 0 ? options.page : 1);
	const limit = Number(
		options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 10,
	);
	const skip = (page - 1) * limit;
	const sortBy = options.sortBy || defaultSortBy;
	const order = options.order === "asc" ? "asc" : "desc";

	return {
		page,
		limit,
		skip,
		sortBy,
		order,
	};
};

/**
 * Format pagination metadata response object.
 */
export const buildPaginationMeta = (
	total: number,
	page: number,
	limit: number,
): TPaginationMeta => {
	return {
		page,
		limit,
		total,
		totalPages: Math.ceil(total / limit) || 1,
	};
};
