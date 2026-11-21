-- CreateTable
CREATE TABLE "Exam" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "weightPercent" DECIMAL(5,2) NOT NULL,
    "maxMarks" DECIMAL(5,2) NOT NULL,
    "examDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamMark" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "obtainedMarks" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exam_sectionId_idx" ON "Exam"("sectionId");

-- CreateIndex
CREATE INDEX "ExamMark_examId_idx" ON "ExamMark"("examId");

-- CreateIndex
CREATE INDEX "ExamMark_enrollmentId_idx" ON "ExamMark"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamMark_examId_enrollmentId_key" ON "ExamMark"("examId", "enrollmentId");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
