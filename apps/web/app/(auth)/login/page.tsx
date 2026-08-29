'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [quickLoginRole, setQuickLoginRole] = useState<'validator' | 'admin' | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function quickLogin(role: 'validator' | 'admin') {
    setError(null);
    setQuickLoginRole(role);
    const credentials =
      role === 'validator'
        ? { email: 'validator@bluecarbon.dev', password: 'validator123' }
        : { email: 'admin@bluecarbon.dev', password: 'admin12345' };
    try {
      await login(credentials.email, credentials.password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setQuickLoginRole(null);
    }
  }

  return (
    <div className="animate-slide-up">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Sign in to continue to the MRV registry.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@organization.org"
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        {error && (
          <p className="rounded border border-status-danger/30 bg-status-danger-bg px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        New field operator?{' '}
        <Link href="/register" className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-border bg-surface-sunken p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Demo accounts</p>
        <p className="mt-1 text-xs text-ink-faint">
          Validator/admin accounts aren&apos;t open for self-registration (see &quot;Create an
          account&quot; above) - these seeded accounts let you explore those roles directly.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => quickLogin('validator')}
            disabled={quickLoginRole !== null}
            className="flex items-center justify-between rounded border border-border bg-surface-raised px-3 py-2.5 text-left transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>
              <span className="block text-sm font-medium text-ink">Continue as Validator</span>
              <span className="block font-mono text-xs text-ink-faint">validator@bluecarbon.dev</span>
            </span>
            {quickLoginRole === 'validator' ? (
              <svg className="h-4 w-4 animate-spin text-ink-faint" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-medium text-status-warning">
                validator
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => quickLogin('admin')}
            disabled={quickLoginRole !== null}
            className="flex items-center justify-between rounded border border-border bg-surface-raised px-3 py-2.5 text-left transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>
              <span className="block text-sm font-medium text-ink">Continue as Admin</span>
              <span className="block font-mono text-xs text-ink-faint">admin@bluecarbon.dev</span>
            </span>
            {quickLoginRole === 'admin' ? (
              <svg className="h-4 w-4 animate-spin text-ink-faint" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-[10px] font-medium text-status-info">
                admin
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
