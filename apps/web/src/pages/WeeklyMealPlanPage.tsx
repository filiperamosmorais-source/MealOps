import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	CircularProgress,
	FormControl,
	Grid,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	Typography,
} from '@mui/material';

import { apiFetch } from '../lib/api';

const mealSlots = [
	{ key: 'breakfast', label: 'Breakfast' },
	{ key: 'lunch', label: 'Lunch' },
	{ key: 'afternoon_snack', label: 'Afternoon snack' },
	{ key: 'dinner', label: 'Dinner' },
] as const;

type MealSlot = (typeof mealSlots)[number]['key'];
type SelectionState = Record<string, Partial<Record<MealSlot, string>>>;

type RecipeOption = {
	id: string;
	name: string;
};

type MealPlanMeal = {
	date: string;
	slot: MealSlot;
	recipeId: string;
	recipeName: string;
};

type MealPlanResponse = {
	id: string | null;
	weekStart: string;
	meals: MealPlanMeal[];
};

type SaveMealPlanPayload = {
	weekStart: string;
	meals: Array<{
		date: string;
		slot: MealSlot;
		recipeId: string;
	}>;
};

async function fetchRecipes(): Promise<RecipeOption[]> {
	return apiFetch<RecipeOption[]>('/recipes');
}

async function fetchMealPlan(weekStart: string): Promise<MealPlanResponse> {
	return apiFetch<MealPlanResponse>(`/meal-plans?weekStart=${encodeURIComponent(weekStart)}`);
}

async function saveMealPlan(payload: SaveMealPlanPayload): Promise<MealPlanResponse> {
	return apiFetch<MealPlanResponse>('/meal-plans', {
		method: 'PUT',
		body: JSON.stringify(payload),
	});
}

function parseDateOnly(value: string): Date {
	const [year, month, day] = value.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function addDaysUtc(date: Date, days: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

function startOfWeekMonday(date: Date): Date {
	const day = date.getUTCDay();
	const offset = day === 0 ? -6 : 1 - day;
	return addDaysUtc(date, offset);
}

function buildWeekDates(weekStart: string): string[] {
	const start = parseDateOnly(weekStart);
	return Array.from({ length: 7 }, (_, idx) => formatDateOnly(addDaysUtc(start, idx)));
}

function createEmptySelection(weekDates: string[]): SelectionState {
	const next: SelectionState = {};
	for (const date of weekDates) {
		next[date] = {};
	}
	return next;
}

function formatDisplayDate(date: string): string {
	return new Intl.DateTimeFormat(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC',
	}).format(parseDateOnly(date));
}

export default function WeeklyMealPlanPage() {
	const qc = useQueryClient();
	const initialWeekStart = useMemo(() => {
		const today = new Date().toISOString().slice(0, 10);
		return formatDateOnly(startOfWeekMonday(parseDateOnly(today)));
	}, []);

	const [weekStart, setWeekStart] = useState(initialWeekStart);
	const weekDates = useMemo(() => buildWeekDates(weekStart), [weekStart]);
	const [selections, setSelections] = useState<SelectionState>(() => createEmptySelection(weekDates));

	const recipesQuery = useQuery({
		queryKey: ['recipes'],
		queryFn: fetchRecipes,
	});

	const mealPlanQuery = useQuery({
		queryKey: ['meal-plan', weekStart],
		queryFn: () => fetchMealPlan(weekStart),
		refetchOnWindowFocus: false,
	});

	useEffect(() => {
		if (mealPlanQuery.data) {
			const next = createEmptySelection(weekDates);
			for (const meal of mealPlanQuery.data.meals) {
				if (!next[meal.date]) continue;
				next[meal.date][meal.slot] = meal.recipeId;
			}
			setSelections(next);
			return;
		}

		if (!mealPlanQuery.isLoading) {
			setSelections(createEmptySelection(weekDates));
		}
	}, [mealPlanQuery.data, mealPlanQuery.isLoading, weekDates]);

	const saveMutation = useMutation({
		mutationFn: saveMealPlan,
		onSuccess: async (data) => {
			await qc.invalidateQueries({ queryKey: ['meal-plan', data.weekStart] });
		},
	});

	const selectedCount = useMemo(() => {
		let count = 0;
		for (const date of weekDates) {
			const day = selections[date];
			if (!day) continue;
			for (const slot of mealSlots) {
				if (day[slot.key]) count += 1;
			}
		}
		return count;
	}, [selections, weekDates]);

	const save = () => {
		const meals: SaveMealPlanPayload['meals'] = [];
		for (const date of weekDates) {
			const day = selections[date] ?? {};
			for (const slot of mealSlots) {
				const recipeId = day[slot.key];
				if (!recipeId) continue;
				meals.push({ date, slot: slot.key, recipeId });
			}
		}

		saveMutation.mutate({ weekStart, meals });
	};

	const clearWeek = () => {
		setSelections(createEmptySelection(weekDates));
	};

	const onAnyDayChange = (value: string) => {
		if (!value) return;
		const selected = parseDateOnly(value);
		setWeekStart(formatDateOnly(startOfWeekMonday(selected)));
	};

	const setSlotRecipe = (date: string, slot: MealSlot, recipeId: string) => {
		setSelections((prev) => {
			const day = { ...(prev[date] ?? {}) };
			if (recipeId) {
				day[slot] = recipeId;
			} else {
				delete day[slot];
			}
			return { ...prev, [date]: day };
		});
	};

	const isLoading = recipesQuery.isLoading || mealPlanQuery.isLoading;

	if (recipesQuery.error) {
		return <Alert severity="error">{String(recipesQuery.error)}</Alert>;
	}

	if (mealPlanQuery.error) {
		return <Alert severity="error">{String(mealPlanQuery.error)}</Alert>;
	}

	return (
		<Stack spacing={2}>
			<Typography variant="h5">Weekly Meal Planner</Typography>
			<Typography variant="body2" color="text.secondary">
				Select recipes manually for each day. Slots are optional and can be left empty.
			</Typography>

			<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
				<TextField
					label="Any date in week"
					type="date"
					value={weekStart}
					onChange={(e) => onAnyDayChange(e.target.value)}
					slotProps={{ inputLabel: { shrink: true } }}
					sx={{ width: 220 }}
				/>

				<Typography variant="body2" color="text.secondary">
					Week: {formatDisplayDate(weekDates[0])} - {formatDisplayDate(weekDates[6])}
				</Typography>
				<Typography variant="body2" color="text.secondary">
					Selected meals: {selectedCount}
				</Typography>
			</Stack>

			{saveMutation.isError && <Alert severity="error">{String(saveMutation.error)}</Alert>}
			{saveMutation.isSuccess && <Alert severity="success">Meal plan saved.</Alert>}
			{!recipesQuery.data?.length && (
				<Alert severity="info">No recipes found. Create recipes first, then assign them to slots.</Alert>
			)}

			{isLoading ? (
				<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
					<CircularProgress />
				</Box>
			) : (
				<Grid container spacing={2}>
					{weekDates.map((date) => (
						<Grid key={date} size={{ xs: 12, md: 6, lg: 4 }}>
							<Card variant="outlined">
								<CardContent>
									<Stack spacing={1.5}>
										<Typography variant="subtitle1">{formatDisplayDate(date)}</Typography>
										{mealSlots.map((slot) => (
											<FormControl key={slot.key} fullWidth size="small">
												<InputLabel id={`${date}-${slot.key}-label`}>{slot.label}</InputLabel>
												<Select
													labelId={`${date}-${slot.key}-label`}
													label={slot.label}
													value={selections[date]?.[slot.key] ?? ''}
													onChange={(e) => setSlotRecipe(date, slot.key, String(e.target.value))}
												>
													<MenuItem value="">
														<em>None</em>
													</MenuItem>
													{(recipesQuery.data ?? []).map((recipe) => (
														<MenuItem key={recipe.id} value={recipe.id}>
															{recipe.name}
														</MenuItem>
													))}
												</Select>
											</FormControl>
										))}
									</Stack>
								</CardContent>
							</Card>
						</Grid>
					))}
				</Grid>
			)}

			<Stack direction="row" spacing={2} justifyContent="flex-end">
				<Button variant="outlined" onClick={clearWeek} disabled={saveMutation.isPending || isLoading}>
					Clear week
				</Button>
				<Button variant="contained" onClick={save} disabled={saveMutation.isPending || isLoading}>
					{saveMutation.isPending ? 'Saving...' : 'Save plan'}
				</Button>
			</Stack>
		</Stack>
	);
}
