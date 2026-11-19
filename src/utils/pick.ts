/**
 * Pick specified keys from an object, filtering out undefined values.
 * Useful for extracting allowed query parameters and pagination options.
 *
 * @param obj Source object
 * @param keys Keys to extract
 * @returns Filtered object
 */
export const pick = <T extends Record<string, unknown>, K extends keyof T>(
	obj: T,
	keys: K[],
): Partial<Pick<T, K>> => {
	const finalObj: Partial<Pick<T, K>> = {};

	for (const key of keys) {
		if (obj && Object.hasOwn(obj, key) && obj[key] !== undefined) {
			finalObj[key] = obj[key];
		}
	}

	return finalObj;
};
