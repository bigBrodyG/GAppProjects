import ldap from 'ldapjs';
import { LDAP_URL, NODE_ENV } from '../config';

export function createLdapClient(): Promise<ldap.Client> {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: LDAP_URL });
    client.starttls({}, [], (err) => {
      if (err) {
        if (NODE_ENV === 'development') {
          console.warn('[ldap] STARTTLS failed, using plaintext (dev only)');
          resolve(client);
        } else {
          reject(err);
        }
        return;
      }
      resolve(client);
    });
  });
}

export async function bindUser(uid: string, password: string): Promise<boolean> {
  let client: ldap.Client;
  try {
    client = await createLdapClient();
  } catch {
    return false;
  }
  const dn = `${uid}@itis.pr.it`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => { client.destroy(); resolve(false); }, 5000);
    client.bind(dn, password, (err) => {
      clearTimeout(timer);
      client.destroy();
      resolve(!err);
    });
  });
}
