-- AlterTable
ALTER TABLE "SupportThread" ADD COLUMN "email" TEXT;
ALTER TABLE "SupportThread" ADD COLUMN "name" TEXT;
ALTER TABLE "SupportThread" ADD COLUMN "token" TEXT;
ALTER TABLE "SupportThread" ALTER COLUMN "userId" DROP NOT NULL;

-- Backfill existing rows from their linked User before enforcing NOT NULL
UPDATE "SupportThread" t
SET "email" = u."email", "name" = u."displayName"
FROM "User" u
WHERE t."userId" = u."id" AND t."email" IS NULL;

ALTER TABLE "SupportThread" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SupportThread_email_key" ON "SupportThread"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SupportThread_token_key" ON "SupportThread"("token");