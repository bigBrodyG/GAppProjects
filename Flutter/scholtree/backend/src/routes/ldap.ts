import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import ldap from 'ldapjs';
import db from '../db';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/require-role';
import { createLdapClient } from '../services/ldap.service';
import { isLdapReachable } from '../services/health';
import { LDAP_BASE_DN, NTLM_USER, NTLM_PASS } from '../config';

const router = Router();

const syncLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 1, message: { error: 'sync rate limit exceeded' } });

const searchOpts: ldap.SearchOptions = {
  scope: 'sub',
  filter: '(objectClass=user)',
  attributes: ['sAMAccountName', 'displayName', 'mail', 'memberOf', 'department', 'userAccountControl'],
};

async function searchOu(client: ldap.Client, ou: string): Promise<ldap.SearchEntry[]> {
  return new Promise<ldap.SearchEntry[]>((resolve, reject) => {
    const entries: ldap.SearchEntry[] = [];
    client.search(ou, searchOpts, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', (e) => entries.push(e));
      res.on('error', reject);
      res.on('end', () => resolve(entries));
    });
  });
}

async function performLdapSync(client: ldap.Client): Promise<{ imported: number; teachers: number; students: number; staff: number }> {
  const startedAt = new Date();

  const ous: Array<{ ou: string; role: string }> = [
    { ou: `OU=Utenti_Docenti,${LDAP_BASE_DN}`, role: 'teacher' },
    { ou: `OU=Utenti_Studenti,${LDAP_BASE_DN}`, role: 'student' },
    { ou: `OU=Utenti_Personale,${LDAP_BASE_DN}`, role: 'staff' },
  ];

  let teachers = 0;
  let students = 0;
  let staff = 0;
  let total = 0;

  const password_hash = await bcrypt.hash(NTLM_PASS, 10);

  for (const { ou, role } of ous) {
    const entries = await searchOu(client, ou);

    for (const entry of entries) {
      const attrs = entry.pojo.attributes;
      const ldap_uid = attrs.find((a) => a.type === 'sAMAccountName')?.vals[0] ?? null;
      if (!ldap_uid) continue;

      const name = attrs.find((a) => a.type === 'displayName')?.vals[0] ?? ldap_uid;
      const email = attrs.find((a) => a.type === 'mail')?.vals[0] ?? null;
      const department = attrs.find((a) => a.type === 'department')?.vals[0] ?? null;
      const uac = parseInt(attrs.find((a) => a.type === 'userAccountControl')?.vals[0] ?? '0');
      const active = (uac & 2) === 0 ? 1 : 0;

      await db('users')
        .insert({ ldap_uid, email, name, role, password_hash, department, school_year: '2025-26', active })
        .onConflict(['ldap_uid'])
        .merge();

      total++;
      if (role === 'teacher') teachers++;
      else if (role === 'student') students++;
      else if (role === 'staff') staff++;
    }
  }

  await db('scrape_log').insert({
    source: 'ldap',
    status: 'ok',
    started_at: startedAt,
    completed_at: new Date(),
    items_count: total,
  });

  return { imported: total, teachers, students, staff };
}

router.post('/sync', authenticate, requireRole('admin'), syncLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ldapOk = await isLdapReachable();
    if (!ldapOk) {
      res.status(503).json({ error: 'ldap not reachable' });
      return;
    }

    let client: ldap.Client;
    try {
      client = await createLdapClient();
    } catch {
      res.status(503).json({ error: 'ldap not reachable' });
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        client.bind(`${NTLM_USER}@itis.pr.it`, NTLM_PASS, (err) => {
          if (err) { client.destroy(); reject(err); }
          else resolve();
        });
      });
    } catch {
      res.status(503).json({ error: 'ldap bind failed' });
      return;
    }

    let result: Awaited<ReturnType<typeof performLdapSync>>;
    try {
      result = await performLdapSync(client);
    } finally {
      client.destroy();
    }

    res.json({ ...result, errors: [] });
  } catch (err) {
    next(err);
  }
});

router.get('/status', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [connected, lastSync, teacherRow, studentRow, staffRow] = await Promise.all([
      isLdapReachable(),
      db('scrape_log').where({ source: 'ldap' }).orderBy('id', 'desc').first(),
      db('users').where({ role: 'teacher', active: 1 }).count('id as n').first(),
      db('users').where({ role: 'student', active: 1 }).count('id as n').first(),
      db('users').where({ role: 'staff', active: 1 }).count('id as n').first(),
    ]);

    res.json({
      connected,
      last_sync: lastSync?.completed_at ?? null,
      counts: {
        teachers: Number(teacherRow?.n ?? 0),
        students: Number(studentRow?.n ?? 0),
        staff: Number(staffRow?.n ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/search', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) ?? '';
    const role = req.query.role as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (q.length < 2) {
      res.status(400).json({ error: 'query must be at least 2 characters' });
      return;
    }

    if (role === 'student' && req.user!.role === 'student') {
      res.status(403).json({ error: 'students cannot search other students' });
      return;
    }

    let query = db('users').where({ active: 1 }).whereNot({ role: 'admin' });
    query = query.where(function () {
      this.where('name', 'like', `%${q}%`).orWhere('ldap_uid', 'like', `%${q}%`);
    });
    if (role) query = query.andWhere({ role });

    const [data, totalRow] = await Promise.all([
      query.clone().select('id', 'ldap_uid', 'name', 'email', 'role', 'department').limit(limit).offset(offset),
      query.clone().count('id as n').first(),
    ]);

    res.json({ data, total: Number(totalRow?.n ?? 0), limit, offset });
  } catch (err) {
    next(err);
  }
});

export default router;
