import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaPkg from '@prisma/client';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is missing in apps/api/.env');

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);

export const prisma = new prismaPkg.PrismaClient({ adapter });
