import { Navigate, Route, Routes, Link as RouterLink } from 'react-router-dom';
import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';

import RecipesList from './pages/RecipesList';
import RecipeCreate from './pages/RecipeCreate';

export default function App() {
	return (
		<Box sx={{ minHeight: '100vh' }}>
			<AppBar position="static">
				<Toolbar sx={{ gap: 2 }}>
					<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
						MealOps
					</Typography>

					<Button color="inherit" component={RouterLink} to="/recipes">
						Recipes
					</Button>
					<Button color="inherit" component={RouterLink} to="/recipes/new">
						New Recipe
					</Button>
				</Toolbar>
			</AppBar>

			<Container sx={{ py: 3 }}>
				<Routes>
					<Route path="/" element={<Navigate to="/recipes" replace />} />
					<Route path="/recipes" element={<RecipesList />} />
					<Route path="/recipes/new" element={<RecipeCreate />} />
					<Route
						path="*"
						element={
							<Box>
								<Typography variant="h6" gutterBottom>
									Not found
								</Typography>
								<Button color="primary" component={RouterLink} to="/recipes">
									Go to Recipes
								</Button>
							</Box>
						}
					/>
				</Routes>
			</Container>
		</Box>
	);
}
