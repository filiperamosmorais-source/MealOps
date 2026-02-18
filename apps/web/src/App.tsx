import { Navigate, Route, Routes, Link as RouterLink } from 'react-router-dom';
import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';

import AdminRoute from './auth/AdminRoute';
import { useAuth } from './auth/context';
import ProtectedRoute from './auth/ProtectedRoute';
import AdminBootstrapPage from './pages/AdminBootstrapPage';
import AdminIngredientsPage from './pages/AdminIngredientsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RecipeCreate from './pages/RecipeCreate';
import RecipesList from './pages/RecipesList';
import WeeklyMealPlanPage from './pages/WeeklyMealPlanPage';

export default function App() {
	const { isAuthenticated, isLoading, user, logout, isAdmin } = useAuth();

	const homePath = isAuthenticated ? '/recipes' : '/login';

	return (
		<Box sx={{ minHeight: '100vh' }}>
			<AppBar position="static">
				<Toolbar sx={{ gap: 2 }}>
					<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
						MealOps
					</Typography>

					{isAuthenticated ? (
						<>
							<Button color="inherit" component={RouterLink} to="/recipes">
								Recipes
							</Button>
							<Button color="inherit" component={RouterLink} to="/recipes/new">
								New Recipe
							</Button>
							<Button color="inherit" component={RouterLink} to="/meal-planner">
								Meal Planner
							</Button>
							{isAdmin ? (
								<>
									<Button color="inherit" component={RouterLink} to="/admin/ingredients">
										Ingredients Admin
									</Button>
									<Button color="inherit" component={RouterLink} to="/admin/users">
										Manage Admins
									</Button>
								</>
							) : (
								<Button color="inherit" component={RouterLink} to="/admin/bootstrap">
									Admin Setup
								</Button>
							)}
							<Typography variant="body2" sx={{ ml: 1 }}>
								{user?.email}
							</Typography>
							<Button color="inherit" onClick={logout}>
								Logout
							</Button>
						</>
					) : (
						<>
							<Button color="inherit" component={RouterLink} to="/login" disabled={isLoading}>
								Login
							</Button>
							<Button color="inherit" component={RouterLink} to="/register" disabled={isLoading}>
								Sign up
							</Button>
						</>
					)}
				</Toolbar>
			</AppBar>

			<Container sx={{ py: 3 }}>
				<Routes>
					<Route path="/" element={<Navigate to={homePath} replace />} />
					<Route path="/login" element={<LoginPage />} />
					<Route path="/register" element={<RegisterPage />} />
					<Route
						path="/recipes"
						element={
							<ProtectedRoute>
								<RecipesList />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/recipes/new"
						element={
							<ProtectedRoute>
								<RecipeCreate />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/meal-planner"
						element={
							<ProtectedRoute>
								<WeeklyMealPlanPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/admin/bootstrap"
						element={
							<ProtectedRoute>
								<AdminBootstrapPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/admin/ingredients"
						element={
							<AdminRoute>
								<AdminIngredientsPage />
							</AdminRoute>
						}
					/>
					<Route
						path="/admin/users"
						element={
							<AdminRoute>
								<AdminUsersPage />
							</AdminRoute>
						}
					/>
					<Route
						path="*"
						element={
							<Box>
								<Typography variant="h6" gutterBottom>
									Not found
								</Typography>
								<Button color="primary" component={RouterLink} to={homePath}>
									Go to Home
								</Button>
							</Box>
						}
					/>
				</Routes>
			</Container>
		</Box>
	);
}
