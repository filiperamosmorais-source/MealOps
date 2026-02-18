const API_BASE = 'http://localhost:3001';

export class ApiError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

let tokenGetter: (() => string | null) | null = null;

export function registerTokenGetter(getter: () => string | null): void {
	tokenGetter = getter;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const headers = new Headers(init?.headers ?? {});
	const token = tokenGetter?.();

	if (token && !headers.has('Authorization')) {
		headers.set('Authorization', `Bearer ${token}`);
	}

	if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	const response = await fetch(`${API_BASE}${path}`, {
		...init,
		headers,
	});

	if (!response.ok) {
		const text = await response.text().catch(() => '');
		throw new ApiError(text || response.statusText || 'Request failed', response.status);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return response.json() as Promise<T>;
}
