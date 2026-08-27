import bcrypt from 'bcryptjs';
import { env } from '../src/config/env';
import { closeDatabaseConnection, db } from '../src/db/client';
import type { UserRole } from '../src/db/types';

/**
 * Creates the validator and admin accounts that public self-registration deliberately
 * never creates (see authService.registerUser). Safe to re-run: existing accounts are
 * left untouched.
 */
const SEED_ACCOUNTS: { email: string; password: string; fullName: string; role: UserRole }[] = [
  { email: 'validator@bluecarbon.dev', password: 'validator123', fullName: 'Priya Nair', role: 'validator' },
  { email: 'admin@bluecarbon.dev', password: 'admin12345', fullName: 'System Admin', role: 'admin' },
];

async function seed(): Promise<void> {
  for (const account of SEED_ACCOUNTS) {
    const existing = await db.selectFrom('users').select('id').where('email', '=', account.email).executeTakeFirst();
    if (existing) {
      // eslint-disable-next-line no-console
      console.log(`skip  ${account.email} (already exists)`);
      continue;
    }

    const passwordHash = await bcrypt.hash(account.password, env.BCRYPT_SALT_ROUNDS);
    await db
      .insertInto('users')
      .values({
        email: account.email,
        password_hash: passwordHash,
        full_name: account.fullName,
        role: account.role,
        organization_id: null,
      })
      .execute();
    // eslint-disable-next-line no-console
    console.log(`created ${account.role.padEnd(9)} ${account.email} / ${account.password}`);
  }
}

seed()
  .then(() => closeDatabaseConnection())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    await closeDatabaseConnection();
    process.exitCode = 1;
  });
