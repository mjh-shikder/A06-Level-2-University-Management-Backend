export type TUpdateProfilePayload = {
	firstName?: string;
	lastName?: string;
};

export type TChangePasswordPayload = {
	currentPassword: string;
	newPassword: string;
};
