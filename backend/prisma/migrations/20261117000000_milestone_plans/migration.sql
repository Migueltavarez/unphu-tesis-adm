-- AlterTable
ALTER TABLE "careers" ADD COLUMN     "expectedMonths" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "maxMonths" INTEGER NOT NULL DEFAULT 24;

-- CreateTable
CREATE TABLE "milestone_templates" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "daysFromStart" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "completesAtStatus" "ThesisStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "thesisWorkId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "completesAtStatus" "ThesisStatus",
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestone_templates_careerId_idx" ON "milestone_templates"("careerId");

-- CreateIndex
CREATE INDEX "milestones_thesisWorkId_idx" ON "milestones"("thesisWorkId");

-- CreateIndex
CREATE INDEX "milestones_dueDate_idx" ON "milestones"("dueDate");

-- AddForeignKey
ALTER TABLE "milestone_templates" ADD CONSTRAINT "milestone_templates_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "careers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_thesisWorkId_fkey" FOREIGN KEY ("thesisWorkId") REFERENCES "thesis_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "milestone_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

