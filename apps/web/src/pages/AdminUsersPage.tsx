import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	Alert,
	Box,
	Button,
	Card,
	CircularProgress,
	Chip,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
} from '@mui/material';

import { useAuth } from '../auth/context';
import { ApiError, apiFetch } from '../lib/api';

type UserRow = {
	id: string;
	email: string;
	role: 'USER' | 'ADMIN';
	createdAt: string;
};

async function fetchUsers(): Promise<UserRow[]> {
	return apiFetch<UserRow[]>('/admin/users');
}

async function updateRole({ id, role }: { id: string; role: 'USER' | 'ADMIN' }): Promise<UserRow> {
	return apiFetch<UserRow>(`/admin/users/${id}/role`, {
		method: 'PATCH',
		body: JSON.stringify({ role }),
	});
}

export default function AdminUsersPage() {
	const qc = useQueryClient();
	const { user, refreshUser } = useAuth();

	const usersQuery = useQuery({
		queryKey: ['admin-users'],
		queryFn: fetchUsers,
	});

	const roleMutation = useMutation({
		mutationFn: updateRole,
		onSuccess: async () => {
			await qc.invalidateQueries({ queryKey: ['admin-users'] });
			await refreshUser();
		},
	});

	const setRole = (row: UserRow, role: 'USER' | 'ADMIN') => {
		if (row.role === role) return;

		const actionLabel = role === 'ADMIN' ? 'grant admin access to' : 'remove admin access from';
		const confirmed = window.confirm(`Are you sure you want to ${actionLabel} ${row.email}?`);
		if (!confirmed) return;

		roleMutation.mutate({ id: row.id, role });
	};

	return (
		<Stack spacing={2}>
			<Typography variant="h5">Admin: Manage Admins</Typography>
			<Typography variant="body2" color="text.secondary">
				Promote users to ADMIN or remove admin access.
			</Typography>

			{usersQuery.isLoading ? (
				<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
					<CircularProgress />
				</Box>
			) : usersQuery.error ? (
				<Alert severity="error">{String(usersQuery.error)}</Alert>
			) : (
				<TableContainer component={Card} variant="outlined">
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>Email</TableCell>
								<TableCell>Role</TableCell>
								<TableCell>Created</TableCell>
								<TableCell align="right">Actions</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{(usersQuery.data ?? []).map((row) => {
								const isSelf = row.id === user?.id;
								return (
									<TableRow key={row.id}>
										<TableCell>{row.email}</TableCell>
										<TableCell>
											<Chip
												size="small"
												label={row.role}
												color={row.role === 'ADMIN' ? 'primary' : 'default'}
											/>
										</TableCell>
										<TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
										<TableCell align="right">
											{row.role === 'USER' ? (
												<Button
													size="small"
													variant="contained"
													onClick={() => setRole(row, 'ADMIN')}
													disabled={roleMutation.isPending}
												>
													Make admin
												</Button>
											) : (
												<Button
													size="small"
													color="warning"
													variant="outlined"
													onClick={() => setRole(row, 'USER')}
													disabled={roleMutation.isPending}
												>
													{isSelf ? 'Remove my admin' : 'Remove admin'}
												</Button>
											)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</TableContainer>
			)}

			{roleMutation.isError ? (
				<Alert severity="error">
					{roleMutation.error instanceof ApiError && roleMutation.error.status === 409
						? 'Cannot remove admin role from the last admin.'
						: String(roleMutation.error)}
				</Alert>
			) : null}
		</Stack>
	);
}
