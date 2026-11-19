import type { Server } from "node:http";
import app from "./app";
import config from "./config";
import { prisma } from "./lib/prisma";

let server: Server | null = null;

const main = async (): Promise<void> => {
	try {
		await prisma.$connect();
		console.log("Connected to the database successfully");

		server = app.listen(config.port, () => {
			console.log(
				`Server is running on port ${config.port} in [${config.env}] mode`,
			);
		});
	} catch (error) {
		console.error("Failed to start the server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

main();

/**
 * Graceful termination handler for SIGTERM and SIGINT
 */
const gracefulShutdown = (signal: string) => {
	console.log(`Received ${signal}. Initiating graceful shutdown...`);
	if (server) {
		server.close(async () => {
			console.log("HTTP server closed.");
			await prisma.$disconnect();
			console.log("Database connection closed.");
			process.exit(0);
		});
	} else {
		process.exit(0);
	}
};

/**
 * Error handler for uncaught exceptions and unhandled promise rejections
 */
const unexpectedErrorHandler = async (error: unknown) => {
	console.error("Unexpected error encountered:", error);
	if (server) {
		server.close(async () => {
			await prisma.$disconnect();
			process.exit(1);
		});
	} else {
		await prisma.$disconnect();
		process.exit(1);
	}
};

process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
