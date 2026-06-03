import { Request, Response, NextFunction } from 'express';
import { requireRole } from '../../middleware/require-role';

function mockReq(user?: { id: number; role: string; ldap_uid: string | null }): Request {
  return { user } as unknown as Request;
}

function mockRes(): [Response, jest.Mock, jest.Mock] {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return [{ status } as unknown as Response, status, json];
}

describe('requireRole middleware', () => {
  it('calls next when user has matching role', () => {
    const req = mockReq({ id: 1, role: 'admin', ldap_uid: null });
    const [res] = mockRes();
    const next = jest.fn();

    requireRole('admin')(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when user has wrong role', () => {
    const req = mockReq({ id: 1, role: 'student', ldap_uid: null });
    const [res, status] = mockRes();
    const next = jest.fn();

    requireRole('admin')(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when req.user is undefined', () => {
    const req = mockReq(undefined);
    const [res, status] = mockRes();
    const next = jest.fn();

    requireRole('admin')(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts multiple allowed roles', () => {
    const req = mockReq({ id: 2, role: 'teacher', ldap_uid: null });
    const [res] = mockRes();
    const next = jest.fn();

    requireRole('admin', 'teacher')(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
