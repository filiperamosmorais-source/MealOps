import { useState } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Link, Stack, TextField, Typography } from '@mui/material';

import { ApiError } from '../lib/api';
import { useAuth } from '../auth/context';

export default function RegisterPage() {
	const { register, isAuthenticated, isLoading } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/recipes';

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [formError, setFormError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	if (!isLoading && isAuthenticated) {
		return <Navigate to={from} replace />;
	}

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setFormError(null);

		if (password !== confirmPassword) {
			setFormError('Passwords do not match.');
			return;
		}

		if (password.length < 8) {
			setFormError('Password must be at least 8 characters.');
			return;
		}

		setSubmitting(true);

		try {
			await register(email.trim(), password);
			navigate(from, { replace: true });
		} catch (error) {
			if (error instanceof ApiError && error.status === 409) {
				setFormError('Email already in use.');
			} else if (error instanceof ApiError && error.status === 400) {
				setFormError('Please check your email and password values.');
			} else if (error instanceof Error) {
				setFormError(error.message);
			} else {
				setFormError('Registration failed.');
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
						<Typography variant="h5">Create account</Typography>
						<Typography variant="body2" color="text.secondary">
							Start building your own meals and weekly plans.
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
							autoComplete="new-password"
							helperText="Minimum 8 characters"
						/>

						<TextField
							label="Confirm password"
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							required
							fullWidth
							autoComplete="new-password"
						/>

						<Button
							type="submit"
							variant="contained"
							disabled={
								submitting || !email.trim() || !password || !confirmPassword
							}
						>
							{submitting ? 'Creating account...' : 'Create account'}
						</Button>

						<Typography variant="body2" textAlign="center">
							Already have an account?{' '}
							<Link component={RouterLink} to="/login">
								Sign in
							</Link>
						</Typography>
					</Stack>
				</CardContent>
			</Card>
		</Box>
	);
}
