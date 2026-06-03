# Scholtree — Claude Code Multi-Agent Workflow

## Topology

```
                   ┌─── Human gates (C2, M8, H6) ──────────────────┐
                   ▼                                                 │
  Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
      │          │         │         │         │         │         │
     DoD      scraper    auth+     flutter   rubrica   sostit.  deploy
    gate      + API      LDAP       base      +dir     + upload   + CI
                         ↑                              ↑
              C2 unblocks here               M8 unblocks here
```

**Parallel agents**: always pass `isolation: "worktree"` to prevent file collisions.
**Review loop**: `code-reviewer` finds issue → `cavecrew-builder` fixes → re-review. Never merge on first pass.
**TDD**: `qa` skill runs red→green loop *before* marking a route done, not after the phase.

---

## Phase 0 — Pre-Coding Gate

```
Gate-in:  flaws.md exists, DoD checklist read
Parallel: none (sequential only, no code written yet)
Sequence:
  1. Plan agent          → validates 18 DoD items are all ticked
  2. cso skill           → confirms no credentials in git history (C1 resolved)
  3. code-architect      → validates backend M7 scaffold exists before any code
Skills:   /cso (comprehensive mode), make-plan if any open items
QA:       git log --all -S 'Scuola2026' → must return empty
Gate-out: all DoD checkboxes ✅; .gitignore covers .env; .env.example committed
```

---

## Phase 1 — Backend Core: Scraper + API

```
Gate-in:  Phase 0 ✅; backend/ scaffold created
Parallel: (worktree)
  A: cavecrew-builder  → src/db/migrations/001_initial.ts + knexfile.ts
  B: cavecrew-builder  → package.json + tsconfig.json + src/index.ts + src/config.ts
     (config.ts: JWT_SECRET length check, startup expiry warning)
Sequence:
  3. cavecrew-builder   → src/scrapers/parse-ressource.ts (regex only, C4)
  4. cavecrew-builder   → src/scrapers/public-scraper.ts (signature check, M3)
  5. cavecrew-builder   → src/routes/timetable.ts (path traversal guard L1)
  6. cavecrew-builder   → src/routes/directory.ts (pagination M2)
  7. cavecrew-builder   → src/services/health.ts + GET /api/health
  8. qa skill           → red→green: parse-ressource.test.ts, timetable.test.ts
  9. cso skill          → scraper + routes audit (regex safe, no eval)
 10. code-reviewer      → diff review; fix loop if findings > 0
Skills:   /qa (standard), /cso (8/10 gate), context7 for express/knex APIs
QA:       npm test green; GET /api/classes paginates; image path traversal blocked
Gate-out: npm test ✅; Docker builds; GET /api/health 200
```

---

## Phase 2 — Auth + LDAP + Reserved Timetable

```
Gate-in:  Phase 1 ✅; ⚠ HUMAN GATE C2: svc_scholtree account from IT
Parallel: (worktree)
  A: cavecrew-builder  → src/services/ldap.service.ts (STARTTLS, C3)
  B: cavecrew-builder  → src/middleware/authenticate.ts + require-role.ts (C5/C6)
                          + src/routes/auth.ts (login flow, bcrypt cache, H2)
Sequence:
  3. cavecrew-builder   → src/services/ntlm.service.ts
  4. cavecrew-builder   → src/scrapers/private-scraper.ts (NTLM → grProf parse)
  5. cavecrew-builder   → teacher cross-ref: teacher_map INSERT (M9, confidence auto/manual)
  6. cavecrew-builder   → src/routes/ldap.ts (sync admin-only M1 rate-limit, H4 student guard)
  7. qa skill           → red→green: auth.test.ts (LDAP ok / LDAP down / wrong creds)
                          ldap.service.test.ts (mock ldapjs server)
                          require-role.test.ts (403 cases)
  8. cso skill          → auth flow audit: JWT, bcrypt, STARTTLS, role enforcement
  9. code-reviewer      → diff review + fix loop
Skills:   /qa (standard), /cso, context7 for ldapjs/httpntlm/jsonwebtoken
QA:       login works (LDAP + bcrypt fallback); 403 on admin routes; teacher-map populated
Gate-out: npm test ✅; LDAP bind succeeds over STARTTLS; GET /api/auth/me 200
```

---

## Phase 3 — Flutter Base

```
Gate-in:  Phase 2 ✅; flutter pub get clean
Parallel: (worktree)
  A: design-system-architect  → core/theme/theme.dart (Material 3, color scheme)
  B: cavecrew-builder         → core/api/ (client.dart Dio+interceptor, auth_api.dart, data_api.dart)
  C: cavecrew-builder         → core/auth/ (auth_provider.dart, token_storage.dart M6, auth_interceptor.dart)
Sequence:
  4. cavecrew-builder   → core/router/app_router.dart (GoRouter + auth redirect)
  5. cavecrew-builder   → main.dart + app.dart (ProviderScope + MaterialApp.router)
  6. cavecrew-builder   → features/login/login_screen.dart (form + all states)
  7. cavecrew-builder   → features/home/home_screen.dart + BottomNavigationBar (ShellRoute)
  8. cavecrew-builder   → features/timetable/* (screen + InteractiveViewer + provider)
  9. cavecrew-builder   → core/widgets/* (4: loading, error, empty, offline_banner)
 10. qa skill           → flutter test: auth_provider_test, client_test
 11. browse skill       → login form, nav transitions, timetable zoom/pinch
 12. code-reviewer      → diff review + fix loop
Skills:   /qa, browse, context7 for flutter_riverpod/go_router/dio/flutter_secure_storage
QA:       flutter analyze 0 issues; login → home → timetable golden path works
Gate-out: flutter test ✅; flutter analyze ✅; offline banner shows when health down
```

---

## Phase 4 — Directory (Rubrica)

```
Gate-in:  Phase 3 ✅
Sequence:
  1. ui-designer        → directory_screen.dart mockup (SearchBar + shimmer + roles)
                          person_detail_screen.dart mockup (teacher link to timetable)
  2. cavecrew-builder   → features/directory/directory_provider.dart
                          (debounce 300ms, infinite scroll, student restriction H4)
  3. cavecrew-builder   → features/directory/directory_screen.dart
  4. cavecrew-builder   → features/directory/person_detail_screen.dart
  5. qa skill           → directory_provider_test, search debounce test
  6. browse skill       → search min-2-chars gate, scroll pagination, student→403
  7. code-reviewer      → diff review + fix loop
Skills:   /qa, browse
QA:       student caller cannot see student tab; teacher detail shows timetable link
Gate-out: flutter test ✅; browse smoke ✅
```

---

## Phase 5 — Sostituzioni

```
Gate-in:  Phase 4 ✅; ⚠ HUMAN GATE M8: sample file from segreteria committed to
          backend/samples/sostituzioni_sample.*
Sequence:
  1. Explore agent      → analyze sample file schema → inform parser design
  2. cavecrew-builder   → CSV/XLSX parser + hash dedup (backend/src/scrapers/subst-parser.ts)
  3. cavecrew-builder   → routes/substitutions.ts (upload C7 multer, GET /today, GET ?date=)
  4. cavecrew-builder   → features/substitutions/* (screen + provider + substitution_card.dart)
  5. cavecrew-builder   → home dashboard card "Sostituzioni oggi"
  6. qa skill           → red→green: upload.test.ts (MIME reject, dedup, parse against sample)
  7. browse skill       → admin FAB upload, date picker, list grouped by hour
  8. cso skill          → file upload audit (multer: UUID names, MIME check, 2MB cap, path)
  9. code-reviewer      → diff review + fix loop
Skills:   /qa (standard), /cso, browse
QA:       upload imports sample; identical re-upload skipped; student view reads correctly
Gate-out: npm test ✅; flutter test ✅; upload rejects PDF with wrong MIME
```

---

## Phase 6 — Production

```
Gate-in:  Phase 5 ✅; domain name set; server SSH access confirmed
Parallel: (worktree)
  A: cavecrew-builder  → Dockerfile + docker-compose.yml (prod: backend + nginx)
  B: cavecrew-builder  → nginx.conf (HTTPS M10, Let's Encrypt, HTTP→HTTPS redirect)
Sequence:
  3. cavecrew-builder   → systemd VPN unit (Restart=always, H3)
  4. cavecrew-builder   → cron config (signature check 30min, full scrape 6h, LDAP 3:00)
  5. cavecrew-builder   → retry logic in scrapers (5min, max 3, M11)
  6. cavecrew-builder   → POST /api/admin/new-school-year (M12)
  7. cavecrew-builder   → startup expiry warning (H6: warn after 2026-07-15)
  8. browse skill       → end-to-end smoke on staging (login → timetable → directory → sostit)
  9. cso skill          → final comprehensive audit (must score ≥ 8/10)
 10. cavecrew-reviewer  → release review of full diff
 11. flutter build apk --dart-define=API_BASE_URL=https://...
Skills:   browse (smoke), /cso (comprehensive 2/10 gate), /caveman-commit
QA:       GET /api/health all fields green; APK installs; HTTPS forced; no HTTP plaintext
Gate-out: cso ≥ 8/10 ✅; health all green ✅; APK signed ✅
```

---

## Cross-Cutting Agents (every phase)

| Agent / Skill | When | Notes |
|---|---|---|
| `cavecrew-reviewer` | per PR, before merge | one-line findings, severity-tagged |
| `cso` skill | Phase 1, 2, 5, 6 boundaries | 8/10 gate minimum; final Phase 6 = comprehensive |
| `error-diagnostics:debugger` | any test failure | invoke immediately, don't guess |
| `error-diagnostics:error-detective` | production log anomaly | correlate across scrape_log + stderr |
| `caveman-commit` skill | every commit | ≤50 char message |
| `context7` MCP | unfamiliar API | ldapjs, httpntlm, go_router, flutter_secure_storage |
| `codegraph` | pre-refactor | impact analysis before any cross-file change |
| `Explore` agent | before new feature | map existing code before adding to it |

---

## Human Gates (unblockable by agents)

| Gate | Blocks | Action required | Contact | Deadline |
|---|---|---|---|---|
| C2: service account | Phase 2 start | Request `svc_scholtree` read-only OU=Utenti + NTLM | helpdesk@itis.pr.it | Before Phase 2 |
| M8: substitution sample | Phase 5 start | Get real file, commit to `backend/samples/` | segreteria@itis.pr.it | Before Phase 5 |
| H6: account expiry | Phase 2–6 uptime | Rotate .env after IT responds; if no svc acct, write handoff README | helpdesk@itis.pr.it | Before 2026-07-15 |
| Phase 6: server | Phase 6 start | SSH access + domain DNS pointing to server | self/sysadmin | Before Phase 6 |
