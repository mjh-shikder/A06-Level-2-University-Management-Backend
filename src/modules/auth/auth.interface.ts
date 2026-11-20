export type TRegisterPayload = {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	role?: "ADMIN" | "INSTRUCTOR" | "STUDENT";
};

export type TLoginPayload = {
	email: string;
	password: string;
};

export type TLoginResponse = {
	accessToken: string;
	refreshToken: string;
	user: {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
		role: string;
	};
};

export type TRefreshTokenResponse = {
	accessToken: string;
	newRefreshToken: string;
};
