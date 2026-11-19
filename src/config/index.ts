import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), ".env") });

// Define environment schema with Zod
const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	PORT: z.coerce.number().default(5000),
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
	FRONTEND_URL: z.string().default("http://localhost:3000"),
	BACKEND_URL: z.string().default("http://localhost:5000"),
	CORS_ORIGINS: z.string().default("http://localhost:3000"),
	JWT_ACCESS_SECRET: z.string().default("dev-jwt-access-secret-key-15m"),
	JWT_REFRESH_SECRET: z.string().default("dev-jwt-refresh-secret-key-7d"),
	BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
	STRIPE_SECRET_KEY: z.string().default("sk_test_placeholder"),
	STRIPE_WEBHOOK_SECRET: z.string().default("whsec_placeholder"),
	STRIPE_CURRENCY: z.string().default("usd"),
	ENROLLMENT_BLOCK_ON_UNPAID: z
		.string()
		.default("true")
		.transform((val) => val === "true" || val === "1"),
	MAX_CREDITS_PER_SEMESTER: z.coerce.number().default(18),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error(
		"❌ Invalid environment variables:",
		JSON.stringify(parsedEnv.error.format(), null, 2),
	);
	throw new Error("Invalid environment configuration. Check your .env file.");
}

const env = parsedEnv.data;

const config = {
	env: env.NODE_ENV,
	port: env.PORT,
	databaseUrl: env.DATABASE_URL,
	frontendUrl: env.FRONTEND_URL,
	backendUrl: env.BACKEND_URL,
	corsOrigins: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
	jwt: {
		accessSecret: env.JWT_ACCESS_SECRET,
		refreshSecret: env.JWT_REFRESH_SECRET,
	},
	bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
	stripe: {
		secretKey: env.STRIPE_SECRET_KEY,
		webhookSecret: env.STRIPE_WEBHOOK_SECRET,
		currency: env.STRIPE_CURRENCY,
	},
	enrollmentBlockOnUnpaid: env.ENROLLMENT_BLOCK_ON_UNPAID,
	maxCreditsPerSemester: env.MAX_CREDITS_PER_SEMESTER,

	// Backwards-compatible aliases
	database_url: env.DATABASE_URL,
	frontend_url: env.FRONTEND_URL,
	backend_url: env.BACKEND_URL,
};

export default config;
export type Config = typeof config;
