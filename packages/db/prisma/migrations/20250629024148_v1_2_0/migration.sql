-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('AUTH0');

-- CreateTable
CREATE TABLE "ProjectIdentityApp" (
    "id" TEXT NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "projectId" TEXT NOT NULL,
    "externalAppId" TEXT NOT NULL,
    "externalSecret" TEXT,
    "issuer" TEXT,
    "tenant" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectIdentityApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" TEXT NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "userId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectIdentityApp_projectId_key" ON "ProjectIdentityApp"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectIdentityApp_externalAppId_key" ON "ProjectIdentityApp"("externalAppId");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_externalUserId_key" ON "UserIdentity"("externalUserId");

-- AddForeignKey
ALTER TABLE "ProjectIdentityApp" ADD CONSTRAINT "ProjectIdentityApp_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
