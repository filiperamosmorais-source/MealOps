import 'dotenv/config';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './db.js';
import { add, roundNutrition } from './nutrition.js';
import cors from '@fastify/cors';
import { registerAuth } from './auth.js';
import bcrypt from 'bcrypt';

const app = Fastify();

await registerAuth(app);

await app.register(cors, {
	origin: ['http://localhost:5173'],
});

async function requireAdmin(req: any, reply: any) {
	const userId = req.user?.sub as string | undefined;
	if (!userId) {
		return reply.code(401).send({ error: 'Unauthorized' });
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { role: true },
	});

	if (!user || user.role !== 'ADMIN') {
		return reply.code(403).send({ error: 'Forbidden' });
	}
}

const mealSlotSchema = z.enum(['breakfast', 'lunch', 'afternoon_snack', 'dinner']);
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const slotSortOrder = ['breakfast', 'lunch', 'afternoon_snack', 'dinner'] as const;

function parseDateOnly(value: string): Date | null {
	if (!DATE_ONLY_REGEX.test(value)) {
		return null;
	}

	const date = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return formatDateOnly(date) === value ? date : null;
}

function formatDateOnly(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function addDaysUtc(date: Date, days: number): Date {
	const copy = new Date(date);
	copy.setUTCDate(copy.getUTCDate() + days);
	return copy;
}

function isWithinWeek(date: Date, weekStart: Date): boolean {
	const dayMs = 24 * 60 * 60 * 1000;
	const diffMs = date.getTime() - weekStart.getTime();
	return diffMs >= 0 && diffMs <= dayMs * 6;
}

function slotRank(slot: string): number {
	const idx = slotSortOrder.indexOf(slot as (typeof slotSortOrder)[number]);
	return idx === -1 ? slotSortOrder.length : idx;
}

app.get('/health', async () => ({ ok: true }));

app.get('/ingredients', async () => {
	return prisma.ingredient.findMany({ orderBy: { name: 'asc' } });
});

app.post(
	'/ingredients',
	{ preHandler: [(app as any).authenticate, requireAdmin] },
	async (req, reply) => {
		const Body = z.object({
			name: z.string().trim().min(1),
			kcalPer100g: z.number().min(0),
			proteinPer100g: z.number().min(0),
			carbsPer100g: z.number().min(0),
			fatPer100g: z.number().min(0),
		});
		const body = Body.parse(req.body);

		try {
			return await prisma.ingredient.create({ data: body });
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				return reply.code(409).send({ error: 'Ingredient name already exists' });
			}
			throw error;
		}
	}
);

app.delete(
	'/ingredients/:id',
	{ preHandler: [(app as any).authenticate, requireAdmin] },
	async (req, reply) => {
		const Params = z.object({ id: z.string().min(1) });
		const { id } = Params.parse(req.params);

		try {
			await prisma.ingredient.delete({ where: { id } });
			return reply.code(204).send();
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
				return reply.code(404).send({ error: 'Ingredient not found' });
			}

			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
				return reply
					.code(409)
					.send({ error: 'Ingredient is already used in recipes and cannot be deleted' });
			}

			throw error;
		}
	}
);

app.post('/recipes', { preHandler: (app as any).authenticate }, async (req: any, reply) => {
	const Body = z.object({
		name: z.string().min(1),
		servings: z.number().int().min(1),
		notes: z.string().max(5000).optional(),
		items: z
			.array(
				z.object({
					ingredientId: z.string().min(1),
					quantityG: z.number().positive(),
				})
			)
			.min(1),
	});

	const body = Body.parse(req.body);
	const userId = req.user.sub as string;
	const notes = body.notes?.trim() || null;

	const ingredientIds = [...new Set(body.items.map((i) => i.ingredientId))];
	const ingredients = await prisma.ingredient.findMany({
		where: { id: { in: ingredientIds } },
	});

	const byId = new Map(ingredients.map((i) => [i.id, i]));

	for (const it of body.items) {
		if (!byId.has(it.ingredientId)) {
			return reply.status(400).send({ error: `Unknown ingredientId: ${it.ingredientId}` });
		}
	}

	const created = await prisma.$transaction(async (tx) => {
		return tx.recipe.create({
			data: {
				userId,
				name: body.name,
				servings: body.servings,
				notes,
				items: {
					create: body.items.map((it) => ({
						ingredientId: it.ingredientId,
						quantityG: it.quantityG,
					})),
				},
			},
			include: { items: true },
		});
	});

	const totals = body.items.reduce(
		(acc, it) => {
			const ing = byId.get(it.ingredientId)!;
			const factor = it.quantityG / 100;

			return add(acc, {
				kcal: ing.kcalPer100g * factor,
				protein: ing.proteinPer100g * factor,
				carbs: ing.carbsPer100g * factor,
				fat: ing.fatPer100g * factor,
			});
		},
		{ kcal: 0, protein: 0, carbs: 0, fat: 0 }
	);

	const perServing = {
		kcal: totals.kcal / body.servings,
		protein: totals.protein / body.servings,
		carbs: totals.carbs / body.servings,
		fat: totals.fat / body.servings,
	};

	return {
		recipe: created,
		nutrition: {
			total: roundNutrition(totals),
			perServing: roundNutrition(perServing),
		},
	};
});

app.get('/recipes', { preHandler: (app as any).authenticate }, async (req: any) => {
	const userId = req.user.sub as string;

	const recipes = await prisma.recipe.findMany({
		where: { userId },
		orderBy: { createdAt: 'desc' },
		include: {
			items: { include: { ingredient: true } },
		},
	});

	return recipes.map((r) => {
		const totals = r.items.reduce(
			(acc, it) => {
				const factor = it.quantityG / 100;

				acc.kcal += it.ingredient.kcalPer100g * factor;
				acc.protein += it.ingredient.proteinPer100g * factor;
				acc.carbs += it.ingredient.carbsPer100g * factor;
				acc.fat += it.ingredient.fatPer100g * factor;

				return acc;
			},
			{ kcal: 0, protein: 0, carbs: 0, fat: 0 }
		);

		const perServingTotals = {
			kcal: totals.kcal / r.servings,
			protein: totals.protein / r.servings,
			carbs: totals.carbs / r.servings,
			fat: totals.fat / r.servings,
		};

		return {
			id: r.id,
			name: r.name,
			servings: r.servings,
			notes: r.notes,
			createdAt: r.createdAt,
			nutrition: {
				total: roundNutrition(totals),
				perServing: roundNutrition(perServingTotals),
			},
		};
	});
});

app.get('/meal-plans', { preHandler: (app as any).authenticate }, async (req: any, reply) => {
	const Query = z.object({
		weekStart: z.string(),
	});

	const query = Query.parse(req.query);
	const weekStart = parseDateOnly(query.weekStart);
	if (!weekStart) {
		return reply.code(400).send({ error: 'weekStart must be YYYY-MM-DD' });
	}

	const userId = req.user.sub as string;

	const plan = await prisma.mealPlan.findFirst({
		where: { userId, weekStart },
		include: {
			meals: {
				include: {
					recipe: { select: { id: true, name: true } },
				},
			},
		},
	});

	const meals = (plan?.meals ?? [])
		.map((meal) => ({
			date: formatDateOnly(meal.date),
			slot: meal.slot,
			recipeId: meal.recipe.id,
			recipeName: meal.recipe.name,
		}))
		.sort((a, b) => {
			const dateCompare = a.date.localeCompare(b.date);
			if (dateCompare !== 0) return dateCompare;
			return slotRank(a.slot) - slotRank(b.slot);
		});

	return {
		id: plan?.id ?? null,
		weekStart: query.weekStart,
		meals,
	};
});

app.put('/meal-plans', { preHandler: (app as any).authenticate }, async (req: any, reply) => {
	const Body = z.object({
		weekStart: z.string(),
		meals: z.array(
			z.object({
				date: z.string(),
				slot: mealSlotSchema,
				recipeId: z.string().min(1),
			})
		),
	});

	const body = Body.parse(req.body);
	const weekStart = parseDateOnly(body.weekStart);
	if (!weekStart) {
		return reply.code(400).send({ error: 'weekStart must be YYYY-MM-DD' });
	}

	const meals: Array<{ date: Date; slot: z.infer<typeof mealSlotSchema>; recipeId: string }> = [];
	for (const meal of body.meals) {
		const date = parseDateOnly(meal.date);
		if (!date) {
			return reply.code(400).send({ error: `Meal date must be YYYY-MM-DD: ${meal.date}` });
		}
		if (!isWithinWeek(date, weekStart)) {
			return reply.code(400).send({ error: `Meal date is outside selected week: ${meal.date}` });
		}
		meals.push({ ...meal, date });
	}

	const seenSlots = new Set<string>();
	for (const meal of meals) {
		const key = `${formatDateOnly(meal.date)}:${meal.slot}`;
		if (seenSlots.has(key)) {
			return reply.code(400).send({ error: `Duplicate slot for date ${formatDateOnly(meal.date)}` });
		}
		seenSlots.add(key);
	}

	const userId = req.user.sub as string;
	const recipeIds = [...new Set(meals.map((meal) => meal.recipeId))];

	if (recipeIds.length > 0) {
		const recipes = await prisma.recipe.findMany({
			where: { userId, id: { in: recipeIds } },
			select: { id: true },
		});
		if (recipes.length !== recipeIds.length) {
			return reply.code(400).send({ error: 'One or more recipes were not found for this user' });
		}
	}

	const savedPlan = await prisma.$transaction(async (tx) => {
		const existing = await tx.mealPlan.findFirst({
			where: { userId, weekStart },
			select: { id: true },
		});

		const planId =
			existing?.id ??
			(
				await tx.mealPlan.create({
					data: { userId, weekStart },
					select: { id: true },
				})
			).id;

		await tx.plannedMeal.deleteMany({ where: { planId } });

		if (meals.length > 0) {
			await tx.plannedMeal.createMany({
				data: meals.map((meal) => ({
					planId,
					date: meal.date,
					slot: meal.slot,
					recipeId: meal.recipeId,
				})),
			});
		}

		return tx.mealPlan.findUniqueOrThrow({
			where: { id: planId },
			include: {
				meals: {
					include: {
						recipe: { select: { id: true, name: true } },
					},
				},
			},
		});
	});

	const savedMeals = savedPlan.meals
		.map((meal) => ({
			date: formatDateOnly(meal.date),
			slot: meal.slot,
			recipeId: meal.recipe.id,
			recipeName: meal.recipe.name,
		}))
		.sort((a, b) => {
			const dateCompare = a.date.localeCompare(b.date);
			if (dateCompare !== 0) return dateCompare;
			return slotRank(a.slot) - slotRank(b.slot);
		});

	return {
		id: savedPlan.id,
		weekStart: formatDateOnly(savedPlan.weekStart),
		meals: savedMeals,
	};
});

app.post('/admin/bootstrap-self', { preHandler: (app as any).authenticate }, async (req: any, reply) => {
	const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
	if (adminCount > 0) {
		return reply.code(409).send({ error: 'An admin already exists' });
	}

	const userId = req.user.sub as string;

	const updated = await prisma.user.update({
		where: { id: userId },
		data: { role: 'ADMIN' },
		select: { id: true, email: true, role: true, createdAt: true },
	});

	return updated;
});

app.get('/admin/users', { preHandler: [(app as any).authenticate, requireAdmin] }, async () => {
	return prisma.user.findMany({
		orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
		select: { id: true, email: true, role: true, createdAt: true },
	});
});

app.patch(
	'/admin/users/:id/role',
	{ preHandler: [(app as any).authenticate, requireAdmin] },
	async (req, reply) => {
		const Params = z.object({ id: z.string().min(1) });
		const Body = z.object({ role: z.enum(['USER', 'ADMIN']) });

		const { id } = Params.parse(req.params);
		const body = Body.parse(req.body);

		const target = await prisma.user.findUnique({
			where: { id },
			select: { id: true, role: true },
		});

		if (!target) {
			return reply.code(404).send({ error: 'User not found' });
		}

		if (target.role === 'ADMIN' && body.role === 'USER') {
			const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
			if (adminCount <= 1) {
				return reply.code(409).send({ error: 'Cannot remove admin role from the last admin' });
			}
		}

		return prisma.user.update({
			where: { id },
			data: { role: body.role },
			select: { id: true, email: true, role: true, createdAt: true },
		});
	}
);

app.post('/auth/register', async (req, reply) => {
	const Body = z.object({
		email: z.string().email(),
		password: z.string().min(8),
	});
	const body = Body.parse(req.body);

	const existing = await prisma.user.findUnique({ where: { email: body.email } });
	if (existing) return reply.code(409).send({ error: 'Email already in use' });

	const hash = await bcrypt.hash(body.password, 12);

	const user = await prisma.user.create({
		data: { email: body.email, password: hash, role: 'USER' },
		select: { id: true, email: true, role: true },
	});

	return user;
});

app.post('/auth/login', async (req, reply) => {
	const Body = z.object({
		email: z.string().email(),
		password: z.string().min(1),
	});
	const body = Body.parse(req.body);

	const user = await prisma.user.findUnique({ where: { email: body.email } });
	if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

	const ok = await bcrypt.compare(body.password, user.password);
	if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });

	const token = app.jwt.sign({ sub: user.id, role: user.role });
	return { token };
});

app.get('/me', { preHandler: (app as any).authenticate }, async (req: any) => {
	const userId = req.user.sub as string;
	return prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, email: true, role: true, createdAt: true },
	});
});

app.listen({ port: 3001, host: '0.0.0.0' }).then(() => {
	console.log('API running on http://localhost:3001');
});
