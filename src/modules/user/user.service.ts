import bcrypt from "bcrypt";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { createAuditLog } from "../../utils/auditLog";
import type {
	TChangePasswordPayload,
	TUpdateProfilePayload,
} from "./user.interface";
import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";

/**
 * Retrieve the current authenticated user's profile with linked academic profile.
 */
const getMe = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			role: true,
			status: true,
			imageUrl: true,     
  			imagePublicId: true, 
			createdAt: true,
			updatedAt: true,
			studentProfile: {
				select: {
					id: true,
					studentId: true,
					enrollmentYear: true,
				},
			},
			instructorProfile: {
				select: {
					id: true,
					employeeId: true,
				},
			},
		},
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return user;
};

/**
 * Update the current authenticated user's profile details with transactional audit logging.
 */
const updateMe = async (
	userId: string,
	payload: TUpdateProfilePayload,
	ip?: string,
) => {
	const currentUser = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			firstName: true,
			lastName: true,
		},
	});

	if (!currentUser) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return prisma.$transaction(async (tx) => {
		const updatedUser = await tx.user.update({
			where: { id: userId },
			data: {
				...(payload.firstName !== undefined && {
					firstName: payload.firstName,
				}),
				...(payload.lastName !== undefined && { lastName: payload.lastName }),
			},
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true,
				role: true,
				status: true,
				imageUrl: true,     
  				imagePublicId: true,
				createdAt: true,
				updatedAt: true,
				studentProfile: {
					select: {
						id: true,
						studentId: true,
						enrollmentYear: true,
					},
				},
				instructorProfile: {
					select: {
						id: true,
						employeeId: true,
					},
				},
			},
		});

		await createAuditLog(tx, {
			actorId: userId,
			action: "PROFILE_UPDATE",
			entity: "User",
			entityId: userId,
			before: {
				firstName: currentUser.firstName,
				lastName: currentUser.lastName,
			},
			after: {
				firstName: updatedUser.firstName,
				lastName: updatedUser.lastName,
			},
			ip,
		});

		return updatedUser;
	});
};

/**
 * Change user password, revoke active refresh sessions, and record an audit log.
 */
const changePassword = async (
	userId: string,
	payload: TChangePasswordPayload,
	ip?: string,
): Promise<void> => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			passwordHash: true,
		},
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const isMatch = await bcrypt.compare(
		payload.currentPassword,
		user.passwordHash,
	);

	if (!isMatch) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Current password is incorrect",
		);
	}

	const newPasswordHash = await bcrypt.hash(
		payload.newPassword,
		config.bcryptSaltRounds,
	);

	await prisma.$transaction(async (tx) => {
		// Update password
		await tx.user.update({
			where: { id: userId },
			data: { passwordHash: newPasswordHash },
		});

		// Revoke all existing refresh tokens to force re-login across active devices
		await tx.refreshToken.updateMany({
			where: { userId, revoked: false },
			data: { revoked: true },
		});

		// Record audit log entry
		await createAuditLog(tx, {
			actorId: userId,
			action: "PASSWORD_CHANGE",
			entity: "User",
			entityId: userId,
			ip,
		});
	});
};


const updateProfileImage = async (buffer: Buffer, userId: string) => { 

	const currentUser = await prisma.user.findUnique({
		where: {
			id: userId
		},
		select: {
			imagePublicId: true,
			imageUrl: true,
		}
	})

	// ? clodinary uploader fucntion
	  const cloudinaryResult = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ resource_type: "image" }, 
        async (error, reslut) => {
        if (error) {
         return reject(error)
        }

        if(!reslut){
          return reject(new Error("No Result returned from Cloudinary"))
        }

        resolve(reslut)

      })
      .end(buffer);
	  });


	//   ? Updating the umageURL and imagepublicId in the database
	    const updatedUser = await prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            imageUrl: cloudinaryResult?.secure_url,
            imagePublicId: cloudinaryResult?.public_id,
          },
          omit:{
            passwordHash:true
          }
		});

	// ? Deleting the previous image from cloudinary if it exists
	if(currentUser?.imagePublicId){
		await cloudinary.uploader.destroy(currentUser.imagePublicId)
	}

	return updatedUser;

}

export const userService = {
	getMe,
	updateMe,
	changePassword,
	updateProfileImage,
};
