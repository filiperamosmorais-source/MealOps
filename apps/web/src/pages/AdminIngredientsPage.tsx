import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	CircularProgress,
	IconButton,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Typography,
} from '@mui/material';

import { ApiError, apiFetch } from '../lib/api';

type Ingredient = {
	id: string;
	name: string;
	kcalPer100g: number;
	proteinPer100g: number;
	carbsPer100g: number;
	fatPer100g: number;
};

type IngredientInput = {
	name: string;
	kcalPer100g: number;
	proteinPer100g: number;
	carbsPer100g: number;
	fatPer100g: number;
};

async function fetchIngredients(): Promise<Ingredient[]> {
	return apiFetch<Ingredient[]>('/ingredients');
}

async function createIngredient(payload: IngredientInput): Promise<Ingredient> {
	return apiFetch<Ingredient>('/ingredients', {
		method: 'POST',
		body: JSON.stringify(payload),
	});
}

async function deleteIngredient(id: string): Promise<void> {
	await apiFetch<void>(`/ingredients/${id}`, {
		method: 'DELETE',
	});
}

export default function AdminIngredientsPage() {
	const qc = useQueryClient();
	const [formError, setFormError] = useState<string | null>(null);
	const [name, setName] = useState('');
	const [kcalPer100g, setKcalPer100g] = useState<number>(0);
	const [proteinPer100g, setProteinPer100g] = useState<number>(0);
	const [carbsPer100g, setCarbsPer100g] = useState<number>(0);
	const [fatPer100g, setFatPer100g] = useState<number>(0);

	const { data, isLoading, error } = useQuery({
		queryKey: ['ingredients'],
		queryFn: fetchIngredients,
	});

	const createMutation = useMutation({
		mutationFn: createIngredient,
		onSuccess: async () => {
			await qc.invalidateQueries({ queryKey: ['ingredients'] });
			setName('');
			setKcalPer100g(0);
			setProteinPer100g(0);
			setCarbsPer100g(0);
			setFatPer100g(0);
			setFormError(null);
		},
		onError: (err) => {
			if (err instanceof ApiError && err.status === 409) {
				setFormError('Ingredient name already exists.');
				return;
			}
			setFormError(String(err));
		},
	});

	const deleteMutation = useMutation({
		mutationFn: deleteIngredient,
		onSuccess: async () => {
			await qc.invalidateQueries({ queryKey: ['ingredients'] });
		},
	});

	const submitting = createMutation.isPending;

	const rows = useMemo(() => data ?? [], [data]);

	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setFormError(null);

		if (!name.trim()) {
			setFormError('Name is required.');
			return;
		}

		const values = [kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g];
		if (values.some((value) => Number.isNaN(value) || value < 0)) {
			setFormError('Nutrition values must be numbers >= 0.');
			return;
		}

		createMutation.mutate({
			name: name.trim(),
			kcalPer100g,
			proteinPer100g,
			carbsPer100g,
			fatPer100g,
		});
	};

	const onDelete = (ingredient: Ingredient) => {
		const confirmDelete = window.confirm(`Delete ingredient \"${ingredient.name}\"?`);
		if (!confirmDelete) return;

		deleteMutation.mutate(ingredient.id);
	};

	return (
		<Stack spacing={3}>
			<Typography variant="h5">Admin: Ingredients</Typography>

			<Card variant="outlined">
				<CardContent>
					<Stack component="form" spacing={2} onSubmit={submit}>
						<Typography variant="subtitle1">Create ingredient</Typography>
						{formError ? <Alert severity="error">{formError}</Alert> : null}
						<Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
							<TextField
								label="Name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								fullWidth
							/>
							<TextField
								label="kcal / 100g"
								type="number"
								value={kcalPer100g}
								onChange={(e) => setKcalPer100g(Number(e.target.value))}
								inputProps={{ min: 0, step: '0.1' }}
							/>
							<TextField
								label="Protein / 100g"
								type="number"
								value={proteinPer100g}
								onChange={(e) => setProteinPer100g(Number(e.target.value))}
								inputProps={{ min: 0, step: '0.1' }}
							/>
							<TextField
								label="Carbs / 100g"
								type="number"
								value={carbsPer100g}
								onChange={(e) => setCarbsPer100g(Number(e.target.value))}
								inputProps={{ min: 0, step: '0.1' }}
							/>
							<TextField
								label="Fat / 100g"
								type="number"
								value={fatPer100g}
								onChange={(e) => setFatPer100g(Number(e.target.value))}
								inputProps={{ min: 0, step: '0.1' }}
							/>
						</Stack>
						<Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
							<Button type="submit" variant="contained" disabled={submitting}>
								{submitting ? 'Creating...' : 'Create ingredient'}
							</Button>
						</Box>
					</Stack>
				</CardContent>
			</Card>

			{isLoading ? (
				<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
					<CircularProgress />
				</Box>
			) : error ? (
				<Alert severity="error">{String(error)}</Alert>
			) : (
				<TableContainer component={Card} variant="outlined">
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>Name</TableCell>
								<TableCell align="right">kcal / 100g</TableCell>
								<TableCell align="right">Protein / 100g</TableCell>
								<TableCell align="right">Carbs / 100g</TableCell>
								<TableCell align="right">Fat / 100g</TableCell>
								<TableCell align="right">Actions</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{rows.length === 0 ? (
								<TableRow>
									<TableCell colSpan={6}>
										<Typography variant="body2" color="text.secondary">
											No ingredients yet.
										</Typography>
									</TableCell>
								</TableRow>
							) : (
								rows.map((ingredient) => (
									<TableRow key={ingredient.id}>
										<TableCell>{ingredient.name}</TableCell>
										<TableCell align="right">{n(ingredient.kcalPer100g)}</TableCell>
										<TableCell align="right">{n(ingredient.proteinPer100g)}</TableCell>
										<TableCell align="right">{n(ingredient.carbsPer100g)}</TableCell>
										<TableCell align="right">{n(ingredient.fatPer100g)}</TableCell>
										<TableCell align="right">
											<IconButton
												aria-label={`Delete ${ingredient.name}`}
												color="error"
												onClick={() => onDelete(ingredient)}
												disabled={deleteMutation.isPending}
											>
												<DeleteOutlineIcon />
											</IconButton>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</TableContainer>
			)}

			{deleteMutation.isError ? (
				<Alert severity="error">
					{deleteMutation.error instanceof ApiError && deleteMutation.error.status === 409
						? 'This ingredient is already used in recipes and cannot be deleted.'
						: String(deleteMutation.error)}
				</Alert>
			) : null}
		</Stack>
	);
}

function n(value: number): string {
	return (Math.round(value * 10) / 10).toFixed(1);
}
