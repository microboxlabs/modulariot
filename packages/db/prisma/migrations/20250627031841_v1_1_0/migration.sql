/*
  Warnings:

  - You are about to drop the column `dbPassword` on the `Project` table. All the data in the column will be lost.
  - Added the required column `superadminPassword` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "dbPassword",
ADD COLUMN     "superadminPassword" TEXT NOT NULL;
