import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../db';
import { authenticate } from '../middleware/authenticate';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config';
import { bindUser } from '../services/ldap.service';
import { isLdapReachable } from '../services/health';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'too many login attempts' },
});

router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = req.body;
    if (!username || !password || username.length > 256 || password.length > 512) {
      res.status(400).json({ error: 'username and password required' });
      return;
    }

    // Try ldap_uid match first (AD users), then admin-local (null ldap_uid, matched by name)
    let user = await db('users').where({ ldap_uid: username, school_year: '2025-26' }).first();
    if (!user) {
      user = await db('users')
        .whereNull('ldap_uid')
        .where({ name: username, role: 'admin', school_year: '2025-26' })
        .first();
    }

    if (!user) {
      res.status(401).json({ error: 'invalid credentials' });
      return;
    }

    if (user.active === 0) {
      res.status(423).json({ error: 'account disabled' });
      return;
    }

    let ldapUsed = false;

    if (!user.ldap_uid) {
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        res.status(401).json({ error: 'invalid credentials' });
        return;
      }
    } else {
      const ldapOk = await isLdapReachable();
      if (ldapOk) {
        const bound = await bindUser(username, password);
        if (!bound) {
          res.status(401).json({ error: 'invalid credentials' });
          return;
        }
        ldapUsed = true;
      } else if (user.password_hash) {
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
          res.status(401).json({ error: 'invalid credentials' });
          return;
        }
      } else {
        res.status(503).json({ error: 'authentication service unavailable' });
        return;
      }
    }

    if (ldapUsed) {
      await db('users').where({ id: user.id }).update({ password_hash: await bcrypt.hash(password, 10) });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role, ldap_uid: user.ldap_uid },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    res.json({ token, user: { id: user.id, name: user.name, role: user.role, class_name: user.class_name } });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await db('users')
      .where({ id: req.user!.id, active: 1 })
      .select('id', 'ldap_uid', 'name', 'role', 'department', 'class_name', 'email', 'teacher_resource_code')
      .first();
    if (!user) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
