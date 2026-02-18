import { useState } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Link, Stack, TextField, Typography } from '@mui/material';

import { ApiError } from '../lib/api';
import { useAuth } from '../auth/context';

export default function LoginPage() {
	const { login, isAuthenticated, isLoading } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/recipes';

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [formError, setFormError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	if (!isLoading && isAuthenticated) {
		return <Navigate to={from} replace />;
	}

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setFormError(null);
		setSubmitting(true);

		try {
			await login(email.trim(), password);
			navigate(from, { replace: true });
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				setFormError('Invalid email or password.');
			} else if (error instanceof Error) {
				setFormError(error.message);
			} else {
				setFormError('Login failed.');
			}
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 4, md: 8 } }}>
			<Card sx={{ width: '100%', maxWidth: 460 }} variant="outlined">
				<CardContent>
					<Stack component="form" spacing={2} onSubmit={onSubmit}>
						<Typography variant="h5">Sign in</Typography>
						<Typography variant="body2" color="text.secondary">
							Log in to manage your meals and weekly plans.
						</Typography>

						{formError ? <Alert severity="error">{formError}</Alert> : null}

						<TextField
							label="Email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							fullWidth
							autoComplete="email"
						/>

						<TextField
							label="Password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							fullWidth
							autoComplete="current-password"
						/>

						<Button
							type="submit"
							variant="contained"
							disabled={submitting || !email.trim() || !password}
						>
							{submitting ? 'Signing in...' : 'Sign in'}
						</Button>

						<Typography variant="body2" textAlign="center">
							No account yet?{' '}
							<Link component={RouterLink} to="/register">
								Create one
							</Link>
						</Typography>
					</Stack>
				</CardContent>
			</Card>
		</Box>
	);
}
