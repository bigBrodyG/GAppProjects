jest.mock('../../config', () => ({
  JWT_SECRET: 'test-secret-32-chars-minimum-length',
  JWT_EXPIRES_IN: '1h',
  PORT: 3000,
  NODE_ENV: 'test',
  DB_PATH: '/tmp/test.db',
  CACHE_DIR: '/tmp',
  UPLOAD_DIR: '/tmp',
  NTLM_USER: '',
  NTLM_PASS: '',
  NTLM_DOMAIN: 'TEST',
  LDAP_URL: 'ldap://localhost:389',
  LDAP_BASE_DN: 'DC=test,DC=local',
}));

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../middleware/authenticate';

const SECRET = 'test-secret-32-chars-minimum-length';

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mockRes(): [Response, jest.Mock, jest.Mock] {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return [{ status } as unknown as Response, status, json];
}

describe('authenticate middleware', () => {
  it('returns 401 when no Authorization header', () => {
    const req = mockReq();
    const [res, status] = mockRes();
    const next = jest.fn();

    authenticate(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when not Bearer format', () => {
    const req = mockReq({ authorization: 'Basic abc' });
    const [res, status] = mockRes();
    const next = jest.fn();

    authenticate(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and sets req.user on valid JWT', () => {
    const token = jwt.sign({ sub: 42, role: 'student', ldap_uid: 'sFORNARI14' }, SECRET, { expiresIn: '1h' });
    const req = mockReq({ authorization: `Bearer ${token}` });
    const [res] = mockRes();
    const next = jest.fn();

    authenticate(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).user).toMatchObject({ id: 42, role: 'student', ldap_uid: 'sFORNARI14' });
  });

  it('returns 401 on expired JWT', () => {
    const token = jwt.sign({ sub: 1, role: 'student', exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
    const req = mockReq({ authorization: `Bearer ${token}` });
    const [res, status] = mockRes();
    const next = jest.fn();

    authenticate(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 on malformed token', () => {
    const req = mockReq({ authorization: 'Bearer not.a.jwt' });
    const [res, status] = mockRes();
    const next = jest.fn();

    authenticate(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
