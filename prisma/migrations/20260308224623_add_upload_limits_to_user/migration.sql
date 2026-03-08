-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL DEFAULT '',
    "gameName" TEXT NOT NULL DEFAULT '',
    "token" TEXT DEFAULT '',
    "tokenExpiresAt" DATETIME,
    "customUploadLimit" INTEGER NOT NULL DEFAULT 5,
    "authUploadLimit" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "gameName", "id", "name", "password", "token", "tokenExpiresAt", "updatedAt") SELECT "createdAt", "gameName", "id", "name", "password", "token", "tokenExpiresAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
