-- CreateEnum
CREATE TYPE "SemesterStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "Semester" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "status" "SemesterStatus" NOT NULL DEFAULT 'UPCOMING',
    "registrationStart" TIMESTAMP(3),
    "registrationEnd" TIMESTAMP(3),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Semester_status_idx" ON "Semester"("status");

-- CreateIndex
CREATE INDEX "Semester_year_idx" ON "Semester"("year");

-- CreateIndex
CREATE INDEX "Semester_deletedAt_idx" ON "Semester"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_year_term_key" ON "Semester"("year", "term");
