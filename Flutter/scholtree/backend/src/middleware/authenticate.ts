import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { JWT_SECRET } from '../config';

interface JwtPayload {
  sub: number;
  role: string;
  ldap_uid?: string | null;
  iat: number;
  exp: number;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing or invalid token' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
    req.user = { id: payload.sub as number, role: payload.role, ldap_uid: payload.ldap_uid ?? null };
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}
