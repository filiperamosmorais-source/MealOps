import 'dotenv/config';
import Fastify from 'fastify';
import { z } from 'zod';
import { prisma } from './db.js';
import { add, roundNutrition } from './nutrition.js';
import cors from '@fastify/cors';

const app = Fastify();

await app.register(cors, {
  origin: ['http://localhost:5173'],
});

app.get('/health', async () => ({ ok: true }));

app.get('/ingredients', async () => {
	return prisma.ingredient.findMany({ orderBy: { name: 'asc' } });
});

app.post('/recipes', async (req, reply) => {
	const Body = z.object({
		userId: z.string().min(1),
		name: z.string().min(1),
		servings: z.number().int().min(1),
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
				userId: body.userId,
				name: body.name,
				servings: body.servings,
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

app.get('/recipes', async () => {
	const recipes = await prisma.recipe.findMany({
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
			createdAt: r.createdAt,
			nutrition: {
				total: roundNutrition(totals),
				perServing: roundNutrition(perServingTotals),
			},
		};
	});
});

app.listen({ port: 3001, host: '0.0.0.0' }).then(() => {
	console.log('API running on http://localhost:3001');
});
