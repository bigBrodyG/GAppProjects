import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) {
    console.warn('ADMIN_USER or ADMIN_PASS not set — skipping admin seed');
    return;
  }
  const hash = await bcrypt.hash(pass, 12);
  const exists = await knex('users').where({ role: 'admin', ldap_uid: null }).first();
  if (!exists) {
    await knex('users').insert({
      ldap_uid: null,
      email: null,
      name: user,
      role: 'admin',
      password_hash: hash,
      school_year: '2025-26',
      active: 1,
    });
  } else {
    await knex('users').where({ id: exists.id }).update({ password_hash: hash });
  }
}
