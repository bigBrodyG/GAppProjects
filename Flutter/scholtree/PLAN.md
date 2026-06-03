# Scholtree — Piano Progettuale

## Visione

App unificata per la comunità scolastica dell'**ITIS Leonardo da Vinci (Parma)** che integra **orario lezioni**, **rubrica AD/LDAP** e **gestione sostituzioni** in un'unica interfaccia mobile/desktop. Target: studenti (~1000), docenti (~245), personale ATA (~66), amministratori (~5).

---

## Quickstart (nuovo sviluppatore)

```bash
# 1. Clona
git clone <repo> && cd scholtree

# 2. Backend
cd backend
cp .env.example .env
# edita .env con credenziali reali (NTLM_USER, NTLM_PASS, JWT_SECRET)
npm install
npx knex migrate:latest        # crea DB + tabelle
npx knex seed:run              # popola admin user iniziale
npm run dev                     # ts-node-dev --respawn

# 3. Flutter
cd ..
flutter pub get
flutter run -d linux --dart-define=API_BASE_URL=http://localhost:3000

# 4. VPN (serve per LDAP/NTLM — non serve per dev senza rete scuola)
sudo openvpn --config ~/Documents/itis.ovpn --auth-user-pass /tmp/vpn.auth --daemon
```

**Primo accesso admin**: dopo `knex seed:run`, l'utente admin esiste nel DB. Le credenziali sono in `.env` (`ADMIN_USER`, `ADMIN_PASS`). Al primo login l'admin può triggerare `POST /api/ldap/sync` e `POST /api/admin/scrape`.

**Senza VPN** (dev offline): il backend parte senza LDAP. Login funziona solo per utenti già in DB (admin seed). Le API di timetable rispondono con dati cached. `GET /api/health` riporta `ldap: false`.

---

## Architettura

```
┌──────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────────────┐
│  Flutter App         │     │  Node.js Backend (API)   │     │  Fonti Esterne               │
│  (mobile + desktop)  │◀───▶│  Porta 3000              │────▶│  dati.itis.pr.it (IIS 10)    │
│                      │     │                          │     │  - JS statici orario         │
│  - Riverpod state    │     │  - Express               │     │  - PNG timetable classi/aule │
│  - GoRouter routing  │     │  - better-sqlite3        │     │                              │
│  - Dio HTTP client   │     │  - ldapjs (per AD)       │────▶│  AD (192.168.64.26)          │
│  - Material Design 3 │     │  - node-cron (scraper)   │     │  - LDAP su 389 (STARTTLS)   │
│  - flutter_secure_   │     │  - multer (sostituzioni) │     │  - NTLM su IIS               │
│    _storage per JWT  │     │  - jsonwebtoken          │     │  - DNS: itis.pr.it           │
│  - cached_network_   │     │  - bcrypt (login offline)│     │                              │
│    _image per PNGs   │     │  - knex (migrations)     │     │  - File sostituzioni (admin) │
└──────────────────────┘     └──────────────────────────┘     └──────────────────────────────┘

Flusso dati:
1. node-cron triggera scraper → fetch JS/PNG da dati.itis.pr.it → parse regex → SQLite
2. LDAP sync (admin trigger o cron) → interroga AD → INSERT OR REPLACE in users
3. Flutter → Dio → API backend → SQLite / proxy PNG
4. NTLM auth teacher timetable → solo backend (il client non vede mai credenziali NTLM)
```

**Hosting backend**: server personale (Docker container, nginx reverse proxy con Let's Encrypt).

---

## Analisi Fonti Dati

### 1. Orario pubblico — ✅ ACCESSIBILE
**URL**: `https://dati.itis.pr.it/orariodiurno/`
**Server**: IIS 10.0
**Dati disponibili**:

| Cosa | Formato | URL |
|------|---------|-----|
| Config colori/testi | JSON | `.../data/configDocenti.json` |
| Classi | JS (`_ressource.js`) → 105 classi (1A-5D) con codice `c000XXXX` | `.../js_to_replace/_ressource.js` |
| Aule | JS (`_ressource.js`) → ~110 aule/lab con codice `s000XXXX` | stesso file |
| Periodi (codice→immagine) | JS (`_periode.js`) → mapping codice risorsa → codice griglia | `.../js_to_replace/_periode.js` |
| Griglie (codice→path PNG) | JS (`_grille.js`) → mapping codice griglia → path immagine | `.../js_to_replace/_grille.js` |
| Immagini classi | PNG 24x7 griglia oraria | `.../img/classi/edc0000002....png` |
| Immagini aule | PNG 24x7 griglia oraria | `.../img/aule/eds0000002....png` |
| Data ultimo aggiornamento | JS (`_signature.js`) | `.../js_to_replace/_signature.js` |
| Docenti | **NON presenti** (nascosti con flag `visualizza_professori: true`) | — |

**Note scraping**: I JS sono array con sintassi `new Ressource(...)`. Vanno parsati con regex o eval mock. Le immagini sono servite direttamente (HTTP 200, ~26KB cad.)

### 2. Orario riservato docenti — ✅ NTLM funzionante
**URL**: `https://dati.itis.pr.it/orariodiurnoriservata/`
**Server**: IIS 10.0 con Windows Integrated Auth (WWW-Authenticate: Negotiate + NTLM)
**Auth**: NTLM contro AD `itis.pr.it` via `httpntlm` (Node.js, funzionante)

| Cosa | Stato |
|------|-------|
| Pagina | 200 con credenziali `${NTLM_USER}:${NTLM_PASS}` (dominio `ITIS`) |
| Stessi JS di orariodiurno | Inclusi `grProf` (docenti) — da parsare |
| Immagini docenti | `.../img/docenti/{codice}_{nome}.png` |

**NTLM testato con successo** via Node.js `httpntlm`. Service account `${NTLM_USER}` (dominio `ITIS`) è utente AD reale con validità.

### 3. AD / LDAP — ✅ RAGGIUNGIBILE, port 389 aperto
**Server**: Domain Controller `srvdc01` = `192.168.64.26` (via VPN itis, tun0)
**VPN**: OpenVPN WatchGuard su `tun0`, client `192.168.254.2/24`, DNS VPN `192.168.64.25` + `192.168.64.26`
**Service account**: `${NTLM_USER}@itis.pr.it` / `${NTLM_PASS}`

**3 Domain Controller:**

| Host | IP | Ruolo | Porte aperte |
|------|-----|-------|--------------|
| `srvdc01.itis.pr.it` | 192.168.64.26 | **PDC** (FSMO) | 53, 389, 9389 (ADWS) |
| `srvdc06.itis.pr.it` | 192.168.64.25 | DC | 53, 389, 9389 |
| `srvdc07.itis.pr.it` | 192.168.64.28 | DC | 53 (offline?) |

**Porte verificate su srvdc01:**
| Porta | Servizio | Stato |
|-------|----------|-------|
| 53/TCP+UDP | DNS | ✅ Open |
| 88 | Kerberos | ❌ Filtered (firewall) |
| 389 | **LDAP** | **✅ Aperto** |
| 636 | LDAPS | ❌ Filtered |
| 445 | SMB | ❌ Filtered |
| 3268 | GC | ❌ Filtered |
| 3269 | GC SSL | ❌ Filtered |
| 9389 | **ADWS** | **✅ Aperto** |
| 5985/5986 | WinRM | ❌ Filtered |

**⚠ Note**: porte diverse da 53/389/9389 sono filtrate dal WatchGuard. LDAP semplice (389) funziona — `ldapsearch` con bind `${NTLM_USER}@itis.pr.it` risponde. LDAPS (636) bloccato, usare STARTTLS su 389.

**Struttura AD:**

```
DC=itis,DC=pr,DC=it
├── OU=Domain Controllers       → SRVDC01$
├── OU=Utenti
│   ├── OU=Utenti_Docenti       → **245 docenti** (sAMAccountName: d{NOME})
│   ├── OU=Utenti_Studenti      → **1000+ studenti** (sAMAccountName: s{NOME})
│   ├── OU=Utenti_Personale     → **66 personale ATA** (sAMAccountName: r{NOME})
│   ├── OU=Utenti_Esterni
│   ├── OU=Utenti_Temporanei
│   ├── OU=Utenti_Mantenuti
│   ├── OU=Utenti_Speciali
│   ├── OU=Utenti_Z / Utenti_W  → ex-utenti / disattivati
│   ├── OU=Servizio             → account servizio (zActiveDir, etc.)
│   └── OU=Esperimenti
├── OU=Gruppi
│   ├── OU=Gruppi_Docenti
│   │   ├── OU=Gruppi_Indirizzi      → DOC_ITIA, DOC_ENEL, DOC_BIENNIO, etc.
│   │   ├── OU=Gruppi_Classi         → 1A_CDC, 1B_CDC, …, 5S4_CDC (CDC = Consiglio di Classe)
│   │   └── DOC_TUTTI                → tutti i docenti
│   ├── OU=Gruppi_Studenti
│   │   ├── OU=Gruppi_Indirizzi      → per indirizzo
│   │   └── OU=Gruppi_Classi         → 1A, 1B, …, 5S4 (classi reali)
│   ├── OU=Gruppi_Admin
│   ├── OU=Gruppi_Personale
│   ├── OU=Gruppi_Internet
│   ├── OU=Gruppi_Speciali
│   ├── OU=Gruppi_Progetti
│   └── OU=Gruppi_Indirizzi
├── OU=Computer_Laboratori
├── OU=Computer_Disattivati
├── OU=Server_Centrali
├── OU=Share
└── OU=Microsoft Exchange Security Groups
```

**Convenzioni nomi:**
| Ruolo | sAMAccountName | Esempio | OU |
|-------|---------------|---------|-----|
| Docente | `d{NOME}` | `dollari` (Ollari Paolo) | Utenti_Docenti |
| Studente | `s{NOME}{N}` | `sFORNARI14` (Fornari Giordano) | Utenti_Studenti |
| Personale | `r{NOME}` | `rCIAMPITTIELLO` | Utenti_Personale |

**(account usato per dev)** = FORNARI GIORDANO, studente 4C2, email `sgiordano.fornari@itis.pr.it`, gruppo VPN `wg_VPN_CodeVinciCTF`

### 4. Sostituzioni — ❓ Formato da definire
Non è stato trovato alcun file di sostituzioni pubblico. La scuola fornisce il file il giorno prima. Probabilmente:
- Formato: CSV, XLSX o PDF
- Canale: upload manuale da segreteria (admin), o dropbox condiviso
- Dati attesi: data, ora, docente assente, classe, materia, aula, note
- Integrazione: cross-ref con orario per visualizzare impatto

⚠️ **Prima di iniziare la Fase 5, ottenere un file campione dalla segreteria.** Senza campione il parser non può essere scritto.

---

## Modello Dati

### Backend — SQLite (SQL completo)

```sql
-- Tabella unificata da scraper (classi, aule, docenti)
CREATE TABLE resources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL CHECK(type IN ('class', 'room', 'teacher')),
  code        TEXT NOT NULL,                    -- c0000001, s0000010, dPROF001
  name        TEXT NOT NULL,                    -- 1A, LAB FISICA, Rossi Mario
  cache_path  TEXT,                             -- percorso PNG su disco (img/classi/c0000001.png)
  school_year TEXT NOT NULL DEFAULT '2025-26',
  active      INTEGER NOT NULL DEFAULT 1,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_resources_type_code ON resources(type, code);
CREATE UNIQUE INDEX idx_resources_type_code_year ON resources(type, code, school_year);

-- Cache immagini orario su disco (MAI BLOB in DB)
CREATE TABLE timetable_images (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_code  TEXT NOT NULL,
  cache_path     TEXT NOT NULL,                 -- percorso relativo: img/classi/edc0000002.png
  last_modified  TEXT,
  cached_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_timetable_images_code ON timetable_images(resource_code);

-- Utenti (sync da AD + admin locali)
CREATE TABLE users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  ldap_uid              TEXT UNIQUE,            -- sAMAccountName (NULL per admin locali)
  email                 TEXT,
  name                  TEXT NOT NULL,           -- displayName da AD
  role                  TEXT NOT NULL CHECK(role IN ('student', 'teacher', 'staff', 'admin')),
  password_hash         TEXT,                    -- bcrypt hash (solo per admin locali e fallback offline)
  teacher_resource_code TEXT,                    -- cross-ref a resources.code per docenti
  department            TEXT,                    -- dipartimento/materia (docenti), classe (studenti)
  class_name            TEXT,                    -- es. "4C2" (solo studenti)
  school_year           TEXT NOT NULL DEFAULT '2025-26',
  active                INTEGER NOT NULL DEFAULT 1,
  last_sync             DATETIME,               -- ultimo sync LDAP riuscito
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_users_ldap_uid ON users(ldap_uid);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_class ON users(class_name);

-- Sostituzioni
CREATE TABLE substitutions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL,                   -- YYYY-MM-DD
  hour_start   INTEGER NOT NULL,                -- 1..8 (ora scolastica)
  hour_end     INTEGER NOT NULL,
  teacher_id   INTEGER REFERENCES users(id),
  class_id     INTEGER,                         -- FK implicita a resources.id
  subject      TEXT,
  room         TEXT,
  notes        TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, hour_start, teacher_id, class_id)
);
CREATE INDEX idx_substitutions_date ON substitutions(date);

-- Cross-ref orario docenti (timetable code) → AD (ldap_uid)
CREATE TABLE teacher_map (
  timetable_code TEXT PRIMARY KEY,              -- codice da _ressource.js grProf
  ldap_uid       TEXT,                          -- sAMAccountName da AD
  display_name   TEXT,
  confidence     TEXT CHECK(confidence IN ('auto', 'manual')) DEFAULT 'auto',
  confirmed_at   DATETIME
);

-- Audit scraping
CREATE TABLE scrape_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,                   -- 'public' | 'private' | 'ldap'
  status       TEXT NOT NULL CHECK(status IN ('ok', 'partial', 'error')),
  started_at   DATETIME NOT NULL,
  completed_at DATETIME,
  items_count  INTEGER,                         -- quante risorse processate
  errors       TEXT,                            -- messaggio errore se fallito
  signature    TEXT                             -- _signature.js hash per cache invalidation
);

-- Revoca JWT (opzionale)
CREATE TABLE revoked_tokens (
  jti        TEXT PRIMARY KEY,
  revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Note DB**:
- **Mai BLOB** in SQLite. Le immagini PNG stanno su disco in `./cache/img/{type}/{code}.png`. Il DB contiene solo `cache_path`.
- `school_year` su `resources` e `users` permette il reset annuale senza perdere dati storici.
- `users.password_hash` è popolato SOLO per admin locali e come cache bcrypt durante sync LDAP (per login offline).

---

## API Endpoints

### Auth

```
POST /api/auth/login
  Body:    { "username": "sFORNARI14", "password": "..." }
  Flow:    1. Cerca username in users.ldap_uid
           2. Se trovato e ha password_hash → bcrypt.compare (login offline)
           3. Altrimenti → LDAP bind (login online)
           4. Se LDAP bind ok e nessun password_hash → bcrypt.hash(password) e salva in DB (cache fallback)
           5. Genera JWT { sub: user.id, role: user.role, ldap_uid: user.ldap_uid }
  Response: { "token": "eyJ...", "user": { "id": 1, "name": "...", "role": "student", "class_name": "4C2" } }
  Errors:   401 "invalid credentials", 423 "account disabled"

GET /api/auth/me
  Headers:  Authorization: Bearer <token>
  Response: { "id": 1, "ldap_uid": "sFORNARI14", "name": "Fornari Giordano", "role": "student", "department": "4C2", "class_name": "4C2", "email": "sgiordano.fornari@itis.pr.it" }
```

**Login flow dettagliato**:
- Il backend tenta sempre prima LDAP bind (online). Se LDAP è raggiungibile e il bind funziona, la password è verificata e il DB viene aggiornato con il nuovo bcrypt hash.
- Se LDAP non è raggiungibile (VPN down), il backend usa bcrypt.compare sull'hash salvato durante l'ultimo sync.
- Utenti admin locali (creati via seed) hanno solo password_hash, mai ldap_uid. Fanno login solo via bcrypt.
- **Nessun password change flow** — le password sono gestite da AD. L'app non permette di cambiarle. Gli admin locali possono cambiare password solo tramite seed o intervento manuale su DB.

### Directory

```
GET /api/classes?limit=50&offset=0
  Auth:     required (any role)
  Response: { "data": [{ "code": "c0000001", "name": "1A" }, ...], "total": 105 }

GET /api/rooms?limit=50&offset=0
  Auth:     required (any role)
  Response: { "data": [{ "code": "s0000010", "name": "LAB FISICA" }, ...], "total": 110 }

GET /api/teachers?limit=50&offset=0
  Auth:     required (any role)
  Response: { "data": [{ "code": "dPROF001", "name": "Rossi Mario", "department": "Matematica" }, ...], "total": 245 }

GET /api/search?q=mario&role=teacher&limit=20&offset=0
  Auth:     required
  Note:     q.length >= 2 richiesto. Cerca in resources + users per nome.
            role filter opzionale: teacher | student (solo se caller non è student) | staff
            Studenti NON possono cercare altri studenti (403 se role=student e caller.role=student).
  Response: { "data": [...], "total": N }

GET /api/users/:id
  Auth:     required
  Response: { "id": 1, "ldap_uid": "dollari", "name": "Ollari Paolo", "role": "teacher", "department": "Informatica", "teacher_resource_code": "dPROF042" }
  Note:     Se caller è student e target è student → 403. Se target è teacher, include teacher_resource_code per link a orario.
```

### Timetable

```
GET /api/timetable/image/:type/:code
  Auth:     required
  Params:   type ∈ [class, room, teacher], code sanitized (/[^a-zA-Z0-9_-]/g rimosso)
  Response: image/png (proxy dal filesystem ./cache/img/{type}/{code}.png)
  Note:     Se type=teacher, l'immagine è servita solo se esiste in cache (scraper riservato).
            Se il file non esiste → 404 "timetable not available".
  Caching:  `Cache-Control: public, max-age=3600`

GET /api/timetable/meta/:type/:code
  Auth:     required
  Response: { "image_url": "/api/timetable/image/class/c0000001", "last_updated": "2026-06-03T06:00:00Z", "school_year": "2025-26" }
```

### Sostituzioni

```
GET /api/substitutions?date=YYYY-MM-DD&limit=50&offset=0
  Auth:     required
  Response: { "data": [{ "id": 1, "date": "2026-06-03", "hour_start": 2, "hour_end": 3, "teacher": { "id": 5, "name": "Rossi Mario" }, "class_name": "4C2", "subject": "Matematica", "room": "LAB2", "notes": "Supplente: Bianchi" }], "total": 12 }

GET /api/substitutions/today
  Auth:     required
  Response: come sopra con date=today

POST /api/substitutions/upload
  Auth:     admin only
  Body:     multipart/form-data, field "file"
  Accept:   CSV (text/csv), XLSX (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet), PDF (application/pdf)
  Max size: 2MB
  Storage:  ./uploads/{uuid} (MAI salvare con originalname)
  Flow:     1. Valida MIME type e size
            2. Salva con UUID filename in ./uploads/
            3. Parsa il file (CSV/XLSX)
            4. INSERT OR REPLACE in substitutions (UNIQUE evita duplicati)
            5. Se il file è identico a upload precedente (hash check) → skip
  Response: { "imported": 15, "skipped": 2, "errors": [] }
  Errors:   400 "invalid file type", 413 "file too large", 422 "parse error: riga 5 colonna sconosciuta"
```

### LDAP

```
POST /api/ldap/sync
  Auth:     admin only
  Rate:     1 richiesta/ora
  Flow:     1. Bind LDAP con STARTTLS (fallback a plain 389 se STARTTLS fallisce, con warn)
            2. Query OU=Utenti_Docenti, OU=Utenti_Studenti, OU=Utenti_Personale
            3. Per ogni utente: INSERT OR REPLACE in users (match su ldap_uid)
            4. Per ogni utente: bcrypt.hash(NTLM_PASS) → password_hash (cache offline)
            5. Popola department (docenti: dipartimento, studenti: classe da memberOf)
            6. Logga in scrape_log(source='ldap', items_count=N)
  Response: { "imported": 1311, "teachers": 245, "students": 1010, "staff": 56, "errors": [] }

GET /api/ldap/status
  Auth:     required (any role)
  Response: { "connected": true, "last_sync": "2026-06-03T08:00:00Z", "counts": { "teachers": 245, "students": 1010, "staff": 56 } }

GET /api/ldap/search?q=rossi&role=teacher&limit=10
  Auth:     required
  Note:     Cerca nel DB locale (users table), non query LDAP diretta. Stessa restrizione studenti.
  Response: { "data": [{ "ldap_uid": "drossi", "name": "Rossi Mario", "role": "teacher", "department": "Matematica" }] }
```

### Admin

```
POST /api/admin/scrape
  Auth:     admin only
  Trigger:  avvia manualmente lo scraper pubblico + riservato
  Response: { "public": "ok", "private": "ok", "items": 460 }

GET /api/admin/teacher-map?confidence=auto&limit=50
  Auth:     admin only
  Response: { "data": [{ "timetable_code": "dPROF042", "ldap_uid": "dollari", "display_name": "Ollari Paolo", "confidence": "auto" }] }

PUT /api/admin/teacher-map/:timetable_code
  Auth:     admin only
  Body:     { "ldap_uid": "drossi", "confirmed": true }
  Response: { "timetable_code": "dPROF042", "ldap_uid": "drossi", "confidence": "manual", "confirmed_at": "2026-06-03T10:00:00Z" }

POST /api/admin/new-school-year?year=2026-27
  Auth:     admin only
  Flow:     1. resources: SET active=0 WHERE school_year=current
            2. users: SET active=0 WHERE school_year=current
            3. Triggera LDAP sync con nuovo school_year
            4. Triggera scraper pubblico + riservato
            5. Logga in scrape_log
  Response: { "archived": 1571, "new_year": "2026-27" }
```

### Health

```
GET /api/health
  Auth:     none
  Response: {
    "status": "ok",
    "uptime": 123456,
    "ldap": { "connected": true, "last_sync": "2026-06-03T08:00:00Z" },
    "scrape": { "public": { "status": "ok", "last_run": "2026-06-03T06:00:00Z", "items": 215 },
                "private": { "status": "error", "last_run": "2026-06-02T18:00:00Z", "error": "NTLM auth failed" } },
    "db": { "resources": 460, "users": 1311 }
  }
```

---

## Pipeline Scraper

### Scraper orario pubblico (cron: signature check ogni 30min, full scrape ogni 6h se signature cambiata)

```
1. GET /orariodiurno/js_to_replace/_signature.js
2. Confronta con scrape_log.signature più recente
3. Se invariato → skip (log: "signature unchanged")
4. Se cambiato (o primo run):
   a. GET /orariodiurno/js_to_replace/_ressource.js  → parse classi + aule
   b. GET /orariodiurno/js_to_replace/_periode.js    → parse periodi
   c. GET /orariodiurno/js_to_replace/_grille.js     → parse griglie
   d. GET /orariodiurno/data/configDocenti.json      → parse config
   e. Per ogni risorsa con griglia valida: GET /orariodiurno/img/{type}/{code}.png → salva in ./cache/img/{type}/{code}.png
   f. INSERT OR REPLACE in resources + timetable_images
   g. Log in scrape_log(source='public', status='ok', signature=<nuova>)
```

**Partial failure handling**:
- Se una fetch fallisce (timeout/500), logga l'errore e continua con le altre.
- Se il parsing di un file JS fallisce, logga l'errore MA prosegue con gli altri file.
- Lo scrape è considerato `partial` se almeno una risorsa è fallita, `ok` solo se tutto completato.
- Retry automatico dopo 5 minuti se status non è `ok`.

### Scraper orario riservato (stessa logica, con NTLM)

```
1. NTLM auth con service account su /orariodiurnoriservata/
2. Stessa pipeline di parsing (include grProf → docenti)
3. Cross-ref automatico: normalizza cognome da grProf.name, cerca match in users WHERE role='teacher'
4. Se match esatto → teacher_map INSERT (confidence='auto')
5. Se match multipli o nessuno → lascia vuoto, admin corregge via PUT /api/admin/teacher-map/:code
```

**Teacher cross-ref strategy (estesa)**:
```
1. Estrai cognome da grProf.display_name: "Rossi Mario" → "rossi"
2. Estrai cognomi da AD: users WHERE role='teacher' → normalizza display_name
3. Normalizzazione: lowercase, strip accenti, rimuovi spazi, prendi prima parola (cognome italiano)
4. Match esatto normalizzato → confidence='auto'
5. Match multipli (omonimi) → confidence='auto', logga warning, admin decide
6. Nessun match → lascia ldap_uid=NULL, admin assegna manualmente
```

### Sync AD → DB (cron giornaliero 3:00 + on demand via admin)

```
1. Bind LDAP con STARTTLS su srvdc01:389
2. Query OU=Utenti_Docenti → 245 docenti (sAMAccountName, displayName, mail, department, memberOf)
3. Query OU=Utenti_Studenti → 1000+ studenti (sAMAccountName, displayName, mail, department=classe)
4. Query OU=Utenti_Personale → 66 ATA
5. Query OU=Gruppi per mappare classi e indirizzi
6. INSERT OR REPLACE in users con role (student/teacher/staff)
7. Per ogni utente: bcrypt.hash(NTLM_PASS) → password_hash (cache offline)
8. Map department studente → class_name; department docente → department
9. Log in scrape_log(source='ldap', items_count=N)
```

---

## Flutter — Struttura e State Management

```
lib/
├── main.dart                          # Entry point, ProviderScope
├── app.dart                           # MaterialApp.router con GoRouter
├── core/
│   ├── api/
│   │   ├── client.dart                # Dio instance, interceptors (JWT, error mapping)
│   │   ├── auth_api.dart              # login(), getMe()
│   │   └── data_api.dart              # getClasses(), getTimetableImage(), search(), etc.
│   ├── auth/
│   │   ├── auth_provider.dart         # authStateProvider (AsyncNotifier)
│   │   ├── token_storage.dart         # flutter_secure_storage wrapper
│   │   └── auth_interceptor.dart      # Dio interceptor: aggiunge Bearer, gestisce 401
│   ├── router/
│   │   └── app_router.dart            # GoRouter config, redirect per auth
│   ├── theme/
│   │   └── theme.dart                 # Material 3 theme
│   └── widgets/
│       ├── error_widget.dart          # Stato errore con retry
│       ├── empty_widget.dart          # Stato vuoto con icona + messaggio
│       ├── loading_widget.dart        # Skeleton/CircularProgressIndicator
│       └── offline_banner.dart        # Banner "dati offline — ultimo aggiornamento: ..."
├── features/
│   ├── login/
│   │   └── login_screen.dart          # Form username/password
│   ├── home/
│   │   ├── home_screen.dart           # Scaffold con BottomNavigationBar
│   │   └── home_provider.dart         # Stato dashboard (orario oggi, sostituzioni, health)
│   ├── timetable/
│   │   ├── timetable_screen.dart      # Select risorsa (dropdown/ricerca) + visualizzazione
│   │   ├── timetable_image_view.dart  # InteractiveViewer con zoom/pinch su PNG
│   │   ├── resource_picker.dart       # Widget selezione classe/docente/aula
│   │   └── timetable_provider.dart    # Caricamento e cache immagine
│   ├── directory/
│   │   ├── directory_screen.dart      # SearchBar + lista risultati con paginazione
│   │   ├── person_detail_screen.dart  # Dettaglio persona + orario docente (se teacher)
│   │   └── directory_provider.dart    # Ricerca e paginazione
│   └── substitutions/
│       ├── substitutions_screen.dart  # Lista giorno con filtro e data
│       ├── substitutions_provider.dart
│       └── substitution_card.dart     # Card singola sostituzione
```

### Pattern Riverpod

```dart
// Esempio: timetable_provider.dart
@riverpod
class TimetableImage extends _$TimetableImage {
  @override
  FutureOr<Uint8List?> build(String type, String code) async {
    final api = ref.watch(dataApiProvider);
    final url = api.timetableImageUrl(type, code);
    // Dio scarica in bytes, cached_network_image lo cache-à su disco
    return null; // cached_network_image gestisce il download
  }
}
```

### Route (GoRouter)

```dart
GoRouter(
  initialLocation: '/home',
  redirect: (context, state) {
    final isLoggedIn = ref.read(authStateProvider).valueOrNull != null;
    final isLoginRoute = state.matchedLocation == '/login';
    if (!isLoggedIn && !isLoginRoute) return '/login';
    if (isLoggedIn && isLoginRoute) return '/home';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    ShellRoute(                                                  // BottomNavigationBar persistente
      builder: (_, __, child) => HomeScreen(child: child),
      routes: [
        GoRoute(path: '/home', builder: (_, __) => const DashboardScreen()),
        GoRoute(path: '/timetable', builder: (_, __) => const TimetableScreen()),
        GoRoute(path: '/directory', builder: (_, __) => const DirectoryScreen()),
        GoRoute(path: '/directory/:id', builder: (_, s) => PersonDetailScreen(id: s.pathParameters['id']!)),
        GoRoute(path: '/substitutions', builder: (_, __) => const SubstitutionsScreen()),
      ],
    ),
  ],
);
```

---

## Specifiche UX

### 1. Login Screen

| Stato | Comportamento |
|-------|---------------|
| **Default** | Form con 2 TextField (username, password) + "Accedi" button. Logo scuola in alto. |
| **Loading** | Button disabilitato, CircularProgressIndicator nel button. |
| **Error (401)** | SnackBar rossa: "credenziali non valide". Form rimane compilato. |
| **Error (rete)** | SnackBar: "impossibile connettersi al server". Pulsante "Riprova". |
| **Error (account disabilitato)** | SnackBar: "account disattivato". |
| **Offline** | Se il backend non è raggiungibile MA l'utente ha fatto login di recente e il token è ancora valido → login automatico con token cached. |

### 2. Home / Dashboard

| Stato | Comportamento |
|-------|---------------|
| **Default** | Card "Orario oggi" (risorsa di default = classe dello studente), card "Sostituzioni oggi" (conteggio), search bar rapida. |
| **Loading** | Skeleton cards (Container grigi con shimmer). |
| **Error (rete)** | Banner giallo in alto: "dati non disponibili — ultimo aggiornamento: 03/06 06:00". Dati cached visibili sotto. |
| **Empty (primo accesso)** | Messaggio: "nessun dato disponibile. Contatta un amministratore." |
| **AD offline banner** | Se GET /api/health riporta `ldap.connected: false` → banner arancione persistente: "directory non aggiornata — dati in cache". |

### 3. Timetable Screen

| Stato | Comportamento |
|-------|---------------|
| **Default** | Dropdown/tabs per selezionare tipo (classe/aula/docente), poi ricerca/lista risorse. Dopo selezione → PNG timetable. |
| **Loading immagine** | Placeholder grigio con CircularProgressIndicator. `cached_network_image` con `placeholder()` e `errorWidget()`. |
| **Error (immagine non trovata)** | Icona `broken_image` + testo "orario non disponibile per questa risorsa". |
| **Empty (nessuna risorsa)** | Messaggio: "nessuna classe/aule/docente trovata". |
| **Zoom/Pinch** | `InteractiveViewer` wrappa l'immagine PNG. `minScale: 1.0`, `maxScale: 4.0`. Pan abilitato. |
| **Day switching** | Non implementato per ora — le immagini PNG sono statiche (orario settimanale). Se in futuro vengono parsati i dati orari, aggiungere tab/stepper per giorno della settimana. |
| **Offline** | Immagini cached via `cached_network_image` sopravvivono offline. Banner "dati offline" se health check fallisce. |

### 4. Directory Screen

| Stato | Comportamento |
|-------|---------------|
| **Default** | SearchBar in alto (TextField con icona search). Sotto: lista risultati paginata (20 per pagina). |
| **Search input** | Invio automatico dopo 300ms di inattività (debounce). Minimo 2 caratteri. |
| **Loading risultati** | Shimmer list (3-4 placeholder items). |
| **Results** | ListTile con avatar (iniziali), nome, ruolo (chip colorato: blu=student, verde=teacher, grigio=staff). Tap → detail. |
| **Empty (nessun risultato)** | Icona `search_off` + "nessun risultato per '{query}'". |
| **Error** | SnackBar errore + tasto retry. |
| **Pagination** | Scroll infinito: quando si arriva in fondo → carica prossima pagina. Loading indicator in fondo. |
| **Student restriction** | Se caller è student, il tab/opzione "Studenti" è nascosto. |

### 5. Person Detail Screen

| Stato | Comportamento |
|-------|---------------|
| **Teacher** | Nome, dipartimento, email. Se `teacher_resource_code` esiste: bottone "Vedi orario" → naviga a timetable con quel docente già selezionato. |
| **Student (visto da teacher/staff)** | Nome, classe, email. |
| **Staff** | Nome, dipartimento, email. |
| **Loading** | Skeleton: avatar cerchio + 3 linee di testo. |
| **Error** | "impossibile caricare i dettagli". |

### 6. Substitutions Screen

| Stato | Comportamento |
|-------|---------------|
| **Default** | Data picker (default: oggi). Lista sostituzioni raggruppate per ora. |
| **Loading** | Shimmer list. |
| **Empty (nessuna sostituzione oggi)** | Icona `event_busy` + "nessuna sostituzione per oggi". |
| **Empty (nessuna in cache, offline)** | "dati non disponibili — connettiti per aggiornare". |
| **Admin: upload** | FAB con icona upload. Apre file picker → invia a backend. SnackBar con risultato ("importate 15 sostituzioni, 2 saltate"). |

---

## Catalogo Variabili d'Ambiente

### Backend (`.env`)

```env
# Obbligatorie
NTLM_USER=sFORNARI14                       # service account AD (dominio ITIS)
NTLM_PASS=***                              # password account
NTLM_DOMAIN=ITIS                           # dominio NTLM per IIS
LDAP_URL=ldap://192.168.64.26:389          # URL LDAP (con STARTTLS)
LDAP_BASE_DN=DC=itis,DC=pr,DC=it           # base DN per query
JWT_SECRET=<generato con crypto.randomBytes(32).toString('hex')>
JWT_EXPIRES_IN=8h                          # durata token (default 8h)

# Opzionali (con default)
PORT=3000                                  # porta backend
NODE_ENV=development                       # 'development' | 'production'
CACHE_DIR=./cache                          # directory cache immagini
UPLOAD_DIR=./uploads                       # directory upload sostituzioni
DB_PATH=./data/scholtree.db                # percorso SQLite
ADMIN_USER=admin                           # username admin seed
ADMIN_PASS=***                             # password admin seed

# Solo produzione
API_BASE_URL=https://scholtree.example.com # URL pubblico backend
```

### Flutter (`--dart-define`)

```bash
flutter run --dart-define=API_BASE_URL=http://localhost:3000
flutter build apk --dart-define=API_BASE_URL=https://scholtree.example.com
```

Il client legge `API_BASE_URL` via `String.fromEnvironment('API_BASE_URL')`. In produzione DEVE essere `https://`.

---

## Test Strategy

### Backend (Jest + Supertest)

```
backend/
├── src/
│   └── __tests__/
│       ├── scrapers/
│       │   └── parse-ressource.test.ts    # Regex parser con fixture JS reali
│       ├── routes/
│       │   ├── auth.test.ts               # Login LDAP + bcrypt fallback + 401
│       │   ├── timetable.test.ts          # Proxy PNG + path traversal
│       │   └── directory.test.ts          # Search + paginazione + restrizione studenti
│       ├── services/
│       │   └── ldap.service.test.ts       # Mock LDAP server (ldapjs createServer)
│       └── middleware/
│           ├── authenticate.test.ts       # JWT verify + expired + missing
│           └── require-role.test.ts       # 403 per ruolo sbagliato
```

**Comandi**: `npm test` (Jest), `npm run test:coverage` (coverage)

**Cosa testare**:
- Parser JS: input con `new Ressource(...)` valido → output corretto. Input malformato → errore, mai eval.
- Auth: login con credenziali valide → 200 + JWT. Login con credenziali sbagliate → 401. Login con LDAP down + utente in DB → 200 (bcrypt fallback).
- Timetable: richiesta `image/class/../.env` → 400. `image/class/c0000001` → 200 + image/png.
- Directory: `search?q=a` → 400 (min 2 chars). `search?q=rossi&role=student` con caller student → 403.
- Rate limiting: 6 login in 15min → 429.

### Flutter (flutter_test + Mocktail)

```
lib/
└── test/
    ├── core/
    │   ├── api/
    │   │   └── client_test.dart           # Dio interceptor: aggiunge Bearer, gestisce 401
    │   └── auth/
    │       └── auth_provider_test.dart     # Provider: login, logout, token persist
    └── features/
        ├── timetable/
        │   └── timetable_provider_test.dart
        └── directory/
            └── directory_provider_test.dart
```

**Comandi**: `flutter test`

**Cosa testare**:
- Auth provider: stato iniziale = non autenticato. Login OK → stato autenticato, token salvato. Token scaduto → stato non autenticato, redirect a login.
- Dio interceptor: richiesta senza token → nessun header. Richiesta con token → `Authorization: Bearer <token>`. Risposta 401 → logout automatico.
- Widget: LoginScreen mostra form. Pulsante premuto con campi vuoti → validation error. Pulsante premuto con credenziali → loading state.

---

## Fasi Implementazione

### PRECONDIZIONI (prima di scrivere codice)
- [ ] `.gitignore`: `.env`, `*.auth`, `backend/node_modules/`, `backend/dist/`, `backend/cache/`, `backend/uploads/`, `backend/data/`
- [ ] `.env.example` backend committato (template sopra)
- [ ] `backend/` directory scaffold con `package.json`, `tsconfig.json`, `knexfile.ts`
- [ ] Knex migration `001_initial.ts` con schema SQL completo (tutte le tabelle, index, vincoli)
- [ ] Knex seed `001_admin.ts` che crea utente admin da `ADMIN_USER`/`ADMIN_PASS` env vars
- [ ] Struttura backend creata: `src/routes/`, `src/services/`, `src/db/`, `src/scrapers/`, `src/middleware/`, `src/types/`
- [ ] Flutter `pubspec.yaml` aggiornato con dipendenze (vedi sotto)

### Fase 1 — Backend core: scraper pubblico + API base
**Obiettivo**: backend che scrapa dati pubblici e serve API di lettura.

- [ ] Express + TypeScript + better-sqlite3 configurati
- [ ] Knex migrate → DB creato con tutte le tabelle
- [ ] Regex parser per `_ressource.js`, `_periode.js`, `_grille.js` — **mai eval/vm**
- [ ] Scraper pubblico: fetch → parse → INSERT OR REPLACE in resources
- [ ] Cache immagini PNG su disco (`./cache/img/{type}/{code}.png`)
- [ ] `GET /api/health` con stato base
- [ ] `GET /api/classes`, `GET /api/rooms` con paginazione
- [ ] `GET /api/timetable/image/:type/:code` con proxy da disco + path traversal protection
- [ ] `GET /api/timetable/meta/:type/:code`
- [ ] `GET /api/search?q=` con validazione (min 2 chars) + paginazione
- [ ] Rate limiting su auth (5 tentativi/15min) — applicato anche se auth non ancora implementato
- [ ] Jest test: parser regex, route timetable, route search
- [ ] `Dockerfile` + `docker-compose.yml` funzionanti

### Fase 2 — Auth + LDAP + orario riservato
**Obiettivo**: login funzionante, sync AD, dati docenti.

- [ ] `POST /api/auth/login` con flow: LDAP bind → bcrypt cache → JWT
- [ ] `GET /api/auth/me` da JWT
- [ ] `src/middleware/authenticate.ts`: verify JWT, popola `req.user`
- [ ] `src/middleware/require-role.ts`: gate per ruoli
- [ ] `JWT_SECRET` validazione a startup (min 32 chars)
- [ ] `src/services/ldap.service.ts`: `createLdapClient()` con STARTTLS, `bindUser(uid, password)`
- [ ] `POST /api/ldap/sync`: admin only, rate limit 1/h, sync AD→DB
- [ ] `GET /api/ldap/status`: stato connessione + conteggi
- [ ] `GET /api/ldap/search`: ricerca in DB locale con restrizione studenti
- [ ] `GET /api/teachers` con paginazione
- [ ] `GET /api/users/:id` con restrizione ruoli
- [ ] Scraper riservato: NTLM fetch → parse → resources + timetable_images
- [ ] Teacher cross-ref automatico: normalizza cognome, match in users, `teacher_map` INSERT
- [ ] `GET /api/admin/teacher-map`, `PUT /api/admin/teacher-map/:code`
- [ ] Jest test: login flow (LDAP ok, LDAP down + bcrypt, credenziali errate), middleware auth, restrizione studenti

### Fase 3 — Flutter base
**Obiettivo**: app mobile/desktop con auth, navigazione, timetable base.

- [ ] `pubspec.yaml` con dipendenze esatte:
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
    mocktail: ^1.0.4
  ```
- [ ] `main.dart`: ProviderScope + `app.dart`
- [ ] `app.dart`: MaterialApp.router con GoRouter, tema Material 3
- [ ] `core/api/client.dart`: Dio con `API_BASE_URL`, timeout 10s, JWT interceptor
- [ ] `core/api/auth_api.dart`: `login()`, `getMe()`
- [ ] `core/api/data_api.dart`: `getClasses()`, `getRooms()`, `getTimetableImageUrl()`, `search()`
- [ ] `core/auth/auth_provider.dart`: authStateProvider (AsyncNotifier: login, logout, token persist)
- [ ] `core/auth/token_storage.dart`: flutter_secure_storage wrapper
- [ ] `core/router/app_router.dart`: GoRouter con redirect auth
- [ ] `features/login/login_screen.dart`: form, validazione, stati (default/loading/error)
- [ ] `features/home/home_screen.dart`: BottomNavigationBar (3 tab: Orario, Rubrica, Sostituzioni)
- [ ] `features/timetable/timetable_screen.dart`: dropdown classe/aula/docente + ImageView
- [ ] `features/timetable/timetable_image_view.dart`: InteractiveViewer (zoom/pinch)
- [ ] `core/widgets/loading_widget.dart`, `error_widget.dart`, `empty_widget.dart`, `offline_banner.dart`
- [ ] Flutter test: auth provider, Dio interceptor

### Fase 4 — Rubrica
**Obiettivo**: ricerca e dettaglio persone.

- [ ] `features/directory/directory_screen.dart`: SearchBar con debounce 300ms, lista paginata
- [ ] `features/directory/person_detail_screen.dart`: profilo + link orario docente
- [ ] `features/directory/directory_provider.dart`: AsyncNotifier per ricerca + paginazione scroll infinito
- [ ] Stati per ogni schermata: loading (shimmer), empty, error
- [ ] Restrizione studenti: tab "Studenti" nascosto per caller studente
- [ ] Flutter test: directory provider, search debounce

### Fase 5 — Sostituzioni
**Obiettivo**: upload, visualizzazione, integrazione dashboard.

- [ ] `POST /api/substitutions/upload` con multer validation (CSV/XLSX/PDF, max 2MB, UUID filename)
- [ ] CSV parser: header detection (data, ora_inizio, ora_fine, docente, classe, materia, aula, note)
- [ ] XLSX parser (libreria `xlsx`): stesso schema
- [ ] Dedup upload: hash file → skip se già processato
- [ ] `GET /api/substitutions?date=` con paginazione
- [ ] `GET /api/substitutions/today`
- [ ] `features/substitutions/substitutions_screen.dart`: DatePicker + lista raggruppata per ora
- [ ] Admin: FAB upload → file picker → invio → feedback
- [ ] Dashboard home: card "Sostituzioni oggi" con conteggio
- [ ] Flutter test: substitutions provider

### Fase 6 — Produzione
**Obiettivo**: deploy sicuro, monitorato, manutenibile.

- [ ] nginx reverse proxy con HTTPS (Let's Encrypt), redirect HTTP→HTTPS
- [ ] `docker-compose.yml` produzione (backend + nginx)
- [ ] systemd per VPN con `Restart=always`
- [ ] Cron scraper: signature check ogni 30min, full scrape ogni 6h se cambiato
- [ ] Cron LDAP sync: giornaliero alle 3:00
- [ ] Scrape retry: 5 minuti dopo fallimento, max 3 retry
- [ ] `GET /api/health` completo: stato VPN, LDAP, ultimo scrape pubblico/privato, conteggi DB
- [ ] Flutter: polling `GET /api/health` ogni 5 min → banner "AD offline — dati in cache" se down
- [ ] Flutter: `cached_network_image` con TTL 24h per immagini orario
- [ ] `POST /api/admin/new-school-year?year=`: archive + resync
- [ ] Endpoint admin: `POST /api/admin/scrape` (trigger manuale)
- [ ] Startup warning se data > 2026-07-15 (service account expiry)
- [ ] Build APK release: `flutter build apk --dart-define=API_BASE_URL=https://...`

---

## Rischi e Note

1. **Firewall WatchGuard**: Solo porte 53 (DNS), 389 (LDAP), 9389 (ADWS) aperte dal VPN. LDAPS, Kerberos, SMB, GC bloccati. Per LDAP sicuro usare STARTTLS su 389.
2. **NTLM su IIS**: `httpntlm` (Node.js) funzionante con service account. Dominio = `ITIS`.
3. **Formato JS non JSON**: I file `_ressource.js` usano costruttori JS (`new Ressource(...)`) → parsing via regex SOLO. Mai `vm.Script` o `eval` — esegue codice arbitrario nel backend.
4. **Sostituzioni**: Formato file TBD dalla scuola. ⚠️ Ottenere campione prima di Fase 5.
5. **Immagini orario**: Sono PNG bitmap, non dati strutturati. OCR non necessario — visualizzazione diretta. Le immagini sono aggiornate dalla scuola; lo scraper le ricache-à periodicamente.
6. **VPN duplicata**: Riavvio VPN necessario se si accumulano processi openvpn. `sudo killall -9 openvpn` prima di riavviare.
7. **LDAP senza SSL**: La scuola non espone LDAPS (636). Usare STARTTLS su 389. Se STARTTLS fallisce, loggare WARN e cadere in dev mode — mai in produzione.
8. **Service account expiry**: L'account dev scade a giugno 2026. Richiedere account servizio dedicato a `helpdesk@itis.pr.it`. Startup warning automatico dopo la data.
9. **Regex > eval**: Usare regex per parsare i JS della scuola. `vm.Script` = RCE. Se il formato JS cambia, il regex fallisce con errore esplicito — preferibile a un exploit silenzioso.
10. **Offline mode**: Senza VPN, login funziona solo per utenti già in cache (con password_hash). Dati timetable e directory sono gli ultimi scaricati. Flutter mostra banner "dati offline". Non è un vero offline-first — è una degraded mode.
11. **Scaling**: 1311 utenti, 460 risorse, ~215 immagini PNG. SQLite regge senza problemi a questa scala. Paginazione (limit/offset) su tutte le API. Immagini servite da disco (nginx può cache-are).
12. **School year transition**: Durante il reset annuale (giugno/settembre), le vecchie risorse restano nel DB con `active=false`. Il nuovo anno scolastico popola nuove righe con `school_year` aggiornato. L'UX per l'utente: un giorno vede l'orario vecchio, il giorno dopo (dopo sync admin) vede il nuovo. Nessuna finestra di "anno scolastico non disponibile".
13. **Push notifications**: Non implementate. Le sostituzioni vengono consultate on-demand. Se in futuro serve notifiche per nuove sostituzioni, integrare Firebase Cloud Messaging (FCM) nel backend + Flutter.

---

## Linee Guida Implementazione

Ogni punto va risolto PRIMA della fase corrispondente, non dopo.

### 🔴 CRITICAL — risolvere prima di qualsiasi commit

| ID | Cosa | Come |
|----|------|------|
| C1 | Credenziali in git | PLAN.md/CLAUDE.md usano `${NTLM_USER}` / `${NTLM_PASS}`. `.env` in `.gitignore`. |
| C2 | Account studente come service | Richiedere `svc_scholtree` a `helpdesk@itis.pr.it`. Startup warning dopo July 2026. |
| C3 | LDAP non cifrato | `ldapjs` con `client.starttls()`. Se fallisce → warn + dev fallback. |
| C4 | `vm.Script`/eval per JS | Regex-only: `/new\s+Ressource\s*\(([^)]+)\)/g`. Mai eval. |
| C5 | `/api/ldap/sync` senza auth | `authenticate` + `requireRole('admin')` + rate limit 1/h. |
| C6 | `admin` ruolo mancante | `CHECK(role IN ('student','teacher','staff','admin'))`. Seed da env vars. |
| C7 | Upload file senza validazione | Multer: CSV/XLSX/PDF, max 2MB, UUID filename, storage `./uploads/`. |

### 🟠 HIGH — risolvere prima di Phase 2

| ID | Cosa | Come |
|----|------|------|
| H1 | BLOB in SQLite | `cache_path TEXT`. PNG su disco. Proxy via endpoint. |
| H2 | JWT secret debole | `crypto.randomBytes(32).toString('hex')` in `.env`. Validato a startup (min 32 chars). |
| H3 | VPN single point of failure | systemd `Restart=always`. `isLdapReachable()` health check. Bcrypt cached-hash login. |
| H4 | Studenti vedono altri studenti | `if (caller.role==='student' && target.role==='student') → 403`. Tab nascosto in Flutter. |
| H5 | Nessuna migration strategy | Knex. `001_initial.ts` con schema completo. Mai `ALTER TABLE` in app code. |
| H6 | Service account expiry | Startup warning. Documentato in README e CLAUDE.md. |

### 🟡 MEDIUM — risolvere per fase corrispondente

| ID | Cosa | Fase | Come |
|----|------|------|------|
| M1 | Rate limiting | 1 | `express-rate-limit`: auth=5/15min, sync=1/h. |
| M2 | Paginazione | 1 | Tutte le collection: `?limit=50&offset=0`, max 200. |
| M3 | Signature check | 1 | Poll `_signature.js` ogni 30min. Full scrape solo se cambiato. |
| M4 | Image storage | 1 | Disco (`./cache/img/{type}/{code}.png`). Mai BLOB. |
| M5 | Flutter deps | 3 | `pubspec.yaml` con versioni esatte. |
| M6 | JWT storage Flutter | 3 | `flutter_secure_storage` (Keystore/Keychain/libsecret). Mai SharedPreferences. |
| M7 | Struttura backend | pre-1 | `src/routes/ services/ db/ scrapers/ middleware/ types/`. |
| M9 | Cross-ref teacher | 2 | `teacher_map` table. Match cognome normalizzato. Admin correction endpoint. |
| M10 | HTTPS | 6 | nginx + Let's Encrypt. Flutter `API_BASE_URL=https://`. |
| M11 | Cron failure | 1 | `scrape_log` con status+errors. Retry 5min. `GET /api/health`. |
| M12 | School year reset | 6 | `school_year` column. `POST /api/admin/new-school-year`. |

### 🟢 LOW

| ID | Cosa | Fix |
|----|------|-----|
| L1 | Path traversal | Allowlist `['class','room','teacher']`. Sanitize code: `/[^a-zA-Z0-9_-]/g`. |
| L2 | Tabella polimorfica | `INDEX(type, code)` + `school_year` per filtro rapido. |
| L3 | No UNIQUE substitutions | `UNIQUE(date, hour_start, teacher_id, class_id)`. Hash check su upload per dedup. |
| L4 | JWT role stale | 8h expiry ok (giornata scolastica). Refresh token non necessario a questa scala. |
| L5 | pubspec.yaml default | Aggiornato in Fase 3. |

---

## Dipendenze Backend

```json
{
  "dependencies": {
    "express": "^4.21.0",
    "better-sqlite3": "^11.6.0",
    "knex": "^3.1.0",
    "ldapjs": "^3.0.7",
    "httpntlm": "^1.7.7",
    "node-cron": "^3.0.3",
    "multer": "^1.4.5-lts.1",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "express-rate-limit": "^7.4.1",
    "uuid": "^10.0.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/better-sqlite3": "^7.6.12",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/bcrypt": "^5.0.2",
    "@types/multer": "^1.4.12",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.6.0",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "supertest": "^7.0.0",
    "@types/jest": "^29.5.0",
    "@types/supertest": "^6.0.2"
  }
}
```
