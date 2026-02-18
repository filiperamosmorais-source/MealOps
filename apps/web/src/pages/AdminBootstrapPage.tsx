import { useMutation } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/context';
import { ApiError, apiFetch } from '../lib/api';

type BootstrapResponse = {
	id: string;
	email: string;
	role: 'ADMIN';
	createdAt: string;
};

async function bootstrapSelf(): Promise<BootstrapResponse> {
	return apiFetch<BootstrapResponse>('/admin/bootstrap-self', {
		method: 'POST',
	});
}

export default function AdminBootstrapPage() {
	const navigate = useNavigate();
	const { isLoading, isAdmin, refreshUser } = useAuth();

	const mutation = useMutation({
		mutationFn: bootstrapSelf,
		onSuccess: async () => {
			await refreshUser();
			navigate('/admin/users', { replace: true });
		},
	});

	if (isLoading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
				<CircularProgress />
			</Box>
		);
	}

	if (isAdmin) {
		return <Navigate to="/admin/users" replace />;
	}

	return (
		<Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 4, md: 8 } }}>
			<Card sx={{ width: '100%', maxWidth: 560 }} variant="outlined">
				<CardContent>
					<Stack spacing={2}>
						<Typography variant="h5">Admin Setup</Typography>
						<Typography variant="body2" color="text.secondary">
							Use this one-time action only when your app has no admins yet.
						</Typography>

						{mutation.isError ? (
							<Alert severity="error">
								{mutation.error instanceof ApiError && mutation.error.status === 409
									? 'An admin already exists. Ask an admin to grant your account access.'
									: String(mutation.error)}
							</Alert>
						) : null}

						<Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
							{mutation.isPending ? 'Setting up...' : 'Make me the first admin'}
						</Button>
					</Stack>
				</CardContent>
			</Card>
		</Box>
	);
}
