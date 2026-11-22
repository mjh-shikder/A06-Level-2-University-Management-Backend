import type { Role, UserStatus } from "../../../generated/prisma/client";

export interface TUserFilterOptions {
	role?: Role;
	status?: UserStatus;
	q?: string;
	page?: number;
	limit?: number;
	sortBy?: string;
	order?: "asc" | "desc";
	sortOrder?: "asc" | "desc";
}

export interface TUpdateUserRolePayload {
	role: Role;
}

export interface TUpdateUserStatusPayload {
	status: UserStatus;
}

export interface TAuditLogFilterOptions {
	actorId?: string;
	entity?: string;
	action?: string;
	startDate?: string;
	endDate?: string;
	page?: number;
	limit?: number;
	sortBy?: string;
	order?: "asc" | "desc";
	sortOrder?: "asc" | "desc";
}

export interface TDashboardStats {
	users: {
		total: number;
		byRole: Record<Role, number>;
		byStatus: Record<UserStatus, number>;
	};
	academics: {
		departmentsCount: number;
		programsCount: number;
		coursesCount: number;
		activeSemester: {
			id: string;
			name: string;
			year: number;
			term: string;
		} | null;
	};
	enrollments: {
		totalActiveEnrollments: number;
		activeSemesterEnrollments: number;
	};
	financials: {
		totalRevenue: number;
		totalInvoiced: number;
		totalPaid: number;
		totalPending: number;
	};
	recentActivity: Array<{
		id: string;
		action: string;
		entity: string;
		entityId: string;
		createdAt: Date;
		actor: {
			id: string;
			firstName: string;
			lastName: string;
			email: string;
			role: Role;
		};
	}>;
}

export interface TSemesterReport {
	semester: {
		id: string;
		name: string;
		year: number;
		term: string;
		status: string;
		startDate: Date;
		endDate: Date;
	};
	enrollments: {
		totalEnrollments: number;
		activeEnrollments: number;
		completedEnrollments: number;
		droppedEnrollments: number;
		uniqueStudentsCount: number;
		sectionsCount: number;
	};
	financials: {
		invoicesCount: number;
		totalInvoiced: number;
		totalRevenueCollected: number;
		paidInvoicesCount: number;
		pendingInvoicesCount: number;
	};
	academics: {
		totalPublishedResults: number;
		averageGPA: number;
		passRatePercent: number;
		gradeDistribution: Record<string, number>;
	};
}
