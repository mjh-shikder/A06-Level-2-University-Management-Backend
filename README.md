# University Management Backend REST API

A scalable, secure, and production-ready **University Management System Backend** built with Node.js, Express 5, TypeScript (strict), PostgreSQL, and Prisma ORM 7.

Designed using **Feature-Based Modular Architecture** combined with the **Route-Controller-Service (Layered) Pattern**, incorporating strict Role-Based Access Control (RBAC), row-level concurrency locking, automated prerequisite cycle detection, retake policy grading engines, Stripe checkout payments with idempotent webhooks, and comprehensive transactional audit logging.

## Project Links

- [ERD Diagram](https://drawsql.app/teams/mjh-dev/diagrams/university-management-a6)
- [Live API](https://university-management-backend-indol.vercel.app/)
- [Project Explanation](https://drive.google.com/file/d/1fitRoNnHFJ8Jaxsx51vGRH_TsipQsx21/view?usp=sharing)
- [API Docs (Postman collection and environment)](./docs/)
---

## 📑 Table of Contents

- [Overview & Key Features](#-overview--key-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Entity Relationship Diagram (ERD)](#-entity-relationship-diagram-erd)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation & Setup](#installation--setup)
  - [Database Migration & Seeding](#database-migration--seeding)
  - [Running the Application](#running-the-application)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Core Business Rules](#-core-business-rules)
  - [Enrollment & Concurrency Safety](#1-enrollment--concurrency-safety)
  - [Grading Scale & GPA Computation](#2-grading-scale--gpa-computation)
  - [Course Retake Policy](#3-course-retake-policy)
  - [Invoicing & Payment Flow](#4-invoicing--payment-flow)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Postman Collection & Verification](#-postman-collection--verification)
- [Deployment Guide (Render)](#-deployment-guide-render)

---

## 🌟 Overview & Key Features

- **Authentication & RBAC**:
  - Stateless JWT access tokens (15m expiration) paired with cryptographically hashed, rotating refresh tokens (7d expiration).
  - Cookie and Bearer authorization support with CSRF-safe cookie configuration.
  - Multi-tier Role-Based Access Control: `ADMIN`, `INSTRUCTOR`, and `STUDENT`.
  - Automatic session revocation upon user suspension or password updates.
- **Academic Hierarchy**:
  - Departments $\to$ Academic Programs $\to$ Courses $\to$ Semesters $\to$ Course Sections.
  - Self-referential Course Prerequisites with BFS graph cycle detection to prevent circular prerequisite definitions.
  - Section scheduling with weekly recurring slot validation and conflict detection.
- **Transactional Course Enrollment**:
  - Row-level database locking (`SELECT ... FOR UPDATE`) prevents section over-enrollment races under high concurrency.
  - Multi-check enrollment validator: semester active status, registration window, capacity, credit limits, schedule overlap, prerequisite verification, and unpaid invoice blocking.
- **Attendance & Examination**:
  - Daily per-section bulk attendance tracking with percentage metrics calculation.
  - Weighted exam configurations ($\sum \text{weight} \le 100\%$) with bulk marks entry and max marks validation.
  - Section-wide draft result computation and administrative publishing/unpublishing lifecycle.
- **GPA & Transcript Engine**:
  - Semester GPA (SGPA) and Cumulative GPA (CGPA) on standard 4.0 scale.
  - Retake policy: "Latest Attempt Counts" — superseding previous attempts from CGPA and earned credit totals.
  - Official transcript and quick GPA summary endpoints.
- **Financial Operations & Payments**:
  - Semester tuition and fee invoice generation for students.
  - Pluggable payment gateway abstraction with production-ready Stripe Checkout Session integration.
  - Stripe webhook handler featuring raw payload buffering, cryptographic signature verification, and database-level idempotency guards.
- **Administration & Audit Trail**:
  - Executive dashboard statistics (demographics, active semester enrollments, financial totals).
  - Searchable audit log tracking actor, action, before/after JSON state, and client IP across all mutations.
  - Analytical semester performance reports (enrollment metrics, revenue, average GPA, grade distribution, pass rate).

---

## 🛠 Tech Stack

- **Runtime & Language**: Node.js (v20.19+ or v22.12+), TypeScript 5.8+ (Strict mode, ES2023)
- **Web Framework**: Express 5.3+
- **Database & ORM**: PostgreSQL, Prisma ORM 7.10+ with `@prisma/adapter-pg` driver adapter
- **Validation**: Zod 4.6+
- **Security & Utilities**: Helmet, CORS, Express-Rate-Limit, Cookie-Parser, BCrypt, JsonWebToken, HTTP-Status
- **Payments**: Stripe SDK
- **Code Quality**: Biome (Linting & Formatting)
- **Testing**: Vitest, Supertest

---

## 🏗 System Architecture

The application strictly adopts **Feature-Based Modular Architecture** combined with the **Route-Controller-Service (Layered) Pattern**:

```text
src/
├── app.ts                          # Express application configuration & global middlewares
├── server.ts                       # Server bootstrap and graceful shutdown
├── config/                         # Typed environment variables via Zod
├── lib/
│   ├── prisma.ts                   # Extended Prisma Client (centralized soft-delete)
│   └── payment/                    # Payment provider abstraction & Stripe implementation
├── middleware/
│   ├── authenticate.ts             # JWT authentication middleware
│   ├── authorize.ts                # Role-based authorization middleware
│   ├── validate.ts                 # Zod request validation middleware
│   ├── globalErrorHandler.ts       # Centralized error handler with error classification
│   └── notFound.ts                 # 404 Route handler
├── utils/
│   ├── AppError.ts                 # Custom operational error class
│   ├── catchAsync.ts               # Async controller wrapper
│   ├── sendResponse.ts             # Standardized API response formatter
│   ├── auditLog.ts                 # Transaction-aware audit logging utility
│   ├── grading.ts                  # GPA, SGPA, CGPA & retake calculations
│   └── paginate.ts                 # Pagination metadata calculator
├── modules/
│   ├── admin/                      # User admin, dashboard, audit viewer, reports
│   ├── attendance/                 # Section attendance & summaries
│   ├── auth/                       # Registration, login, token rotation, logout
│   ├── course/                     # Courses & prerequisite graph
│   ├── department/                 # Academic departments
│   ├── enrollment/                 # Section enrollment, drops, rosters
│   ├── exam/                       # Exams & marks entry
│   ├── invoice/                    # Invoices & checkout initiation
│   ├── payment/                    # Stripe webhook processing
│   ├── program/                    # Degree programs
│   ├── result/                     # Grade computation & publishing
│   ├── section/                    # Course sections & instructor assignments
│   ├── semester/                   # Academic semesters
│   ├── transcript/                 # Student transcripts & GPA queries
│   └── user/                       # User profiles & password management
└── routes/
    └── index.ts                    # Root API router mounting all modules
```

---

## 📊 Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o| StudentProfile : "has"
    User ||--o| InstructorProfile : "has"
    User ||--o{ RefreshToken : "holds"
    User ||--o{ AuditLog : "performed"

    Department ||--o{ Program : "offers"
    Department ||--o{ InstructorProfile : "employs"

    Program ||--o{ Course : "contains"
    Program ||--o{ StudentProfile : "enrolls"

    Course ||--o{ CoursePrerequisite : "requires"
    Course ||--o{ Section : "offered as"

    Semester ||--o{ Section : "schedules"
    Semester ||--o{ Invoice : "billed in"

    Section ||--o{ Enrollment : "contains"
    Section ||--o{ Attendance : "tracks"
    Section ||--o{ Exam : "schedules"
    Section }o--o| InstructorProfile : "taught by"

    StudentProfile ||--o{ Enrollment : "takes"
    StudentProfile ||--o{ Invoice : "owes"

    Enrollment ||--o| Result : "graded by"
    Enrollment ||--o{ Attendance : "records"
    Enrollment ||--o{ ExamMark : "receives"

    Exam ||--o{ ExamMark : "scores"

    Invoice ||--o{ Payment : "settled via"
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `^20.19 || ^22.12 || >=24.0`
- **PostgreSQL**: Local instance or cloud database (Neon, Supabase, Prisma Postgres)
- **Git**

### Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/university-management-backend.git
   cd university-management-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   PORT=5000
   DATABASE_URL="postgresql://user:password@localhost:5432/university_db?schema=public"
   FRONTEND_URL="http://localhost:3000"
   BACKEND_URL="http://localhost:5000"
   CORS_ORIGINS="http://localhost:3000"
   JWT_ACCESS_SECRET="your-super-secret-jwt-access-key-15m"
   JWT_REFRESH_SECRET="your-super-secret-jwt-refresh-key-7d"
   BCRYPT_SALT_ROUNDS=12
   STRIPE_SECRET_KEY="sk_test_placeholder"
   STRIPE_WEBHOOK_SECRET="whsec_placeholder"
   STRIPE_CURRENCY="usd"
   ENROLLMENT_BLOCK_ON_UNPAID=true
   MAX_CREDITS_PER_SEMESTER=18
   ```

### Database Migration & Seeding

1. **Apply Migrations**:
   ```bash
   npx prisma migrate dev
   ```

2. **Generate Prisma Client**:
   ```bash
   npm run db:generate
   ```

3. **Run Full Database Seed**:
   ```bash
   npm run db:seed
   ```
   *Seeds 1 Admin, 2 Instructors, 5 Students, 3 Departments, 5 Programs, 10 Courses with Prerequisites, 2 Semesters, 8 Sections, Enrollments, Exams, Marks, Results, Invoices, and Payments.*

### Running the Application

- **Development Server** (with watch mode):
  ```bash
  npm run dev
  ```
- **Type Checking**:
  ```bash
  npm run typecheck
  ```
- **Build**:
  ```bash
  npm run build
  ```
- **Production Start**:
  ```bash
  npm start
  ```

---

## 🔑 Environment Variables Reference

| Variable | Type | Default | Description |
|---|---|---|---|
| `NODE_ENV` | `enum` | `development` | Environment mode (`development`, `test`, `production`) |
| `PORT` | `number` | `5000` | Port Express server listens on |
| `DATABASE_URL` | `string` | *(Required)* | PostgreSQL connection string |
| `FRONTEND_URL` | `string` | `http://localhost:3000` | Client application URL |
| `BACKEND_URL` | `string` | `http://localhost:5000` | Server application URL |
| `CORS_ORIGINS` | `string` | `http://localhost:3000` | Comma-separated allowed origins |
| `JWT_ACCESS_SECRET` | `string` | `dev-jwt-access-secret-key-15m` | Secret used to sign 15-minute access tokens |
| `JWT_REFRESH_SECRET` | `string` | `dev-jwt-refresh-secret-key-7d` | Secret used to sign 7-day refresh tokens |
| `BCRYPT_SALT_ROUNDS` | `number` | `12` | BCrypt password hashing rounds |
| `STRIPE_SECRET_KEY` | `string` | `sk_test_placeholder` | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | `string` | `whsec_placeholder` | Stripe webhook signing secret |
| `STRIPE_CURRENCY` | `string` | `usd` | Currency for Stripe Checkout payments |
| `ENROLLMENT_BLOCK_ON_UNPAID`| `boolean` | `true` | Prevents enrollment if student has unpaid invoices |
| `MAX_CREDITS_PER_SEMESTER` | `number` | `18` | Maximum course credits a student can take per term |

---

## 📡 API Reference

All endpoints are versioned under `/api/v1`.

### 0. Health
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | Public | Server uptime and health check |

### 1. Authentication
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public / Admin | Register student (Public) or any role (Admin) |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user, return tokens & set cookie |
| `POST` | `/api/v1/auth/refresh-token` | Public | Rotate refresh token & obtain new access token |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revoke refresh token and clear cookie |
| `GET` | `/api/v1/auth/me` | Authenticated | Get currently authenticated user details |

### 2. User Profile
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/users/me` | Authenticated | Get current user profile |
| `PATCH` | `/api/v1/users/me` | Authenticated | Update name or profile information |
| `POST` | `/api/v1/users/me/change-password` | Authenticated | Update password and revoke other sessions |

### 3. Departments
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/departments` | `ADMIN` | Create a new department |
| `GET` | `/api/v1/departments` | Authenticated | List departments with pagination & search |
| `GET` | `/api/v1/departments/:id` | Authenticated | Get department details |
| `PATCH` | `/api/v1/departments/:id` | `ADMIN` | Update department details |
| `DELETE` | `/api/v1/departments/:id` | `ADMIN` | Soft delete department |

### 4. Academic Programs
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/programs` | `ADMIN` | Create an academic degree program |
| `GET` | `/api/v1/programs` | Authenticated | List programs with department filter |
| `GET` | `/api/v1/programs/:id` | Authenticated | Get program details |
| `PATCH` | `/api/v1/programs/:id` | `ADMIN` | Update program details |
| `DELETE` | `/api/v1/programs/:id` | `ADMIN` | Soft delete program |

### 5. Courses & Prerequisites
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/courses` | `ADMIN` | Create course under a program |
| `GET` | `/api/v1/courses` | Authenticated | List courses with filtering and search |
| `GET` | `/api/v1/courses/:id` | Authenticated | Get course details and prerequisites |
| `PATCH` | `/api/v1/courses/:id` | `ADMIN` | Update course |
| `DELETE` | `/api/v1/courses/:id` | `ADMIN` | Soft delete course |
| `POST` | `/api/v1/courses/:id/prerequisites` | `ADMIN` | Add prerequisite (with cycle detection) |
| `DELETE` | `/api/v1/courses/:id/prerequisites/:prereqId` | `ADMIN` | Remove prerequisite |

### 6. Semesters
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/semesters` | `ADMIN` | Create academic semester |
| `GET` | `/api/v1/semesters` | Authenticated | List semesters |
| `GET` | `/api/v1/semesters/:id` | Authenticated | Get semester details |
| `PATCH` | `/api/v1/semesters/:id` | `ADMIN` | Update semester details |
| `DELETE` | `/api/v1/semesters/:id` | `ADMIN` | Soft delete semester |
| `PATCH` | `/api/v1/semesters/:id/status` | `ADMIN` | Update status (`UPCOMING`, `ACTIVE`, `COMPLETED`) |

### 7. Course Sections
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/sections` | `ADMIN` | Create course section with weekly schedule |
| `GET` | `/api/v1/sections` | Authenticated | List sections with semester/course filters |
| `GET` | `/api/v1/sections/:id` | Authenticated | Get section details |
| `PATCH` | `/api/v1/sections/:id` | `ADMIN` | Update section capacity or schedule |
| `DELETE` | `/api/v1/sections/:id` | `ADMIN` | Soft delete section |
| `PATCH` | `/api/v1/sections/:id/instructor` | `ADMIN` | Assign or reassign instructor |

### 8. Course Enrollments
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/enrollments` | `STUDENT` | Enroll into section (row-locked concurrency check) |
| `PATCH` | `/api/v1/enrollments/:id/drop` | `STUDENT` | Drop enrolled course before deadline |
| `GET` | `/api/v1/enrollments/my` | `STUDENT` | View own active/completed enrollments |
| `GET` | `/api/v1/sections/:id/students` | `INSTRUCTOR`, `ADMIN` | View student roster for section |

### 9. Attendance
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/attendance/sections/:sectionId` | `INSTRUCTOR`, `ADMIN` | Bulk mark attendance for section |
| `GET` | `/api/v1/attendance/sections/:sectionId` | `INSTRUCTOR`, `ADMIN` | Get section attendance records |
| `GET` | `/api/v1/attendance/enrollments/:id` | `STUDENT`, `INSTRUCTOR`, `ADMIN` | Get enrollment attendance history |
| `GET` | `/api/v1/attendance/enrollments/:id/summary` | `STUDENT`, `INSTRUCTOR`, `ADMIN` | Get attendance percentage metrics |

### 10. Exams & Marks
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/exams` | `INSTRUCTOR`, `ADMIN` | Create exam with weight percentage |
| `GET` | `/api/v1/exams/sections/:sectionId` | `INSTRUCTOR`, `ADMIN` | List exams for section |
| `PATCH` | `/api/v1/exams/:id` | `INSTRUCTOR`, `ADMIN` | Update exam title, date, or weight |
| `DELETE` | `/api/v1/exams/:id` | `INSTRUCTOR`, `ADMIN` | Soft delete exam (blocked if marks exist) |
| `POST` | `/api/v1/exams/:id/marks` | `INSTRUCTOR`, `ADMIN` | Bulk enter/upsert student marks |
| `GET` | `/api/v1/exams/:id/marks` | `INSTRUCTOR`, `ADMIN` | Retrieve entered marks for exam |

### 11. Results
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/results/sections/:sectionId/compute` | `INSTRUCTOR`, `ADMIN` | Compute weighted draft results |
| `GET` | `/api/v1/results/sections/:sectionId` | `INSTRUCTOR`, `ADMIN` | View draft/published results |
| `PATCH` | `/api/v1/results/sections/:sectionId/publish` | `ADMIN` | Publish results & complete enrollments |
| `PATCH` | `/api/v1/results/sections/:sectionId/unpublish` | `ADMIN` | Revert results to draft |
| `GET` | `/api/v1/results/my` | `STUDENT` | View own published course grades |

### 12. Transcripts & GPA
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/students/me/transcript` | `STUDENT` | View own official transcript |
| `GET` | `/api/v1/students/me/gpa` | `STUDENT` | View own SGPA per term and CGPA |
| `GET` | `/api/v1/students/:studentId/transcript` | `ADMIN`, `INSTRUCTOR` | View any student's transcript |
| `GET` | `/api/v1/students/:studentId/gpa` | `ADMIN`, `INSTRUCTOR` | View any student's GPA summary |

### 13. Invoices & Payments
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/invoices` | `ADMIN` | Generate tuition/fee invoice for student |
| `GET` | `/api/v1/invoices` | `ADMIN` | List all invoices with status/student filters |
| `GET` | `/api/v1/invoices/my` | `STUDENT` | List own invoices |
| `GET` | `/api/v1/invoices/:id` | `STUDENT` (own), `ADMIN` | View invoice detail with payment history |
| `POST` | `/api/v1/invoices/:id/pay` | `STUDENT` | Initiate Stripe Checkout session |
| `POST` | `/api/v1/payments/webhook` | Public (Signature-verified) | Stripe webhook (`checkout.session.completed`) |

### 14. Admin Operations
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/users` | `ADMIN` | List users with role/status filters & search |
| `PATCH` | `/api/v1/admin/users/:id/role` | `ADMIN` | Update user role (audit logged) |
| `PATCH` | `/api/v1/admin/users/:id/status` | `ADMIN` | Suspend/activate user (revokes tokens) |
| `GET` | `/api/v1/admin/dashboard` | `ADMIN` | Overview counts, active enrollments, revenue |
| `GET` | `/api/v1/admin/audit-logs` | `ADMIN` | View audit trail with actor/entity filters |
| `GET` | `/api/v1/admin/semesters/:id/report` | `ADMIN` | Semester report: enrollment, revenue, avg GPA |

---

## 📐 Core Business Rules

### 1. Enrollment & Concurrency Safety
- **Locking**: Section records are locked using PostgreSQL row-level locks (`SELECT "id" FROM "Section" WHERE "id" = $id FOR UPDATE`) inside the enrollment transaction.
- **Rules checked in order**:
  1. Student user account must be `ACTIVE`.
  2. Section must exist and capacity must not be exceeded (`enrolledCount < capacity`).
  3. Associated semester must be `ACTIVE` and current time must fall within the registration window (`registrationStart` to `registrationEnd`).
  4. Student cannot be actively enrolled in the same section or another section of the same course in the same semester.
  5. Student must have passed all course prerequisites with a `COMPLETED` enrollment and passing grade ($\ge 2.0$).
  6. Enrolled credits for the semester cannot exceed `MAX_CREDITS_PER_SEMESTER` (default: 18).
  7. Section schedule times cannot overlap with any of the student's existing enrolled sections in that semester.
  8. Unpaid invoice check: if `ENROLLMENT_BLOCK_ON_UNPAID=true`, students with pending or overdue invoices are blocked from new enrollments.

### 2. Grading Scale & GPA Computation

| Marks Range (%) | Letter Grade | Grade Point (4.0 Scale) | Description |
|---|---|---|---|
| 80 – 100 | **A+** | 4.00 | Outstanding |
| 75 – 79.99 | **A** | 3.75 | Excellent |
| 70 – 74.99 | **A-** | 3.50 | Very Good |
| 65 – 69.99 | **B+** | 3.25 | Good |
| 60 – 64.99 | **B** | 3.00 | Satisfactory |
| 55 – 59.99 | **B-** | 2.75 | Above Average |
| 50 – 54.99 | **C+** | 2.50 | Average |
| 45 – 49.99 | **C** | 2.25 | Below Average |
| 40 – 44.99 | **D** | 2.00 | Pass |
| 0 – 39.99 | **F** | 0.00 | Fail |

- **SGPA Formula**:
  $$\text{SGPA} = \frac{\sum_{i=1}^{n} (\text{GradePoint}_i \times \text{Credits}_i)}{\sum_{i=1}^{n} \text{Credits}_i}$$
  *Calculated across all courses taken in that specific semester.*

### 3. Course Retake Policy
- If a student enrolls in and completes the same course multiple times across semesters:
  - Each semester's SGPA reflects the grades achieved in that specific semester.
  - For **CGPA** and **Cumulative Credits Earned**, only the **latest attempt** (by `enrolledAt` timestamp) is included.
  - Earlier attempts for that course are marked `isRetake: true, isLatestAttempt: false` and are excluded from cumulative GPA quality points and earned credit totals.

### 4. Invoicing & Payment Flow
- Admin issues an invoice for tuition/fees linked to a student and semester.
- Student initiates payment $\to$ backend calls Stripe Checkout Session API $\to$ records a `Payment` row in `INITIATED` status $\to$ returns checkout redirect URL.
- Student completes card payment on Stripe $\to$ Stripe delivers `checkout.session.completed` event to `/api/v1/payments/webhook`.
- Webhook verifies HMAC-SHA256 signature using `STRIPE_WEBHOOK_SECRET`.
- **Idempotency Guard**: checks if `Payment` row is already `SUCCESS`. If so, returns `200 OK` immediately without duplicate writes.
- If total successful payments $\ge$ invoice amount, parent `Invoice` is automatically transitioned to `PAID`.

---

## 🧪 Testing & Quality Assurance

The project maintains **100% passing test coverage** across grading utilities, RBAC middleware, transcript generation, Stripe checkout, webhooks, and admin operations.

```bash
# Run full Vitest suite (42 tests)
npm test

# Run Biome linter
npm run lint:check

# Run Biome formatter check
npm run format:check

# TypeScript type check (no emit)
npm run typecheck

# Production build test
npm run build
```

---

## 📬 Postman Collection & Verification

A complete Postman workspace is pre-packaged in the repository under [docs/](file:///d:/Next-Level/Assignments/A06/University_Management_Backend/docs/):
- **Collection**: [docs/University_Management.postman_collection.json](file:///d:/Next-Level/Assignments/A06/University_Management_Backend/docs/University_Management.postman_collection.json)
- **Environment**: [docs/University_Management.postman_environment.json](file:///d:/Next-Level/Assignments/A06/University_Management_Backend/docs/University_Management.postman_environment.json)

### Importing & Running:
1. Open Postman $\to$ Click **Import** $\to$ Select both files from `docs/`.
2. Select the **University Management Backend Environment** in the top-right environment selector.
3. Run the **Login - Admin** request:
   - The test script automatically stores the access token into `{{accessToken}}` and `{{adminAccessToken}}`.
4. Subsequent requests automatically use `Bearer {{accessToken}}` without requiring manual token copy-pasting.

---

## ☁️ Deployment Guide (Render)

### 1. Database Provisioning
- Create a PostgreSQL database on **Render** (or use Supabase / Neon / Prisma Postgres).
- Copy the **Internal Database URL** (or External URL if deploying externally).

### 2. Web Service Setup on Render
1. Create a new **Web Service** on Render and connect your Git repository.
2. Configure settings:
   - **Environment**: `Node`
   - **Node Version**: `22.12.0` (set in Environment as `NODE_VERSION=22.12.0`)
   - **Build Command**:
     ```bash
     npm install && npx prisma migrate deploy && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
3. Set **Environment Variables** in Render dashboard:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (or Render's default port)
   - `JWT_ACCESS_SECRET`: Secure 64-character random string
   - `JWT_REFRESH_SECRET`: Secure 64-character random string
   - `CORS_ORIGINS`: Your production frontend URL (e.g. `https://my-university.vercel.app`)
   - `STRIPE_SECRET_KEY`: Production Stripe secret key
   - `STRIPE_WEBHOOK_SECRET`: Production Stripe webhook secret
   - `STRIPE_CURRENCY`: `usd`
   - `ENROLLMENT_BLOCK_ON_UNPAID`: `true`
   - `MAX_CREDITS_PER_SEMESTER`: `18`

### 3. Stripe Webhook Endpoint Configuration
In your Stripe Dashboard:
- Add webhook endpoint: `https://<YOUR-RENDER-APP>.onrender.com/api/v1/payments/webhook`
- Select event to listen: `checkout.session.completed`
- Copy the generated Webhook Signing Secret (`whsec_...`) into Render's `STRIPE_WEBHOOK_SECRET`.

---

## 📄 License

This project is licensed under the [ISC License](file:///d:/Next-Level/Assignments/A06/University_Management_Backend/package.json).
