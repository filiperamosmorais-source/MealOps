import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { apiFetch, registerTokenGetter } from '../lib/api';
import { clearStoredToken, getStoredToken, saveStoredToken } from './storage';

export type Role = 'USER' | 'ADMIN';

type AuthUser = {
	id: string;
	email: string;
	role: Role;
	createdAt?: string;
};

type AuthContextValue = {
	token: string | null;
	user: AuthUser | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	isAdmin: boolean;
	login: (email: string, password: string) => Promise<void>;
	register: (email: string, password: string) => Promise<void>;
	refreshUser: () => Promise<void>;
	logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(token: string): Promise<AuthUser> {
	return apiFetch<AuthUser>('/me', {
		headers: { Authorization: `Bearer ${token}` },
	});
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [token, setToken] = useState<string | null>(() => getStoredToken());
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const logout = useCallback(() => {
		clearStoredToken();
		setToken(null);
		setUser(null);
	}, []);

	useEffect(() => {
		registerTokenGetter(() => token);
	}, [token]);

	const refreshUser = useCallback(async () => {
		if (!token) {
			setUser(null);
			return;
		}

		const me = await fetchMe(token);
		setUser(me);
	}, [token]);

	useEffect(() => {
		let isMounted = true;

		const bootstrap = async () => {
			if (!token) {
				if (isMounted) {
					setUser(null);
					setIsLoading(false);
				}
				return;
			}

			try {
				const me = await fetchMe(token);
				if (isMounted) {
					setUser(me);
				}
			} catch {
				if (isMounted) {
					logout();
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		void bootstrap();

		return () => {
			isMounted = false;
		};
	}, [token, logout]);

	const login = useCallback(async (email: string, password: string) => {
		const response = await apiFetch<{ token: string }>('/auth/login', {
			method: 'POST',
			body: JSON.stringify({ email, password }),
		});

		saveStoredToken(response.token);
		setToken(response.token);

		const me = await fetchMe(response.token);
		setUser(me);
	}, []);

	const register = useCallback(
		async (email: string, password: string) => {
			await apiFetch('/auth/register', {
				method: 'POST',
				body: JSON.stringify({ email, password }),
			});

			await login(email, password);
		},
		[login]
	);

	const value = useMemo<AuthContextValue>(
		() => ({
			token,
			user,
			isLoading,
			isAuthenticated: Boolean(token && user),
			isAdmin: user?.role === 'ADMIN',
			login,
			register,
			refreshUser,
			logout,
		}),
		[token, user, isLoading, login, register, refreshUser, logout]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used inside AuthProvider');
	}
	return context;
}
