import bcrypt from "bcrypt";
import config from "../src/config";
import { prisma } from "../src/lib/prisma";

async function main() {
	console.log("🌱 Starting database seeding...");

	const adminEmail = "admin@university.edu";
	const adminPassword = "Admin1234!";

	// Check if admin user already exists
	const existingAdmin = await prisma.user.findUnique({
		where: { email: adminEmail },
	});

	if (existingAdmin) {
		console.log(`ℹ️ Admin user already exists: ${adminEmail}`);
		return;
	}

	const passwordHash = await bcrypt.hash(
		adminPassword,
		config.bcryptSaltRounds,
	);

	const adminUser = await prisma.user.create({
		data: {
			email: adminEmail,
			passwordHash,
			firstName: "System",
			lastName: "Admin",
			role: "ADMIN",
			status: "ACTIVE",
		},
	});

	console.log(`✅ Default admin created successfully:`);
	console.log(`   ID:       ${adminUser.id}`);
	console.log(`   Email:    ${adminUser.email}`);
	console.log(`   Role:     ${adminUser.role}`);
	console.log(`   Password: ${adminPassword}`);
}

main()
	.catch((e) => {
		console.error("❌ Seeding failed:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
