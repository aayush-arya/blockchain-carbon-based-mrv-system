import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { db } from '../db/client';
import type { UserRole } from '../db/types';
import { signAccessToken } from '../middleware/auth';
import { ConflictError, UnauthorizedError } from '../utils/errors';
import { parseDurationMs } from '../utils/duration';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

function toPublicUser(user: {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id: string | null;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    organizationId: user.organization_id,
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function issueTokenPair(user: PublicUser): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, organizationId: user.organizationId });

  const refreshToken = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + parseDurationMs(env.REFRESH_TOKEN_EXPIRES_IN));

  await db
    .insertInto('refresh_tokens')
    .values({ user_id: user.id, token_hash: hashToken(refreshToken), expires_at: expiresAt })
    .execute();

  return { accessToken, refreshToken, expiresIn: env.JWT_EXPIRES_IN };
}

/**
 * Public self-registration always creates a field_operator — validator/admin accounts are
 * provisioned separately (seed data or by an existing admin), never via open sign-up.
 */
export async function registerUser(input: {
  email: string;
  password: string;
  fullName: string;
  organizationId?: string;
}): Promise<{ user: PublicUser; tokens: TokenPair }> {
  const existing = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', input.email)
    .executeTakeFirst();
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  const row = await db
    .insertInto('users')
    .values({
      email: input.email,
      password_hash: passwordHash,
      full_name: input.fullName,
      role: 'field_operator',
      organization_id: input.organizationId ?? null,
    })
    .returning(['id', 'email', 'full_name', 'role', 'organization_id'])
    .executeTakeFirstOrThrow();

  const user = toPublicUser(row);
  const tokens = await issueTokenPair(user);
  return { user, tokens };
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<{ user: PublicUser; tokens: TokenPair }> {
  const row = await db
    .selectFrom('users')
    .select(['id', 'email', 'full_name', 'role', 'organization_id', 'password_hash', 'is_active'])
    .where('email', '=', input.email)
    .executeTakeFirst();

  if (!row || !row.is_active) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(input.password, row.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await db.updateTable('users').set({ last_login_at: new Date() }).where('id', '=', row.id).execute();

  const user = toPublicUser(row);
  const tokens = await issueTokenPair(user);
  return { user, tokens };
}

export async function refreshTokens(refreshToken: string): Promise<{ user: PublicUser; tokens: TokenPair }> {
  const tokenHash = hashToken(refreshToken);

  const stored = await db
    .selectFrom('refresh_tokens')
    .select(['id', 'user_id', 'expires_at', 'revoked_at'])
    .where('token_hash', '=', tokenHash)
    .executeTakeFirst();

  if (!stored || stored.revoked_at || stored.expires_at < new Date()) {
    throw new UnauthorizedError('Refresh token is invalid or expired');
  }

  const userRow = await db
    .selectFrom('users')
    .select(['id', 'email', 'full_name', 'role', 'organization_id', 'is_active'])
    .where('id', '=', stored.user_id)
    .executeTakeFirst();

  if (!userRow || !userRow.is_active) {
    throw new UnauthorizedError('Account is no longer active');
  }

  // Rotate: revoke the used token and issue a fresh pair, so a stolen refresh token can only
  // be replayed once before the legitimate user's next refresh invalidates it.
  await db
    .updateTable('refresh_tokens')
    .set({ revoked_at: new Date() })
    .where('id', '=', stored.id)
    .execute();

  const user = toPublicUser(userRow);
  const tokens = await issueTokenPair(user);
  return { user, tokens };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await db
    .updateTable('refresh_tokens')
    .set({ revoked_at: new Date() })
    .where('token_hash', '=', hashToken(refreshToken))
    .where('revoked_at', 'is', null)
    .execute();
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const row = await db
    .selectFrom('users')
    .select(['id', 'email', 'full_name', 'role', 'organization_id'])
    .where('id', '=', id)
    .executeTakeFirst();
  return row ? toPublicUser(row) : null;
}
