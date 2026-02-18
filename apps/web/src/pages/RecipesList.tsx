import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';

import { apiFetch } from '../lib/api';

type Nutrition = { kcal: number; protein: number; carbs: number; fat: number };

type RecipeListItem = {
	id: string;
	name: string;
	servings: number;
	notes?: string | null;
	createdAt: string;
	nutrition: {
		total: Nutrition;
		perServing: Nutrition;
	};
};

async function fetchRecipes(): Promise<RecipeListItem[]> {
	return apiFetch<RecipeListItem[]>('/recipes');
}

export default function RecipesList() {
	const { data, isLoading, error } = useQuery({
		queryKey: ['recipes'],
		queryFn: fetchRecipes,
	});

	if (isLoading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
				<CircularProgress />
			</Box>
		);
	}

	if (error) {
		return <Alert severity="error">{String(error)}</Alert>;
	}

	if (!data?.length) {
		return <Alert severity="info">No recipes yet. Create one.</Alert>;
	}

	return (
		<Stack spacing={2}>
			<Typography variant="h5">Recipes</Typography>

			{data.map((r) => (
				<Card key={r.id} variant="outlined">
					<CardContent>
						<Stack spacing={1}>
							<Typography variant="h6">{r.name}</Typography>
							<Typography variant="body2" color="text.secondary">
								Servings: {r.servings} - Created: {new Date(r.createdAt).toLocaleString()}
							</Typography>
							{r.notes ? (
								<Box>
									<Typography variant="subtitle2">Description</Typography>
									<Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
										{r.notes}
									</Typography>
								</Box>
							) : null}

							<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
								<Box>
									<Typography variant="subtitle2">Total</Typography>
									<Typography variant="body2">
										{k(r.nutrition.total.kcal)} kcal - P {k(r.nutrition.total.protein)} - C{' '}
										{k(r.nutrition.total.carbs)} - F {k(r.nutrition.total.fat)}
									</Typography>
								</Box>

								<Box>
									<Typography variant="subtitle2">Per serving</Typography>
									<Typography variant="body2">
										{k(r.nutrition.perServing.kcal)} kcal - P {k(r.nutrition.perServing.protein)}
										- C {k(r.nutrition.perServing.carbs)} - F {k(r.nutrition.perServing.fat)}
									</Typography>
								</Box>
							</Stack>
						</Stack>
					</CardContent>
				</Card>
			))}
		</Stack>
	);
}

function k(n: number) {
	return Math.round(n * 10) / 10;
}
