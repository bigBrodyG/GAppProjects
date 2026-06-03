# Scholtree

Flutter (Riverpod) + Node.js (Express) app for ITIS L. da Vinci (Parma). Timetable, AD directory, substitution management.

## Commands

```bash
# Backend
npm init          # setup Node.js project in backend/
npm run dev       # ts-node-dev --respawn src/index.ts
npm run build     # tsc
npm start         # node dist/index.js

# Flutter
flutter pub get
flutter run -d linux
flutter build apk --debug
flutter analyze
flutter test

# AD / VPN
sudo openvpn --config /home/giordi/Documents/itis.ovpn --auth-user-pass /tmp/vpn.auth --daemon --log /tmp/vpn.log
```

## Data Sources

| Source | Access | Auth |
|--------|--------|------|
| `dati.itis.pr.it` (IIS 10) | HTTPS public + NTLM | `${NTLM_USER}` / `${NTLM_PASS}` (domain `ITIS`) |
| `orariodiurno/` | Public dir listing (403), individual files OK | none |
| `orariodiurnoriservata/` | Windows Integrated Auth | NTLM via `httpntlm` |
| AD LDAP `192.168.64.26:389` | VPN tun0, port 389 only | LDAP bind `${NTLM_USER}@itis.pr.it` |
| ADWS `192.168.64.26:9389` | VPN tun0, open | Same creds |
| DNS `192.168.64.25/26:53` | VPN tun0 | none |

**3 DCs**: srvdc01=192.168.64.26 (PDC), srvdc06=192.168.64.25, srvdc07=192.168.64.28
**dev account** = FORNARI GIORDANO, 4C2 student, email `sgiordano.fornari@itis.pr.it`
**⚠️ Service account expiry**: dev account disabled at graduation (June 2026). Request dedicated service account from `helpdesk@itis.pr.it`. If unavailable, app requires manual maintenance after June 2026.

**VPN**: WatchGuard SSL VPN, tun0=192.168.254.2/24, gateway 192.168.254.1
**Creds**: `${NTLM_USER}` / `${NTLM_PASS}`, auth file at `/tmp/vpn.auth`
**Kill duplicates**: `sudo killall -9 openvpn` then restart with `--config`

## Code Style (school project)

- **Variables**: abbreviated, no `specific_thing`. `n`, `lst`, `tot`, `ris`, `d` prefix for teachers, `s` for students, `r` for staff
- **Output**: lowercase, no filler strings, no capitals unless required
- **Error handling**: none unless asked. No try/except, no input validation
- **Comments**: ≤6 words, raw, one per non-obvious block
- **Libraries**: stdlib first, no reinventing

## Stack

- **Frontend**: Flutter (Riverpod, GoRouter, Dio, Material 3)
- **Backend**: Node.js Express (TypeScript, better-sqlite3, ldapjs, httpntlm, node-cron, multer, jsonwebtoken)
- **Data**: SQLite (cache dei dati scrapati)
- **Deploy**: Docker container, reverse proxy

## Project Plan

Full plan in `PLAN.md`. Phases:
1. Backend core: Express + SQLite + scraper orario pubblico + proxy PNG
2. Auth + LDAP: ldapjs sync AD→DB, NTLM timetable scraper, JWT login
3. Flutter base: Riverpod setup, login, home, bottom nav, timetable view
4. Rubrica: search + detail, teacher timetable integration
5. Sostituzioni: file upload, CRUD, current-day view, dashboard
6. Produzione: Docker deploy, Flutter APK, CI/CD

<!-- CODEGRAPH_START -->
## CodeGraph

CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Use for structural questions; use raw grep/read only for literal text.

| Question | Tool |
|---|---|
| Find symbol | `codegraph_search` |
| What calls X | `codegraph_callers` |
| What X calls | `codegraph_callees` |
| Flow X→Y | `codegraph_trace` |
| Impact of change | `codegraph_impact` |
| Symbol source | `codegraph_node` |
| Task context | `codegraph_context` (call FIRST) |
| Multiple sources | `codegraph_explore` |
| File tree | `codegraph_files` |
| Index health | `codegraph_status` |

**Rules**: Trust results (no re-verify with grep). Don't chain search+node — use `context` or `explore`. Check staleness banner for pending re-index.
<!-- CODEGRAPH_END -->

## Skills & MCPs — What to Use When

### Communication & Efficiency

| Skill | Trigger | Use |
|-------|---------|-----|
| **caveman** | `/caveman`, "caveman mode" | Ultra-compressed responses (lite/full/ultra). Cuts ~75% tokens. Default: full |
| **caveman-commit** | `/caveman-commit`, `/commit` | Ultra-compressed commit messages ≤50 chars |
| **caveman-review** | `/caveman-review`, `/review` | One-line compressed PR comments |

### Context Management

| Skill/Tool | Trigger | Use |
|------------|---------|-----|
| **context-mode** (plugin) | Auto-triggers for large outputs | `ctx_execute`/`ctx_execute_file` for processing data (bytes stay in sandbox). `ctx_batch_execute` for parallel commands + inline queries. `ctx_search` for cross-session memory recall |
| **ctx_stats** | `/ctx-stats` | Show token savings |
| **ctx-doctor** | `/ctx-doctor` | Diagnose context-mode |
| **ctx-purge** | `/ctx-purge` | Wipe knowledge base |

### Structured Code Exploration

| Tool | Use |
|------|-----|
| **smart-explore** | `smart_search`/`smart_outline`/`smart_unfold` — tree-sitter structural code search. Folded views, no full-file reads |
| **understand** (agent) | Full codebase → interactive knowledge graph. Use on first encounter or architecture questions |

### Web & API

| Tool | Use |
|------|-----|
| **browse** (skill) | Headless browser for QA testing, screenshots, form tests, element state assertions. ~100ms/command |
| **exa** (MCP) | `web_search_exa` + `web_fetch_exa` — clean markdown from any URL |
| **context7** (MCP) | `resolve-library-id` + `query-docs` — up-to-date docs for Flutter/Dart/Node/any library. ALWAYS check here before using unknown APIs |
| **webfetch** (native) | Fallback URL fetch |

### Debugging & QA

| Skill | Trigger | Use |
|-------|---------|-----|
| **investigate** | Bug/error/stack trace | Systematic 4-phase debugging: reproduce→minimise→hypothesise→instrument→fix. Iron Law: no fix without root cause |
| **diagnose** | `/diagnose`, hard bugs | Complex performance/bug diagnosis loop |
| **qa** | `/qa` | Full test-fix-verify cycle (Quick/Standard/Exhaustive) |
| **qa-only** | `/qa-only` | Report-only bug scan (no fixes) |
| **codex** | `/codex review\|challenge\|consult` | Independent diff review / adversarial testing / second opinion |

### Security

| Skill | Trigger | Use |
|-------|---------|-----|
| **cso** | `/cso` | Security audit: secrets, deps, supply chain, OWASP. Daily (8/10 gate) or Comprehensive (2/10) |
| **careful** | `/careful` | Guards against rm -rf, DROP TABLE, force-push, destructive commands |

### Planning & Review

| Skill | Trigger | Use |
|-------|---------|-----|
| **make-plan** | "make a plan" | Detailed phased implementation plan |
| **plan-ceo-review** | "/plan-ceo" | CEO-mode: rethink scope, find 10x product |
| **plan-eng-review** | "/plan-eng" | Architecture + edge cases + performance lock-in |
| **plan-design-review** | "/plan-design" | UI/UX design critique (before code) |
| **grill-me** | "/grill" | Relentless Q&A to stress-test a plan |

### Deployment & Release

| Skill | Use |
|-------|-----|
| **setup-deploy** | Configure deploy platform (Docker/Vercel/etc) |
| **land-and-deploy** | Merge PR + CI + deploy + canary |
| **document-release** | Post-ship doc sync (README, ARCHITECTURE, CHANGELOG) |

### Design (for UI work)

| Skill | Use |
|-------|-----|
| **design-consultation** | Full design system proposal (colors, fonts, layout, motion) |
| **design-html** | Production-grade HTML/CSS from mockups |
| **design-review** | Visual QA + fix loop with before/after screenshots |
| **emil-design-eng** | UI polish philosophy: animation, micro-interactions, feel |
| **ui-ux-pro-max** | 50+ styles, 161 palettes, 57 font pairings — Flutter included |

### Miscellaneous

| Tool | Use |
|------|-----|
| **mempalace** (MCP) | Cross-session memory: mempalace_search, mempalace_list_wings, etc. |
| **mcp-search** (MCP) | Claude-mem knowledge base: search, timeline, get_observations |
| **ssh-mcp** (MCP) | SSH to remote servers (docker hosts, etc.) |
| **checkpoint** | Save/resume state across sessions |

**Key**: Prefer `ctx_batch_execute(commands, queries)` over sequential Bash for 3+ commands. Prefer `smart_search`/`smart_outline` over full-file reads for code exploration. Prefer `context7` library docs before using unfamiliar Flutter/Dart/Node APIs.
