import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

import { useAuth } from './context';

export default function AdminRoute({ children }: { children: ReactNode }) {
	const { isAuthenticated, isLoading, isAdmin } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
				<CircularProgress />
			</Box>
		);
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}

	if (!isAdmin) {
		return <Navigate to="/recipes" replace />;
	}

	return <>{children}</>;
}
