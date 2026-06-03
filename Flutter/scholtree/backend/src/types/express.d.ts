declare namespace Express {
  interface Request {
    user?: {
      id: number;
      role: string;
      ldap_uid: string | null;
    };
  }
}
