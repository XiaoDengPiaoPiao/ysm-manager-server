// 导入Prisma客户端和适配器
import { PrismaClient } from '../../generated/prisma/client.ts';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// 创建适配器配置
const dbPath = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = new PrismaBetterSqlite3({ url: dbPath });

// 创建Prisma实例
const prisma = new PrismaClient({ adapter });

export default prisma;