import type { Role } from "../../generated/prisma/client";

export type TJwtUser = {
	id: string;
	email: string;
	role: Role;
};

declare global {
	namespace Express {
		interface Request {
			user: TJwtUser;
		}
	}
}
