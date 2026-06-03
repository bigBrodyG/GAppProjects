jest.mock('express-rate-limit', () => () => (_req: any, _res: any, next: any) => next());

const mockFirst = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue(1);
const mockQb: any = {
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  first: mockFirst,
  update: mockUpdate,
  select: jest.fn().mockReturnThis(),
};
jest.mock('../../db', () => ({ __esModule: true, default: jest.fn(() => mockQb) }));

jest.mock('../../config', () => ({
  JWT_SECRET: 'test-secret-32-chars-minimum-length',
  JWT_EXPIRES_IN: '1h',
  PORT: 3000,
  LDAP_URL: 'ldap://localhost:389',
  LDAP_BASE_DN: 'DC=test,DC=local',
  NODE_ENV: 'test',
  NTLM_USER: '',
  NTLM_PASS: '',
  NTLM_DOMAIN: 'TEST',
  CACHE_DIR: '/tmp',
  UPLOAD_DIR: '/tmp',
  DB_PATH: '/tmp/test.db',
}));

const mockBindUser = jest.fn();
const mockIsLdapReachable = jest.fn();
jest.mock('../../services/ldap.service', () => ({ bindUser: mockBindUser, createLdapClient: jest.fn() }));
jest.mock('../../services/health', () => ({ isLdapReachable: mockIsLdapReachable }));

import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authRouter from '../../routes/auth';

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

const SECRET = 'test-secret-32-chars-minimum-length';

let bcryptHash: string;

beforeAll(async () => {
  bcryptHash = await bcrypt.hash('pass', 10);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue(1);
});

describe('POST /auth/login', () => {
  it('returns 400 when username missing', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'username and password required' });
  });

  it('returns 401 when user not found', async () => {
    mockFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const res = await request(app).post('/auth/login').send({ username: 'unknown', password: 'x' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid credentials' });
  });

  it('returns 423 when user is disabled', async () => {
    mockFirst.mockResolvedValueOnce({ id: 1, ldap_uid: 'sFORNARI14', name: 'Test', role: 'student', active: 0, password_hash: null, class_name: '4C2' });
    const res = await request(app).post('/auth/login').send({ username: 'sFORNARI14', password: 'x' });
    expect(res.status).toBe(423);
    expect(res.body).toEqual({ error: 'account disabled' });
  });

  it('returns 200 with JWT when LDAP succeeds', async () => {
    mockFirst.mockResolvedValueOnce({ id: 1, ldap_uid: 'sFORNARI14', name: 'Test', role: 'student', active: 1, password_hash: null, class_name: '4C2' });
    mockIsLdapReachable.mockResolvedValueOnce(true);
    mockBindUser.mockResolvedValueOnce(true);

    const res = await request(app).post('/auth/login').send({ username: 'sFORNARI14', password: 'x' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.id).toBe(1);
  });

  it('returns 401 when LDAP succeeds but bind fails', async () => {
    mockFirst.mockResolvedValueOnce({ id: 1, ldap_uid: 'sFORNARI14', name: 'Test', role: 'student', active: 1, password_hash: null, class_name: '4C2' });
    mockIsLdapReachable.mockResolvedValueOnce(true);
    mockBindUser.mockResolvedValueOnce(false);

    const res = await request(app).post('/auth/login').send({ username: 'sFORNARI14', password: 'x' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid credentials' });
  });

  it('returns 200 using bcrypt fallback when LDAP down', async () => {
    mockFirst.mockResolvedValueOnce({ id: 1, ldap_uid: 'sFORNARI14', name: 'Test', role: 'student', active: 1, password_hash: bcryptHash, class_name: '4C2' });
    mockIsLdapReachable.mockResolvedValueOnce(false);

    const res = await request(app).post('/auth/login').send({ username: 'sFORNARI14', password: 'pass' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.id).toBe(1);
  });

  it('returns 503 when LDAP down and no cached hash', async () => {
    mockFirst.mockResolvedValueOnce({ id: 1, ldap_uid: 'sFORNARI14', name: 'Test', role: 'student', active: 1, password_hash: null, class_name: '4C2' });
    mockIsLdapReachable.mockResolvedValueOnce(false);

    const res = await request(app).post('/auth/login').send({ username: 'sFORNARI14', password: 'x' });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'authentication service unavailable' });
  });
});

describe('GET /auth/me', () => {
  const token = jwt.sign({ sub: 1, role: 'student', ldap_uid: 'sFORNARI14' }, SECRET, { expiresIn: '1h' });

  it('returns 200 with user on valid token', async () => {
    mockFirst.mockResolvedValueOnce({ id: 1, ldap_uid: 'sFORNARI14', name: 'Test', role: 'student', department: null, class_name: '4C2', email: 'test@itis.pr.it', teacher_resource_code: null });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });
});
