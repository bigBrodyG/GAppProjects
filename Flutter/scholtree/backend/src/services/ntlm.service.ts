import { NTLM_USER, NTLM_PASS, NTLM_DOMAIN } from '../config';

const httpntlm = require('httpntlm');

export function fetchTextNtlm(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    httpntlm.get(
      { url, username: NTLM_USER, password: NTLM_PASS, domain: NTLM_DOMAIN, workstation: '' },
      (err: Error | null, res: { statusCode: number; body: Buffer | string }) => {
        if (err) return reject(err);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        resolve(Buffer.isBuffer(res.body) ? res.body.toString('utf8') : res.body);
      }
    );
  });
}

export function fetchBinaryNtlm(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    httpntlm.get(
      { url, username: NTLM_USER, password: NTLM_PASS, domain: NTLM_DOMAIN, workstation: '', binary: true },
      (err: Error | null, res: { statusCode: number; body: Buffer | string }) => {
        if (err) return reject(err);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        resolve(Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body));
      }
    );
  });
}
