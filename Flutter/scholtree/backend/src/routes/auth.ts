import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-scholtree-2026-demo-only';
const JWT_EXPIRES_IN = '8h';

// Mock user database — in real app this is SQLite + LDAP
const MOCK_USERS: Record<string, { id: number; ldap_uid: string; name: string; role: string; department?: string; class_name?: string; email?: string }> = {
  sfornari14: {
    id: 1,
    ldap_uid: 'sFORNARI14',
    name: 'Giordano Fornari',
    role: 'student',
    class_name: '4C2',
    email: 'sgiordano.fornari@itis.pr.it',
  },
  dollari: {
    id: 2,
    ldap_uid: 'dollari',
    name: 'Paolo Ollari',
    role: 'teacher',
    department: 'Informatica',
    email: 'paolo.ollari@itis.pr.it',
  },
  admin: {
    id: 3,
    ldap_uid: 'admin',
    name: 'Amministratore',
    role: 'admin',
    email: 'admin@itis.pr.it',
  },
};

export const authRouter = Router();

authRouter.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'username e password richiesti' });
    return;
  }

  const user = MOCK_USERS[username.toLowerCase()];
  if (!user) {
    res.status(401).json({ error: 'credenziali non valide' });
    return;
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role, ldap_uid: user.ldap_uid },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  res.json({
    token,
    user: {
      id: user.id,
      ldap_uid: user.ldap_uid,
      name: user.name,
      role: user.role,
      department: user.department ?? null,
      class_name: user.class_name ?? null,
      email: user.email ?? null,
    },
  });
});

authRouter.get('/me', (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'token mancante' });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { ldap_uid: string };
    const user = MOCK_USERS[payload.ldap_uid.toLowerCase()];
    if (!user) {
      res.status(401).json({ error: 'utente non trovato' });
      return;
    }
    res.json({
      id: user.id,
      ldap_uid: user.ldap_uid,
      name: user.name,
      role: user.role,
      department: user.department ?? null,
      class_name: user.class_name ?? null,
      email: user.email ?? null,
    });
  } catch {
    res.status(401).json({ error: 'token non valido' });
  }
});
