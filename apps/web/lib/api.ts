const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const TOKEN_STORAGE_KEY = 'bcm.tokens';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export function getStoredTokens(): StoredTokens | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: StoredTokens | null): void {
  if (typeof window === 'undefined') return;
  if (tokens) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

let refreshPromise: Promise<StoredTokens | null> | null = null;

async function refreshTokens(): Promise<StoredTokens | null> {
  const current = getStoredTokens();
  if (!current) return null;

  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (!res.ok) {
    setStoredTokens(null);
    return null;
  }
  const body = await res.json();
  const tokens: StoredTokens = { accessToken: body.tokens.accessToken, refreshToken: body.tokens.refreshToken };
  setStoredTokens(tokens);
  return tokens;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
  body?: BodyInit;
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { json, skipAuth, headers, ...rest } = options;
  const tokens = skipAuth ? null : getStoredTokens();

  const finalHeaders = new Headers(headers);
  if (json !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (tokens?.accessToken) {
    finalHeaders.set('Authorization', `Bearer ${tokens.accessToken}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (res.status === 401 && !skipAuth && !isRetry) {
    const refreshed = await (refreshPromise ??= refreshTokens().finally(() => {
      refreshPromise = null;
    }));
    if (refreshed) {
      return request<T>(path, options, true);
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = payload?.error?.message ?? res.statusText;
    throw new ApiError(res.status, payload?.error?.code ?? 'UNKNOWN', message, payload?.error?.details);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', json }),
  patch: <T>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', json }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
  postForm: <T>(path: string, formData: FormData, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body: formData }),
};

export { API_BASE_URL };
