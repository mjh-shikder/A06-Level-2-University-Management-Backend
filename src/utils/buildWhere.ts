/**
 * Utility to construct a Prisma search filter across multiple text fields.
 *
 * @param searchTerm The search query string (e.g., q)
 * @param searchableFields List of string field names on the model to search against
 * @returns A Prisma-compatible OR condition object or an empty object if no search term
 */
export const buildSearchWhere = <T extends string>(
	searchTerm: string | undefined,
	searchableFields: readonly T[],
) => {
	if (!searchTerm || searchableFields.length === 0) {
		return {};
	}

	return {
		OR: searchableFields.map((field) => ({
			[field]: {
				contains: searchTerm,
				mode: "insensitive" as const,
			},
		})),
	};
};
