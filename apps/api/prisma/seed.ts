import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaPkg from '@prisma/client';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL missing');

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new prismaPkg.PrismaClient({ adapter });

async function main() {
const user = await prisma.user.upsert({
  where: { email: 'demo@mealops.local' },
  update: {},
  create: {
    email: 'demo@mealops.local',
    password: 'demo'
  }
});


  await prisma.ingredient.createMany({
    data: [
      { name: 'Chicken Breast', kcalPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
      { name: 'Rice (white, cooked)', kcalPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3 },
      { name: 'Olive Oil', kcalPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100 },
      { name: 'Egg', kcalPer100g: 143, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 9.5 }
    ],
    skipDuplicates: true
  });
  console.log('DEMO_USER_ID:', user.id);

}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
