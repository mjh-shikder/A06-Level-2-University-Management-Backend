import bcrypt from "bcrypt";
import config from "../src/config";
import { prisma } from "../src/lib/prisma";

async function main() {
	console.log("🌱 Starting full database seed...");

	// 1. Password Hashes
	const adminPassword = "Admin1234!";
	const instructorPassword = "Instructor123!";
	const studentPassword = "Student123!";

	const [adminHash, instructorHash, studentHash] = await Promise.all([
		bcrypt.hash(adminPassword, config.bcryptSaltRounds),
		bcrypt.hash(instructorPassword, config.bcryptSaltRounds),
		bcrypt.hash(studentPassword, config.bcryptSaltRounds),
	]);

	// 2. Departments
	console.log("📁 Seeding departments...");
	const deptCSE = await prisma.department.upsert({
		where: { code: "CSE" },
		update: {},
		create: {
			name: "Computer Science & Engineering",
			code: "CSE",
			description: "Department of Computer Science and Engineering",
		},
	});

	const deptEEE = await prisma.department.upsert({
		where: { code: "EEE" },
		update: {},
		create: {
			name: "Electrical & Electronic Engineering",
			code: "EEE",
			description: "Department of Electrical and Electronic Engineering",
		},
	});

	const deptBBA = await prisma.department.upsert({
		where: { code: "BBA" },
		update: {},
		create: {
			name: "Business Administration",
			code: "BBA",
			description: "School of Business and Entrepreneurship",
		},
	});

	// 3. Programs
	console.log("🎓 Seeding academic programs...");
	const progBSCCSE = await prisma.program.upsert({
		where: { code: "BSC-CSE" },
		update: {},
		create: {
			name: "BSc in Computer Science & Engineering",
			code: "BSC-CSE",
			departmentId: deptCSE.id,
			requiredCredits: 130,
		},
	});

	const progBSCSE = await prisma.program.upsert({
		where: { code: "BSC-SE" },
		update: {},
		create: {
			name: "BSc in Software Engineering",
			code: "BSC-SE",
			departmentId: deptCSE.id,
			requiredCredits: 130,
		},
	});

	const progBSEEE = await prisma.program.upsert({
		where: { code: "BSC-EEE" },
		update: {},
		create: {
			name: "BSc in Electrical & Electronic Engineering",
			code: "BSC-EEE",
			departmentId: deptEEE.id,
			requiredCredits: 136,
		},
	});

	const progBBA = await prisma.program.upsert({
		where: { code: "BBA-GEN" },
		update: {},
		create: {
			name: "Bachelor of Business Administration",
			code: "BBA-GEN",
			departmentId: deptBBA.id,
			requiredCredits: 120,
		},
	});

	await prisma.program.upsert({
		where: { code: "MBA" },
		update: {},
		create: {
			name: "Master of Business Administration",
			code: "MBA",
			departmentId: deptBBA.id,
			requiredCredits: 60,
		},
	});

	// 4. Admin User
	console.log("👤 Seeding system administrator...");
	const adminUser = await prisma.user.upsert({
		where: { email: "admin@university.edu" },
		update: {
			passwordHash: adminHash,
			status: "ACTIVE",
		},
		create: {
			email: "admin@university.edu",
			passwordHash: adminHash,
			firstName: "System",
			lastName: "Admin",
			role: "ADMIN",
			status: "ACTIVE",
		},
	});

	// 5. Instructors & Profiles
	console.log("👨‍🏫 Seeding instructors...");
	const instructor1User = await prisma.user.upsert({
		where: { email: "dr.smith@university.edu" },
		update: {
			passwordHash: instructorHash,
			status: "ACTIVE",
		},
		create: {
			email: "dr.smith@university.edu",
			passwordHash: instructorHash,
			firstName: "John",
			lastName: "Smith",
			role: "INSTRUCTOR",
			status: "ACTIVE",
		},
	});

	let instructor1 = await prisma.instructorProfile.findFirst({
		where: {
			OR: [{ userId: instructor1User.id }, { employeeId: "EMP-2026-001" }],
		},
	});
	if (!instructor1) {
		instructor1 = await prisma.instructorProfile.create({
			data: {
				userId: instructor1User.id,
				employeeId: "EMP-2026-001",
				departmentId: deptCSE.id,
			},
		});
	} else if (instructor1.userId !== instructor1User.id) {
		instructor1 = await prisma.instructorProfile.update({
			where: { id: instructor1.id },
			data: { userId: instructor1User.id, departmentId: deptCSE.id },
		});
	}

	const instructor2User = await prisma.user.upsert({
		where: { email: "dr.clark@university.edu" },
		update: {
			passwordHash: instructorHash,
			status: "ACTIVE",
		},
		create: {
			email: "dr.clark@university.edu",
			passwordHash: instructorHash,
			firstName: "Sarah",
			lastName: "Clark",
			role: "INSTRUCTOR",
			status: "ACTIVE",
		},
	});

	let instructor2 = await prisma.instructorProfile.findFirst({
		where: {
			OR: [{ userId: instructor2User.id }, { employeeId: "EMP-2026-002" }],
		},
	});
	if (!instructor2) {
		instructor2 = await prisma.instructorProfile.create({
			data: {
				userId: instructor2User.id,
				employeeId: "EMP-2026-002",
				departmentId: deptEEE.id,
			},
		});
	} else if (instructor2.userId !== instructor2User.id) {
		instructor2 = await prisma.instructorProfile.update({
			where: { id: instructor2.id },
			data: { userId: instructor2User.id, departmentId: deptEEE.id },
		});
	}

	// 6. Students & Profiles
	console.log("👨‍🎓 Seeding students...");
	const studentSeedData = [
		{
			email: "student1@university.edu",
			firstName: "Alice",
			lastName: "Johnson",
			studentId: "STU-2026-0001",
			programId: progBSCCSE.id,
			year: 2026,
		},
		{
			email: "student2@university.edu",
			firstName: "Bob",
			lastName: "Davis",
			studentId: "STU-2026-0002",
			programId: progBSCCSE.id,
			year: 2026,
		},
		{
			email: "student3@university.edu",
			firstName: "Charlie",
			lastName: "Brown",
			studentId: "STU-2026-0003",
			programId: progBSCSE.id,
			year: 2026,
		},
		{
			email: "student4@university.edu",
			firstName: "Diana",
			lastName: "Prince",
			studentId: "STU-2026-0004",
			programId: progBSEEE.id,
			year: 2026,
		},
		{
			email: "student5@university.edu",
			firstName: "Evan",
			lastName: "Wright",
			studentId: "STU-2026-0005",
			programId: progBBA.id,
			year: 2026,
		},
	];

	const studentProfiles = [];
	for (const s of studentSeedData) {
		const user = await prisma.user.upsert({
			where: { email: s.email },
			update: {
				passwordHash: studentHash,
				status: "ACTIVE",
			},
			create: {
				email: s.email,
				passwordHash: studentHash,
				firstName: s.firstName,
				lastName: s.lastName,
				role: "STUDENT",
				status: "ACTIVE",
			},
		});

		let profile = await prisma.studentProfile.findFirst({
			where: {
				OR: [{ userId: user.id }, { studentId: s.studentId }],
			},
		});

		if (!profile) {
			profile = await prisma.studentProfile.create({
				data: {
					userId: user.id,
					studentId: s.studentId,
					programId: s.programId,
					enrollmentYear: s.year,
				},
			});
		} else if (profile.userId !== user.id) {
			profile = await prisma.studentProfile.update({
				where: { id: profile.id },
				data: { userId: user.id, programId: s.programId },
			});
		}

		studentProfiles.push(profile);
	}

	// 7. Courses with Prerequisites
	console.log("📚 Seeding courses and prerequisites...");
	const courseCSE101 = await prisma.course.upsert({
		where: { code: "CSE101" },
		update: {},
		create: {
			code: "CSE101",
			title: "Introduction to Programming",
			credits: 3,
			programId: progBSCCSE.id,
			description: "Fundamental programming concepts using C/C++",
		},
	});

	const courseCSE102 = await prisma.course.upsert({
		where: { code: "CSE102" },
		update: {},
		create: {
			code: "CSE102",
			title: "Structured Programming",
			credits: 3,
			programId: progBSCCSE.id,
			description: "Advanced functions, pointers, and memory management",
		},
	});

	const courseCSE201 = await prisma.course.upsert({
		where: { code: "CSE201" },
		update: {},
		create: {
			code: "CSE201",
			title: "Data Structures and Algorithms",
			credits: 4,
			programId: progBSCCSE.id,
			description: "Linear and non-linear data structures, searching, sorting",
		},
	});

	const courseCSE301 = await prisma.course.upsert({
		where: { code: "CSE301" },
		update: {},
		create: {
			code: "CSE301",
			title: "Database Management Systems",
			credits: 3,
			programId: progBSCCSE.id,
			description: "Relational modeling, SQL, ACID transactions, and indexing",
		},
	});

	const courseCSE401 = await prisma.course.upsert({
		where: { code: "CSE401" },
		update: {},
		create: {
			code: "CSE401",
			title: "Software Engineering",
			credits: 3,
			programId: progBSCSE.id,
			description: "Software lifecycle, architecture, design patterns, testing",
		},
	});

	const courseEEE101 = await prisma.course.upsert({
		where: { code: "EEE101" },
		update: {},
		create: {
			code: "EEE101",
			title: "Basic Electrical Engineering",
			credits: 3,
			programId: progBSEEE.id,
			description: "Circuit analysis, Ohm's and Kirchhoff's laws",
		},
	});

	const courseEEE201 = await prisma.course.upsert({
		where: { code: "EEE201" },
		update: {},
		create: {
			code: "EEE201",
			title: "Electronic Circuits",
			credits: 4,
			programId: progBSEEE.id,
			description: "Diodes, BJTs, MOSFETs, and amplifier design",
		},
	});

	const courseMTH101 = await prisma.course.upsert({
		where: { code: "MTH101" },
		update: {},
		create: {
			code: "MTH101",
			title: "Calculus and Analytical Geometry",
			credits: 3,
			programId: progBSCCSE.id,
			description: "Differential and integral calculus with applications",
		},
	});

	const courseACT101 = await prisma.course.upsert({
		where: { code: "ACT101" },
		update: {},
		create: {
			code: "ACT101",
			title: "Financial Accounting",
			credits: 3,
			programId: progBBA.id,
			description: "Accounting equation, financial statements, ledgers",
		},
	});

	const courseMGT101 = await prisma.course.upsert({
		where: { code: "MGT101" },
		update: {},
		create: {
			code: "MGT101",
			title: "Principles of Management",
			credits: 3,
			programId: progBBA.id,
			description: "Planning, organizing, leading, and controlling organizations",
		},
	});

	// Course Prerequisites
	const prerequisites = [
		{ courseId: courseCSE102.id, prerequisiteId: courseCSE101.id },
		{ courseId: courseCSE201.id, prerequisiteId: courseCSE102.id },
		{ courseId: courseCSE301.id, prerequisiteId: courseCSE201.id },
		{ courseId: courseCSE401.id, prerequisiteId: courseCSE301.id },
		{ courseId: courseEEE201.id, prerequisiteId: courseEEE101.id },
	];

	for (const p of prerequisites) {
		await prisma.coursePrerequisite.upsert({
			where: {
				courseId_prerequisiteId: {
					courseId: p.courseId,
					prerequisiteId: p.prerequisiteId,
				},
			},
			update: {},
			create: p,
		});
	}

	// 8. Semesters (Fall 2025 COMPLETED, Spring 2026 ACTIVE)
	console.log("🗓️ Seeding academic semesters...");
	const semesterFall2025 = await prisma.semester.upsert({
		where: {
			year_term: {
				year: 2025,
				term: "FALL",
			},
		},
		update: {},
		create: {
			name: "Fall 2025",
			year: 2025,
			term: "FALL",
			status: "COMPLETED",
			startDate: new Date("2025-09-01T00:00:00Z"),
			endDate: new Date("2025-12-31T23:59:59Z"),
			registrationStart: new Date("2025-08-15T00:00:00Z"),
			registrationEnd: new Date("2025-08-30T23:59:59Z"),
		},
	});

	const semesterSpring2026 = await prisma.semester.upsert({
		where: {
			year_term: {
				year: 2026,
				term: "SPRING",
			},
		},
		update: {},
		create: {
			name: "Spring 2026",
			year: 2026,
			term: "SPRING",
			status: "ACTIVE",
			startDate: new Date("2026-01-15T00:00:00Z"),
			endDate: new Date("2026-05-31T23:59:59Z"),
			registrationStart: new Date("2026-01-01T00:00:00Z"),
			registrationEnd: new Date("2026-12-31T23:59:59Z"), // currently open
		},
	});

	// 9. Sections (8 sections across Fall 2025 & Spring 2026)
	console.log("🏫 Seeding course sections...");
	// Fall 2025 Sections
	const secFallCSE101 = await prisma.section.upsert({
		where: {
			courseId_semesterId_sectionNumber: {
				courseId: courseCSE101.id,
				semesterId: semesterFall2025.id,
				sectionNumber: "A",
			},
		},
		update: {},
		create: {
			sectionNumber: "A",
			courseId: courseCSE101.id,
			semesterId: semesterFall2025.id,
			instructorId: instructor1.id,
			capacity: 35,
			enrolledCount: 2,
			room: "Lab-301",
			schedule: [
				{ day: "MONDAY", startTime: "09:00", endTime: "10:30" },
				{ day: "WEDNESDAY", startTime: "09:00", endTime: "10:30" },
			],
		},
	});

	const secFallMTH101 = await prisma.section.upsert({
		where: {
			courseId_semesterId_sectionNumber: {
				courseId: courseMTH101.id,
				semesterId: semesterFall2025.id,
				sectionNumber: "A",
			},
		},
		update: {},
		create: {
			sectionNumber: "A",
			courseId: courseMTH101.id,
			semesterId: semesterFall2025.id,
			instructorId: instructor2.id,
			capacity: 40,
			enrolledCount: 2,
			room: "Room-204",
			schedule: [
				{ day: "TUESDAY", startTime: "10:30", endTime: "12:00" },
				{ day: "THURSDAY", startTime: "10:30", endTime: "12:00" },
			],
		},
	});

	await prisma.section.upsert({
		where: {
			courseId_semesterId_sectionNumber: {
				courseId: courseEEE101.id,
				semesterId: semesterFall2025.id,
				sectionNumber: "A",
			},
		},
		update: {},
		create: {
			sectionNumber: "A",
			courseId: courseEEE101.id,
			semesterId: semesterFall2025.id,
			instructorId: instructor2.id,
			capacity: 30,
			enrolledCount: 1,
			room: "Lab-102",
			schedule: [
				{ day: "MONDAY", startTime: "14:00", endTime: "15:30" },
				{ day: "WEDNESDAY", startTime: "14:00", endTime: "15:30" },
			],
		},
	});

	await prisma.section.upsert({
		where: {
			courseId_semesterId_sectionNumber: {
				courseId: courseACT101.id,
				semesterId: semesterFall2025.id,
				sectionNumber: "A",
			},
		},
		update: {},
		create: {
			sectionNumber: "A",
			courseId: courseACT101.id,
			semesterId: semesterFall2025.id,
			instructorId: instructor1.id,
			capacity: 45,
			enrolledCount: 1,
			room: "Room-105",
			schedule: [
				{ day: "SUNDAY", startTime: "11:00", endTime: "12:30" },
				{ day: "TUESDAY", startTime: "11:00", endTime: "12:30" },
			],
		},
	});

	// Spring 2026 Sections
	const secSpringCSE102 = await prisma.section.upsert({
		where: {
			courseId_semesterId_sectionNumber: {
				courseId: courseCSE102.id,
				semesterId: semesterSpring2026.id,
				sectionNumber: "A",
			},
		},
		update: {},
		create: {
			sectionNumber: "A",
			courseId: courseCSE102.id,
			semesterId: semesterSpring2026.id,
			instructorId: instructor1.id,
			capacity: 35,
			enrolledCount: 2,
			room: "Lab-302",
			schedule: [
				{ day: "MONDAY", startTime: "09:00", endTime: "10:30" },
				{ day: "WEDNESDAY", startTime: "09:00", endTime: "10:30" },
			],
		},
	});

	const secSpringCSE101Retake = await prisma.section.upsert({
		where: {
			courseId_semesterId_sectionNumber: {
				courseId: courseCSE101.id,
				semesterId: semesterSpring2026.id,
				sectionNumber: "B",
			},
		},
		update: {},
		create: {
			sectionNumber: "B",
			courseId: courseCSE101.id,
			semesterId: semesterSpring2026.id,
			instructorId: instructor1.id,
			capacity: 30,
			enrolledCount: 1,
			room: "Lab-301",
			schedule: [
				{ day: "TUESDAY", startTime: "14:00", endTime: "15:30" },
				{ day: "THURSDAY", startTime: "14:00", endTime: "15:30" },
			],
		},
	});

	await prisma.section.upsert({
		where: {
			courseId_semesterId_sectionNumber: {
				courseId: courseEEE201.id,
				semesterId: semesterSpring2026.id,
				sectionNumber: "A",
			},
		},
		update: {},
		create: {
			sectionNumber: "A",
			courseId: courseEEE201.id,
			semesterId: semesterSpring2026.id,
			instructorId: instructor2.id,
			capacity: 30,
			enrolledCount: 1,
			room: "Lab-105",
			schedule: [
				{ day: "TUESDAY", startTime: "09:00", endTime: "10:30" },
				{ day: "THURSDAY", startTime: "09:00", endTime: "10:30" },
			],
		},
	});

	await prisma.section.upsert({
		where: {
			courseId_semesterId_sectionNumber: {
				courseId: courseMGT101.id,
				semesterId: semesterSpring2026.id,
				sectionNumber: "A",
			},
		},
		update: {},
		create: {
			sectionNumber: "A",
			courseId: courseMGT101.id,
			semesterId: semesterSpring2026.id,
			instructorId: instructor1.id,
			capacity: 40,
			enrolledCount: 1,
			room: "Room-201",
			schedule: [
				{ day: "MONDAY", startTime: "11:00", endTime: "12:30" },
				{ day: "WEDNESDAY", startTime: "11:00", endTime: "12:30" },
			],
		},
	});

	// 10. Enrollments & Results
	console.log("📝 Seeding enrollments, exams, and results...");
	const student1 = studentProfiles[0];
	const student2 = studentProfiles[1];

	if (student1 && student2) {
		// Student 1 completed Fall 2025 courses
		const enr1 = await prisma.enrollment.upsert({
			where: {
				studentId_sectionId: {
					studentId: student1.id,
					sectionId: secFallCSE101.id,
				},
			},
			update: {},
			create: {
				studentId: student1.id,
				sectionId: secFallCSE101.id,
				status: "COMPLETED",
				enrolledAt: new Date("2025-08-20T00:00:00Z"),
			},
		});

		const enr2 = await prisma.enrollment.upsert({
			where: {
				studentId_sectionId: {
					studentId: student1.id,
					sectionId: secFallMTH101.id,
				},
			},
			update: {},
			create: {
				studentId: student1.id,
				sectionId: secFallMTH101.id,
				status: "COMPLETED",
				enrolledAt: new Date("2025-08-20T00:00:00Z"),
			},
		});

		// Student 2 took CSE101 in Fall 2025 and failed (0.0 F), then retook in Spring 2026!
		const enrStudent2Fall = await prisma.enrollment.upsert({
			where: {
				studentId_sectionId: {
					studentId: student2.id,
					sectionId: secFallCSE101.id,
				},
			},
			update: {},
			create: {
				studentId: student2.id,
				sectionId: secFallCSE101.id,
				status: "COMPLETED",
				enrolledAt: new Date("2025-08-20T00:00:00Z"),
			},
		});

		// Fall 2025 Published Results
		await prisma.result.upsert({
			where: { enrollmentId: enr1.id },
			update: {},
			create: {
				enrollmentId: enr1.id,
				totalWeightedPercent: 88.5,
				letterGrade: "A+",
				gradePoint: 4.0,
				status: "PUBLISHED",
				publishedAt: new Date("2026-01-05T00:00:00Z"),
				publishedBy: adminUser.id,
			},
		});

		await prisma.result.upsert({
			where: { enrollmentId: enr2.id },
			update: {},
			create: {
				enrollmentId: enr2.id,
				totalWeightedPercent: 76.0,
				letterGrade: "A",
				gradePoint: 3.75,
				status: "PUBLISHED",
				publishedAt: new Date("2026-01-05T00:00:00Z"),
				publishedBy: adminUser.id,
			},
		});

		// Student 2 failed CSE101 in Fall 2025
		await prisma.result.upsert({
			where: { enrollmentId: enrStudent2Fall.id },
			update: {},
			create: {
				enrollmentId: enrStudent2Fall.id,
				totalWeightedPercent: 35.0,
				letterGrade: "F",
				gradePoint: 0.0,
				status: "PUBLISHED",
				publishedAt: new Date("2026-01-05T00:00:00Z"),
				publishedBy: adminUser.id,
			},
		});

		// Spring 2026 Active Enrollments
		await prisma.enrollment.upsert({
			where: {
				studentId_sectionId: {
					studentId: student1.id,
					sectionId: secSpringCSE102.id,
				},
			},
			update: {},
			create: {
				studentId: student1.id,
				sectionId: secSpringCSE102.id,
				status: "ENROLLED",
				enrolledAt: new Date("2026-01-10T00:00:00Z"),
			},
		});

		// Student 2 retaking CSE101 in Spring 2026 Section B
		const enrStudent2SpringRetake = await prisma.enrollment.upsert({
			where: {
				studentId_sectionId: {
					studentId: student2.id,
					sectionId: secSpringCSE101Retake.id,
				},
			},
			update: {},
			create: {
				studentId: student2.id,
				sectionId: secSpringCSE101Retake.id,
				status: "COMPLETED",
				enrolledAt: new Date("2026-01-12T00:00:00Z"),
			},
		});

		// Student 2 gets A- (3.5) on retake! (Demonstrates CGPA retake policy replacement)
		await prisma.result.upsert({
			where: { enrollmentId: enrStudent2SpringRetake.id },
			update: {},
			create: {
				enrollmentId: enrStudent2SpringRetake.id,
				totalWeightedPercent: 72.0,
				letterGrade: "A-",
				gradePoint: 3.5,
				status: "PUBLISHED",
				publishedAt: new Date("2026-05-15T00:00:00Z"),
				publishedBy: adminUser.id,
			},
		});

		// 11. Exams for Spring 2026 CSE102
		console.log("📋 Seeding exams...");
		let midtermExam = await prisma.exam.findFirst({
			where: {
				sectionId: secSpringCSE102.id,
				title: "Midterm Examination",
			},
		});
		if (!midtermExam) {
			midtermExam = await prisma.exam.create({
				data: {
					sectionId: secSpringCSE102.id,
					title: "Midterm Examination",
					weightPercent: 40,
					maxMarks: 100,
					examDate: new Date("2026-03-15T10:00:00Z"),
				},
			});
		}

		let finalExam = await prisma.exam.findFirst({
			where: {
				sectionId: secSpringCSE102.id,
				title: "Final Examination",
			},
		});
		if (!finalExam) {
			finalExam = await prisma.exam.create({
				data: {
					sectionId: secSpringCSE102.id,
					title: "Final Examination",
					weightPercent: 60,
					maxMarks: 100,
					examDate: new Date("2026-05-20T10:00:00Z"),
				},
			});
		}

		// 12. Attendance
		console.log("📅 Seeding attendance records...");
		const attendanceDates = [
			new Date("2025-09-08"),
			new Date("2025-09-10"),
			new Date("2025-09-15"),
		];

		for (const d of attendanceDates) {
			const existing = await prisma.attendance.findFirst({
				where: { enrollmentId: enr1.id, date: d },
			});
			if (!existing) {
				await prisma.attendance.create({
					data: {
						enrollmentId: enr1.id,
						sectionId: secFallCSE101.id,
						date: d,
						status: d.getDate() === 15 ? "LATE" : "PRESENT",
						remarks: d.getDate() === 15 ? "10 min late" : undefined,
					},
				});
			}
		}

		// 13. Invoices and Payments
		console.log("💳 Seeding tuition invoices and payments...");
		let invoiceFall = await prisma.invoice.findFirst({
			where: {
				studentId: student1.id,
				semesterId: semesterFall2025.id,
			},
		});
		if (!invoiceFall) {
			invoiceFall = await prisma.invoice.create({
				data: {
					studentId: student1.id,
					semesterId: semesterFall2025.id,
					amount: 1200.0,
					dueDate: new Date("2025-09-30T23:59:59Z"),
					status: "PAID",
					description: "Fall 2025 Tuition & Lab Fee",
				},
			});
		}

		const existingPayment = await prisma.payment.findFirst({
			where: { invoiceId: invoiceFall.id },
		});
		if (!existingPayment) {
			await prisma.payment.create({
				data: {
					invoiceId: invoiceFall.id,
					transactionId: `seed_txn_fall_${student1.id}`,
					amount: 1200.0,
					method: "STRIPE",
					status: "SUCCESS",
					gatewayResponse: { payment_intent: "pi_seed_mock_1" },
				},
			});
		}

		let invoiceSpring = await prisma.invoice.findFirst({
			where: {
				studentId: student1.id,
				semesterId: semesterSpring2026.id,
			},
		});
		if (!invoiceSpring) {
			invoiceSpring = await prisma.invoice.create({
				data: {
					studentId: student1.id,
					semesterId: semesterSpring2026.id,
					amount: 1200.0,
					dueDate: new Date("2026-02-15T23:59:59Z"),
					status: "PENDING",
					description: "Spring 2026 Tuition & Library Fee",
				},
			});
		}
	}

	console.log("\n========================================================");
	console.log("🎉 FULL DATABASE SEEDING COMPLETED SUCCESSFULLY!");
	console.log("========================================================");
	console.log("Admin Credentials:");
	console.log("  Email:    admin@university.edu");
	console.log("  Password: Admin1234!");
	console.log("\nInstructor Credentials:");
	console.log("  Email:    dr.smith@university.edu (CSE)");
	console.log("  Email:    dr.clark@university.edu (EEE)");
	console.log("  Password: Instructor123!");
	console.log("\nStudent Credentials (5 accounts):");
	console.log("  Email:    student1@university.edu to student5@university.edu");
	console.log("  Password: Student123!");
	console.log("========================================================\n");
}

main()
	.catch((e) => {
		console.error("❌ Seeding failed:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
