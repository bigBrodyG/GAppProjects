const mockBind = jest.fn();
const mockDestroy = jest.fn();
const mockStarttls = jest.fn();
const mockClient = { bind: mockBind, destroy: mockDestroy, starttls: mockStarttls };

jest.mock('ldapjs', () => ({
  createClient: jest.fn(() => mockClient),
}));

jest.mock('../../config', () => ({
  LDAP_URL: 'ldap://localhost:389',
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-32-chars-minimum-length',
  PORT: 3000,
  DB_PATH: '/tmp/test.db',
  CACHE_DIR: '/tmp',
  UPLOAD_DIR: '/tmp',
  NTLM_USER: '',
  NTLM_PASS: '',
  NTLM_DOMAIN: 'TEST',
  LDAP_BASE_DN: 'DC=test,DC=local',
}));

import { createLdapClient, bindUser } from '../../services/ldap.service';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createLdapClient', () => {
  it('resolves on STARTTLS success', async () => {
    mockStarttls.mockImplementationOnce((_opts: any, _ctrls: any, cb: (err: null) => void) => cb(null));

    const client = await createLdapClient();

    expect(client).toBe(mockClient);
  });

  it('rejects in non-dev when STARTTLS fails', async () => {
    const err = new Error('STARTTLS failed');
    mockStarttls.mockImplementationOnce((_opts: any, _ctrls: any, cb: (err: Error) => void) => cb(err));

    await expect(createLdapClient()).rejects.toThrow('STARTTLS failed');
  });
});

describe('bindUser', () => {
  it('returns true when bind succeeds', async () => {
    mockStarttls.mockImplementationOnce((_opts: any, _ctrls: any, cb: (err: null) => void) => cb(null));
    mockBind.mockImplementationOnce((_dn: string, _pw: string, cb: (err: null) => void) => cb(null));

    const result = await bindUser('sFORNARI14', 'password');

    expect(result).toBe(true);
  });

  it('returns false when bind fails', async () => {
    mockStarttls.mockImplementationOnce((_opts: any, _ctrls: any, cb: (err: null) => void) => cb(null));
    mockBind.mockImplementationOnce((_dn: string, _pw: string, cb: (err: Error) => void) => cb(new Error('invalid credentials')));

    const result = await bindUser('sFORNARI14', 'wrongpass');

    expect(result).toBe(false);
  });

  it('returns false when createLdapClient throws', async () => {
    mockStarttls.mockImplementationOnce((_opts: any, _ctrls: any, cb: (err: Error) => void) => cb(new Error('connection refused')));

    const result = await bindUser('sFORNARI14', 'password');

    expect(result).toBe(false);
  });
});
