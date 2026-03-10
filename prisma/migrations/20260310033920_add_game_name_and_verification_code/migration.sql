/*
  Warnings:

  - Added the required column `gameName` to the `NameBinding` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastSentAt` to the `NameBinding` table without a default value. This is not possible if the table is not empty.
  - Added the required column `verificationCode` to the `NameBinding` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NameBinding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "gameName" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NameBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NameBinding" ("createdAt", "expiresAt", "id", "token", "userId") SELECT "createdAt", "expiresAt", "id", "token", "userId" FROM "NameBinding";
DROP TABLE "NameBinding";
ALTER TABLE "new_NameBinding" RENAME TO "NameBinding";
CREATE UNIQUE INDEX "NameBinding_token_key" ON "NameBinding"("token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
