import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	CircularProgress,
	Divider,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../lib/api';

type Ingredient = {
	id: string;
	name: string;
	kcalPer100g: number;
	proteinPer100g: number;
	carbsPer100g: number;
	fatPer100g: number;
};

type RecipeItemInput = { ingredientId: string; quantityG: number };

type CreateRecipePayload = {
	name: string;
	servings: number;
	notes?: string;
	items: RecipeItemInput[];
};

async function fetchIngredients(): Promise<Ingredient[]> {
	return apiFetch<Ingredient[]>('/ingredients');
}

async function createRecipe(payload: CreateRecipePayload) {
	return apiFetch('/recipes', {
		method: 'POST',
		body: JSON.stringify(payload),
	});
}

export default function RecipeCreate() {
	const qc = useQueryClient();
	const nav = useNavigate();

	const { data: ingredients, isLoading, error } = useQuery({
		queryKey: ['ingredients'],
		queryFn: fetchIngredients,
	});

	const [name, setName] = useState('');
	const [servings, setServings] = useState<number>(2);
	const [description, setDescription] = useState('');
	const [selectedIngredientId, setSelectedIngredientId] = useState('');
	const [quantityG, setQuantityG] = useState<number>(100);
	const [items, setItems] = useState<RecipeItemInput[]>([]);

	const ingredientById = useMemo(() => {
		return new Map((ingredients ?? []).map((i) => [i.id, i]));
	}, [ingredients]);

	const mutation = useMutation({
		mutationFn: createRecipe,
		onSuccess: async () => {
			await qc.invalidateQueries({ queryKey: ['recipes'] });
			nav('/recipes');
		},
	});

	const addItem = () => {
		if (!selectedIngredientId) return;
		if (!quantityG || quantityG <= 0) return;

		setItems((prev) => {
			const existing = prev.find((x) => x.ingredientId === selectedIngredientId);
			if (existing) {
				return prev.map((x) =>
					x.ingredientId === selectedIngredientId
						? { ...x, quantityG: x.quantityG + quantityG }
						: x
				);
			}
			return [...prev, { ingredientId: selectedIngredientId, quantityG }];
		});
	};

	const removeItem = (ingredientId: string) => {
		setItems((prev) => prev.filter((x) => x.ingredientId !== ingredientId));
	};

	const submit = () => {
		if (!name.trim()) return;
		if (!servings || servings < 1) return;
		if (items.length === 0) return;

		mutation.mutate({
			name: name.trim(),
			servings,
			notes: description.trim() || undefined,
			items,
		});
	};

	return (
		<Stack spacing={2}>
			<Typography variant="h5">New Recipe</Typography>

			{isLoading && (
				<Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
					<CircularProgress />
				</Box>
			)}

			{error && <Alert severity="error">{String(error)}</Alert>}

			<Card variant="outlined">
				<CardContent>
					<Stack spacing={2}>
						<TextField
							label="Recipe name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							fullWidth
						/>

						<TextField
							label="Servings"
							type="number"
							value={servings}
							onChange={(e) => setServings(Number(e.target.value))}
							inputProps={{ min: 1 }}
							sx={{ width: 180 }}
						/>
						<TextField
							label="How to make it (optional)"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							multiline
							minRows={4}
							fullWidth
						/>

						<Divider />

						<Typography variant="subtitle1">Add ingredient</Typography>

						<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
							<FormControl sx={{ minWidth: 260 }}>
								<InputLabel id="ingredient-select-label">Ingredient</InputLabel>
								<Select
									labelId="ingredient-select-label"
									label="Ingredient"
									value={selectedIngredientId}
									onChange={(e) => setSelectedIngredientId(String(e.target.value))}
								>
									{(ingredients ?? []).map((i) => (
										<MenuItem key={i.id} value={i.id}>
											{i.name}
										</MenuItem>
									))}
								</Select>
							</FormControl>

							<TextField
								label="Quantity (g)"
								type="number"
								value={quantityG}
								onChange={(e) => setQuantityG(Number(e.target.value))}
								inputProps={{ min: 1 }}
								sx={{ width: 180 }}
							/>

							<Button
								variant="contained"
								onClick={addItem}
								disabled={!selectedIngredientId || quantityG <= 0}
							>
								Add
							</Button>
						</Stack>

						{items.length === 0 ? (
							<Alert severity="info">Add at least one ingredient.</Alert>
						) : (
							<Stack spacing={1}>
								<Typography variant="subtitle2">Items</Typography>
								{items.map((it) => {
									const ing = ingredientById.get(it.ingredientId);
									return (
										<Box
											key={it.ingredientId}
											sx={{
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'space-between',
												gap: 2,
												p: 1,
												border: '1px solid',
												borderColor: 'divider',
												borderRadius: 1,
											}}
										>
											<Box>
												<Typography variant="body1">{ing?.name ?? it.ingredientId}</Typography>
												<Typography variant="body2" color="text.secondary">
													{it.quantityG} g
												</Typography>
											</Box>

											<Button color="error" onClick={() => removeItem(it.ingredientId)}>
												Remove
											</Button>
										</Box>
									);
								})}
							</Stack>
						)}

						<Divider />

						{mutation.isError && <Alert severity="error">{String(mutation.error)}</Alert>}

						<Stack direction="row" spacing={2} justifyContent="flex-end">
							<Button variant="outlined" onClick={() => nav('/recipes')}>
								Cancel
							</Button>
							<Button
								variant="contained"
								onClick={submit}
								disabled={mutation.isPending || !name.trim() || servings < 1 || items.length === 0}
							>
								{mutation.isPending ? 'Creating...' : 'Create recipe'}
							</Button>
						</Stack>
					</Stack>
				</CardContent>
			</Card>
		</Stack>
	);
}
