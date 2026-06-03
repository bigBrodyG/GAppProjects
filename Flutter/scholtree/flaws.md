# Scholtree — Flaws & Definition of Done

## Definition of Done (Pre-Coding Checklist)

Before writing Phase 1 backend code, every item below must be resolved.
A checked box = decision made + action taken, not "thought about."

### SECURITY BLOCKERS (all must be ✅ before any commit)

- [x] **Credentials purged from git history** — no committed history; PLAN.md/CLAUDE.md now use `${NTLM_USER}` / `${NTLM_PASS}` placeholders
- [x] **`.env.example` committed** with placeholder keys; `.env` in `.gitignore`
- [x] **Service account expiry acknowledged** — documented in CLAUDE.md with `helpdesk@itis.pr.it` contact
- [x] **JWT secret** — validated in `src/config.ts` (min 32 chars), generated per deploy via `crypto.randomBytes`
- [x] **STARTTLS** on LDAP — implemented in `src/services/ldap.service.ts` with dev fallback
- [x] **VM eval banned** — regex-only parser in `src/scrapers/parse-ressource.ts` for all 3 JS files
- [x] **`admin` role added** — CHECK constraint in migration; role guard middleware exists
- [x] **HTTPS confirmed** — nginx pattern in M10; Flutter Dio client uses env-based `API_BASE_URL`

### ARCHITECTURE DECISIONS (must be decided, not deferred)

- [x] **Image storage** — disk (`./cache/`) not SQLite BLOB; `cache_path` column only in DB
- [x] **Backend directory structure** — scaffolded with `src/routes/ services/ db/ scrapers/ middleware/ types/`
- [x] **Migration strategy** — Knex migrations; first migration `001_initial.ts` with full schema
- [ ] **Substitution format** — get real sample file from school secretary before Phase 5 starts
- [x] **Teacher cross-ref strategy** — `teacher_map` table defined; `GET/PUT /api/admin/teacher-map` endpoints

### DATA MODEL FIXES (locked before DB init)

- [x] `resources` table has composite index on `(type, code)`
- [x] `substitutions` table has `UNIQUE(date, hour_start, teacher_id, class_id)`
- [x] `users.role` enum includes `admin`
- [x] `school_year` field on `resources` and `users`
- [x] All tables have a migration file (`001_initial.ts`)

---

## Flaws — Full List

### CRITICAL

---

#### C1 — Credentials hardcoded in git

**Problem**: `sfornari14 / Scuola2026!` is in `PLAN.md` and `CLAUDE.md`, committed to git history. Anyone with repo access has AD bind credentials.

**Fix**:
```bash
# Install BFG
brew install bfg  # or download jar

# Remove from history
bfg --replace-text passwords.txt  # passwords.txt: Scuola2026!
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease

# Rotate the password immediately after purge
# Add to .gitignore:
.env
*.env
*.auth
vpn.auth
```

In `PLAN.md` replace all credential references with `${NTLM_USER}` / `${NTLM_PASS}` placeholders.

`.env.example`:
```env
NTLM_USER=sfornari14
NTLM_PASS=
LDAP_URL=ldap://192.168.64.26:389
LDAP_BASE_DN=DC=itis,DC=pr,DC=it
JWT_SECRET=
JWT_EXPIRES_IN=8h
PORT=3000
```

---

#### C2 — Student personal account as service account

**Problem**: `sfornari14` is a real student AD account. Password expires. Account is disabled on graduation. No separation of privilege — service identity = student identity.

**Fix**:
1. Contact school IT (`helpdesk@itis.pr.it` or sysadmin) and request a dedicated service account (e.g., `svc_scholtree`) with read-only access to `OU=Utenti` and NTLM auth on `orariodiurnoriservata/`.
2. If IT refuses, document that the app has a hard death date tied to graduation and communicate this to any handoff recipient.
3. The service account must NOT be shared with personal login use.

---

#### C3 — Unencrypted LDAP (port 389, no TLS)

**Problem**: All LDAP bind operations (authentication) send credentials and query results over plaintext TCP on port 389.

**Fix** — implement STARTTLS in the LDAP service layer:
```typescript
// src/services/ldap.service.ts
import ldap from 'ldapjs';

export function createLdapClient() {
  const client = ldap.createClient({
    url: process.env.LDAP_URL!,
    tlsOptions: { rejectUnauthorized: true },
  });

  return new Promise<ldap.Client>((resolve, reject) => {
    client.starttls({}, [], (err) => {
      if (err) return reject(err);
      resolve(client);
    });
  });
}
```

If STARTTLS is rejected by the DC firewall, log a WARN and fall back only in dev mode — never silently in production.

---

#### C4 — `vm.Script` / eval for JS parsing

**Problem**: Node's `vm` module is not a sandbox. Using `eval` or `new vm.Script()` on school server JS files executes arbitrary code in the backend process.

**Fix** — regex extraction only:
```typescript
// src/scrapers/parse-ressource.ts
// Input: "new Ressource('c0000001', 'IND', '1A', '1', '', 1, 1, 1)"
// Extract positional args only — no execution.

const RESSOURCE_RE = /new\s+Ressource\s*\(([^)]+)\)/g;

export function parseRessourceJs(raw: string) {
  const resources = [];
  for (const match of raw.matchAll(RESSOURCE_RE)) {
    const args = match[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    resources.push({ code: args[0], type: args[1], name: args[2] });
  }
  return resources;
}
```

Same pattern for `_grille.js` and `_periode.js`. If format changes, the regex fails loudly — that's a feature, not a bug.

---

#### C5 — `POST /api/ldap/sync` unguarded

**Problem**: No auth or role check specified. Exposes full AD sync to any caller.

**Fix**:
```typescript
// middleware/require-role.ts
export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // set by JWT middleware
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };

// routes/ldap.ts
router.post('/sync', authenticate, requireRole('admin'), rateLimiter(1, '1h'), syncHandler);
```

---

#### C6 — No `admin` role in data model

**Problem**: `users.role` only has `student/teacher/staff`. Admin-only endpoints have no enforceable role to check against.

**Fix** — update schema before first migration:
```sql
-- users.role column:
CHECK(role IN ('student', 'teacher', 'staff', 'admin'))
```

Seed one admin user manually at deploy time. Do not auto-assign admin via LDAP sync — admin is explicitly granted.

---

#### C7 — File upload no validation

**Problem**: `POST /api/substitutions/upload` using multer with no file type, size, or path constraints.

**Fix**:
```typescript
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';

const UPLOAD_DIR = path.resolve('./uploads'); // not web-accessible

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_, __, cb) => cb(null, `${uuid()}`), // never use originalname
});

const ALLOWED_MIMES = new Set(['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf']);

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (_, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('invalid file type'));
    }
    cb(null, true);
  },
});
```

Additionally: store uploads outside the Express static root. Never serve uploaded files directly.

---

### HIGH

---

#### H1 — BLOBs in SQLite for timetable images

**Problem**: 460+ images × ~26KB = ~12MB minimum in a single DB file alongside row data. Kills query performance. Bloats backups.

**Fix**:
```sql
-- REMOVE image_data BLOB column
-- timetable_images table:
CREATE TABLE timetable_images (
  id INTEGER PRIMARY KEY,
  resource_code TEXT NOT NULL,
  cache_path TEXT NOT NULL,       -- relative: img/classi/c0000001.png
  last_modified TEXT,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Serve via:
```typescript
router.get('/timetable/image/:type/:code', authenticate, (req, res) => {
  const { type, code } = req.params;
  if (!['class', 'room', 'teacher'].includes(type)) return res.status(400).end();
  const safe_code = code.replace(/[^a-zA-Z0-9_-]/g, '');
  res.sendFile(path.join(CACHE_DIR, type, `${safe_code}.png`));
});
```

---

#### H2 — No JWT secret management

**Problem**: JWT secret source, strength, and expiry policy unspecified.

**Fix**:
```typescript
// src/config.ts
import crypto from 'crypto';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET missing or too short — set in .env');
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';
```

Generate secret at deploy:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

#### H3 — VPN single point of failure

**Problem**: LDAP auth, AD sync, NTLM scraping all die when VPN drops. No fallback.

**Fix**:
1. Run VPN as a systemd service with `Restart=always` on the backend server.
2. Implement a VPN/LDAP health check in the backend:
```typescript
// src/services/health.ts
export async function isLdapReachable(): Promise<boolean> {
  try {
    const client = await createLdapClient();
    client.destroy();
    return true;
  } catch { return false; }
}
```
3. Auth degraded mode: if LDAP unreachable, allow login using `users` table cached bcrypt hash (set during last successful LDAP sync). Students should still be able to view cached timetables even when AD is down.
4. Expose `GET /api/health` with VPN + LDAP + last scrape status. Flutter home screen shows "AD offline — cached data" banner.

---

#### H4 — Student directory exposed to all users

**Problem**: `GET /api/ldap/search?role=student` lets any authenticated student enumerate all other students.

**Fix**:
- Students: can search teachers and staff only. Own profile via `/api/auth/me`.
- Teachers: can search everyone.
- Staff/admin: can search everyone.

```typescript
router.get('/ldap/search', authenticate, (req, res) => {
  const { role } = req.query;
  const caller = req.user!;
  if (role === 'student' && caller.role === 'student') {
    return res.status(403).json({ error: 'students cannot search other students' });
  }
  // proceed
});
```

---

#### H5 — No schema migration strategy

**Problem**: No controlled DB schema upgrade path.

**Fix** — use Knex migrations:
```bash
npm install knex better-sqlite3
npx knex init
```

`knexfile.ts`:
```typescript
export default {
  client: 'better-sqlite3',
  connection: { filename: './data/scholtree.db' },
  useNullAsDefault: true,
  migrations: { directory: './src/db/migrations' },
};
```

First migration: `src/db/migrations/001_initial.ts` — full initial schema. Every schema change = new migration file. Never `ALTER TABLE` in application code.

---

#### H6 — Service account expires at graduation (June 2026)

**Problem**: `sfornari14` is disabled when school year ends. App goes fully offline.

**Fix**: This is the same root cause as C2. Treated separately because the timeline is weeks, not months.
1. If IT provides a service account before July 2026 → update `.env`, redeploy, done.
2. If not → document a "manual maintenance window" in `README.md` with instructions for whoever inherits the app.
3. Add a startup warning:
```typescript
const ACCOUNT_EXPIRY = new Date('2026-07-15');
if (new Date() > ACCOUNT_EXPIRY) {
  console.warn('⚠ Service account may be expired — check LDAP/NTLM connectivity');
}
```

---

### MEDIUM

---

#### M1 — No rate limiting

**Fix**:
```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'too many login attempts' });
router.post('/auth/login', authLimiter, loginHandler);

const syncLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 1 });
router.post('/ldap/sync', authenticate, requireRole('admin'), syncLimiter, syncHandler);
```

---

#### M2 — No pagination

**Fix**: All collection endpoints accept `?limit=50&offset=0`. Search requires `q.length >= 2`.

```typescript
router.get('/teachers', authenticate, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const rows = db.prepare('SELECT * FROM users WHERE role=? LIMIT ? OFFSET ?').all('teacher', limit, offset);
  res.json({ data: rows, limit, offset });
});
```

---

#### M3 — `_signature.js` unused for cache invalidation

**Fix**: Poll signature every 30 min. Full scrape only if changed.

```typescript
async function shouldScrape(): Promise<boolean> {
  const sig = await fetch(`${BASE_URL}/js_to_replace/_signature.js`).then(r => r.text());
  const last = db.prepare('SELECT value FROM scrape_log WHERE key=?').get('last_signature');
  if (last?.value === sig) return false;
  db.prepare('INSERT OR REPLACE INTO scrape_log(key, value) VALUES(?,?)').run('last_signature', sig);
  return true;
}
```

---

#### M4 — Image storage ambiguity (BLOB vs URL)

**Decision (see H1)**: Always proxy through backend. Store on disk. `image_url` column removed. `cache_path` (relative disk path) only.

For public timetables: cached locally at scrape time.
For teacher timetables (NTLM): always proxy live (or cached with auth context).

---

#### M5 — Flutter deps not in pubspec.yaml

**Fix** — add before Phase 3:
```yaml
dependencies:
  flutter_riverpod: ^2.6.1
  riverpod_annotation: ^2.6.1
  go_router: ^14.6.2
  dio: ^5.7.0
  flutter_secure_storage: ^9.2.2
  cached_network_image: ^3.4.1
  intl: ^0.20.1

dev_dependencies:
  riverpod_generator: ^2.6.2
  build_runner: ^2.4.13
  custom_lint: ^0.7.3
  riverpod_lint: ^2.6.1
```

---

#### M6 — JWT stored insecurely on Flutter client

**Fix**: Use `flutter_secure_storage` — uses Android Keystore, iOS Keychain, Linux libsecret.

```dart
// core/auth/token_storage.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _storage = FlutterSecureStorage();
const _key = 'jwt_token';

Future<void> saveToken(String token) => _storage.write(key: _key, value: token);
Future<String?> readToken() => _storage.read(key: _key);
Future<void> deleteToken() => _storage.delete(key: _key);
```

Never use `SharedPreferences` for JWT.

---

#### M7 — No backend directory structure

**Fix** — scaffold before writing any logic:
```
backend/
├── src/
│   ├── db/
│   │   ├── index.ts          # knex instance + init
│   │   └── migrations/
│   │       └── 001_initial.ts
│   ├── middleware/
│   │   ├── authenticate.ts   # JWT verify
│   │   └── require-role.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── timetable.ts
│   │   ├── directory.ts
│   │   ├── substitutions.ts
│   │   └── ldap.ts
│   ├── services/
│   │   ├── ldap.service.ts
│   │   ├── ntlm.service.ts
│   │   └── health.ts
│   ├── scrapers/
│   │   ├── parse-ressource.ts
│   │   ├── public-scraper.ts
│   │   └── private-scraper.ts
│   ├── types/
│   │   └── index.d.ts
│   └── index.ts
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── knexfile.ts
├── package.json
└── tsconfig.json
```

---

#### M8 — Substitution format undefined

**Decision required before Phase 5 starts**: Get a real sample file from the school. Do not build the parser or schema until format is confirmed.

Minimum to unblock Phase 5:
- [ ] Sample file obtained and committed to `backend/samples/sostituzioni_sample.*`
- [ ] Parser written and unit-tested against the sample
- [ ] DB schema for `substitutions` finalized

---

#### M9 — Teacher AD↔timetable cross-ref logic undefined

**Fix** — add `teacher_map` table:
```sql
CREATE TABLE teacher_map (
  timetable_code TEXT PRIMARY KEY,  -- from _ressource.js grProf
  ldap_uid TEXT,                     -- sAMAccountName from AD
  display_name TEXT,
  confidence TEXT CHECK(confidence IN ('auto', 'manual')),
  confirmed_at DATETIME
);
```

Matching strategy:
1. Normalize both names (lowercase, strip accents, remove spaces)
2. Attempt exact match on normalized surname
3. Log all `confidence='auto'` matches for admin review
4. Expose `GET /api/admin/teacher-map` for manual correction

---

#### M10 — No HTTPS

**Fix** — nginx reverse proxy config:
```nginx
server {
  listen 443 ssl;
  ssl_certificate /etc/letsencrypt/live/yourdomain/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain/privkey.pem;

  location /api/ {
    proxy_pass http://localhost:3000/api/;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
server {
  listen 80;
  return 301 https://$host$request_uri;
}
```

Flutter Dio base URL must be `https://`. Add in `core/api/client.dart`:
```dart
final dio = Dio(BaseOptions(
  baseUrl: const String.fromEnvironment('API_BASE_URL'),
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 10),
));
```

---

#### M11 — Cron failure handling

**Fix**:
```typescript
async function runScraper() {
  const start = Date.now();
  try {
    await scrapeTimetable();
    db.prepare("INSERT INTO scrape_log(source, status, started_at, completed_at) VALUES(?,?,?,?)")
      .run('public', 'ok', start, Date.now());
  } catch (err) {
    db.prepare("INSERT INTO scrape_log(source, status, started_at, completed_at, errors) VALUES(?,?,?,?,?)")
      .run('public', 'error', start, Date.now(), String(err));
    // retry once after 5 min
    setTimeout(runScraper, 5 * 60 * 1000);
  }
}
```

`GET /api/health` returns last scrape status + timestamp so Flutter can surface "data may be stale" warning.

---

#### M12 — No school-year reset strategy

**Fix**:
```sql
ALTER TABLE resources ADD COLUMN school_year TEXT DEFAULT '2025-26';
ALTER TABLE users ADD COLUMN school_year TEXT DEFAULT '2025-26';
```

Add admin endpoint `POST /api/admin/new-school-year?year=2026-27` that:
1. Archives current data (`school_year = '2025-26'`)
2. Triggers full LDAP sync with new `school_year` tag
3. Triggers full timetable scrape
4. Marks old entries `active = false`

---

### LOW

---

#### L1 — Path traversal on `:type` param

**Fix**: Already shown in H1 fix. Allowlist `['class', 'room', 'teacher']`. Sanitize `:code` with `/[^a-zA-Z0-9_-]/g` strip.

---

#### L2 — Polymorphic `resources` table

**Decision**: Accept the trade-off for now (school project scope). Mitigate with index:
```sql
CREATE INDEX idx_resources_type_code ON resources(type, code);
```

If teacher-specific fields are needed later, split into `teachers` table — migration path is clear.

---

#### L3 — No UNIQUE on `substitutions`

**Fix**:
```sql
CREATE TABLE substitutions (
  ...
  UNIQUE(date, hour_start, teacher_id, class_id)
);
```

Upload logic: use `INSERT OR REPLACE` and compare file hash before parsing to skip re-processing identical uploads.

---

#### L4 — JWT role staleness

**Fix**: JWT expires in 8h (school day). Sufficient for this use case. No refresh tokens needed — re-login daily is acceptable. If role changes mid-day, admin can revoke by adding `jti` to a small `revoked_tokens` table checked on each request (optional, add only if needed).

---

#### L5 — `pubspec.yaml` still default template

Tracked under M5. No additional action beyond what's specified there.
