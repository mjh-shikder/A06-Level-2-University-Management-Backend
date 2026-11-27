import multer from "multer";
import httpStatus from "http-status";
import { AppError } from "../errors/AppError";

const allowedImageTypes = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
]);

export const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 5 * 1024 * 1024,
	},
	fileFilter: (_req, file, callback) => {
		if (!allowedImageTypes.has(file.mimetype)) {
			callback(
				new AppError(
					httpStatus.BAD_REQUEST,
					"Only JPEG, PNG, WebP, and GIF images are allowed",
				),
			);
			return;
		}

		callback(null, true);
	},
});
