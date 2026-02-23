# clv-punch-gem — Auto Punch Dashboard

Hệ thống tự động check-in/check-out cho **Cyberlogitec Blueprint**, với dashboard web quản lý và GitHub Actions automation.

---

## ✨ Features

- **Auto Punch via GitHub Actions** — tự động punch AM/PM theo lịch
- **Swap Work Mode** — đổi WFH ↔ Văn Phòng cho ngày cụ thể (multi-select)
- **Settings** — cấu hình lịch tuần, giờ punch, Telegram, bật/tắt hệ thống
- **History** — lịch sử punch với filter, export CSV/JSON
- **PWA** — cài được lên home screen, offline support
- **Google Chat / Telegram** — thông báo khi swap, punch thành công/thất bại

---

## 🏗️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS, Tailwind CSS (CDN), Lucide Icons |
| Backend API | Vercel Serverless Functions (`api/*.js`) |
| Database | **Vercel KV** (Upstash Redis) for config cache; **Turso** (LibSQL/SQLite) for persistent swap history |
| Automation | GitHub Actions (`wfh-punch.yml`) |
| Dev server | Node.js custom (`server/dev.js`) |
| Tests | Playwright |

---

## 🗄️ Database

### Vercel KV (Redis) — Config cache

Vercel KV stores runtime config and short-lived day state.
Swap overrides are cached here (30-day TTL) but the source of truth is Turso.

```
punch:config:isEnabled              → boolean
punch:config:schedule               → { "0":"off","1":"wfh","2":"wio",... }
punch:config:telegram               → { chatId, token }
punch:config:times                  → { am:"08:30", pm:"20:00" }
punch:day:{YYYY-MM-DD}:off          → true  (TTL 3 days)
punch:day:{YYYY-MM-DD}:am           → { status, recordedPunchTime, ... }  (TTL 3 days)
punch:day:{YYYY-MM-DD}:pm           → { status, ... }  (TTL 3 days)
punch:day:{YYYY-MM-DD}:mode_override → "wfh" | "wio"  (TTL 30 days, cache for Turso)
```

### Turso (LibSQL/SQLite) — Persistent swap history

Turso stores swap overrides permanently and punch history.
Reads go to Turso first, falling back to KV if Turso is unavailable.

```sql
CREATE TABLE swap_overrides (
  date TEXT PRIMARY KEY,   -- YYYY-MM-DD
  mode TEXT NOT NULL,      -- 'wfh' | 'wio'
  created_at INTEGER,
  expires_at INTEGER
);

CREATE TABLE punch_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  period TEXT,             -- 'am' | 'pm'
  status TEXT,
  punch_time TEXT,
  created_at INTEGER
);
```

Module: `lib/db.js` — functions: `saveSwapOverride`, `getSwapOverride`, `getBulkSwapOverrides`, `listSwapHistory`, `savePunchResult`

### Env vars cần thiết

```env
PUNCH_SECRET=xxx               # password to call API from frontend
KV_REST_API_URL=xxx            # Vercel KV endpoint
KV_REST_API_TOKEN=xxx          # Vercel KV token (read/write)
KV_REST_API_READ_ONLY_TOKEN=xxx
KV_URL=xxx
REDIS_URL=xxx
TURSO_DATABASE_URL=libsql://...  # Turso LibSQL endpoint
TURSO_AUTH_TOKEN=...             # Turso auth token
GOOGLE_CHAT_WEBHOOK_URL=xxx    # optional — notifications
GITHUB_PAT=xxx                 # required production, optional local
TELEGRAM_BOT_TOKEN=xxx         # optional
```

---

## 🚀 Quick Start (Local Dev)

```bash
# 1. Clone
git clone https://github.com/duynguyen2626/clv-punch-gem.git
cd clv-punch-gem

# 2. Install
pnpm install    # hoặc npm install

# 3. Env
cp .env.example .env.local   # nếu có, hoặc tạo thủ công .env.local với các vars ở trên

# 4. Start dev server
npm run dev
# → http://localhost:3001
```

Dev server (`server/dev.js`) tự động:
- Bust `require.cache` cho `api/**` và `lib/**` sau mỗi request — không cần restart khi edit backend
- Serve `public/` static files
- Route `/api/*` → `api/*.js` handlers

---

## 📁 Project Structure

```
clv-punch-gem/
├── api/
│   ├── actions.js          POST /api/actions — swapDay, markDone, markOff, ...
│   ├── state.js            GET  /api/state — full day state (supports ?dates= bulk)
│   ├── history.js          GET  /api/history
│   ├── updates.js          POST /api/updates — enable/disable
│   ├── crons.js            Vercel cron handler (không chạy local)
│   └── state/report.js
├── lib/
│   ├── kv.js               KV helpers: getFullDayState, setDayModeOverride, ...
│   ├── db.js               Turso (LibSQL) persistent storage: swap overrides, punch history
│   ├── chat.js             Google Chat notifications
│   ├── mail.js
│   ├── telegram.js
│   └── time.js             Vietnam timezone utils
├── public/
│   ├── index.html          Entry point
│   ├── js/
│   │   ├── app-enhanced.js  Main UI (1300+ lines) — dashbboard, modals, routing
│   │   ├── api.js           API client (fetch wrappers)
│   │   ├── utils.js         Helpers
│   │   ├── charts.js        Chart rendering
│   │   └── app.js           Legacy (giữ lại, không dùng)
│   └── css/style.css
├── server/dev.js           Local dev server
├── tests/
│   └── cyberlogitec.spec.js  Playwright tests
└── vercel.json             Vercel config & cron schedule
```

---

## 🔌 API Reference

### `GET /api/state`
```
?secret=xxx                 → today's full state
?secret=xxx&date=YYYY-MM-DD → specific date
?secret=xxx&dates=d1,d2,d3  → bulk: returns { byDate: { [date]: { effectiveMode, modeOverride, scheduleMode, isOff } } }
```

### `POST /api/actions`
```json
{ "action": "swapDay",    "date": "YYYY-MM-DD", "toMode": "wfh" | "wio" }
{ "action": "markDone",   "period": "am" | "pm" }
{ "action": "markOff",    "date": "YYYY-MM-DD" }
{ "action": "clearOff",   "date": "YYYY-MM-DD" }
{ "action": "markWfhToday" }
```

### `POST /api/updates`
```json
{ "isEnabled": true | false }
```

### `GET /api/history`
```
?days=30&secret=xxx
```

---

## 🧪 Tests

```bash
# Start dev server trước
npm run dev &

# Chạy Playwright tests
npm test

# Hoặc với UI
npx playwright test --ui
```

Test file: `tests/cyberlogitec.spec.js`  
Playwright config: `playwright.config.js` (base URL: `http://localhost:3001`)

---

## 🌿 Branching

| Branch | Mô tả |
|---|---|
| `main` | Production |
| `chore/local-dev` | Current working branch (session 2026-02-23) |
| `feature/ui-ux-comprehensive-enhancement` | Previous UI overhaul |

---

## 📋 Known Issues & Roadmap

| Issue | Priority | Notes |
|---|---|---|
| `mode_override` KV TTL 30 days | Low | KV is now cache; Turso is source of truth |
| Swap history queryable | Done | `lib/db.js` — `listSwapHistory()` |
| GHA không trigger local | Low | Normal — needs `GITHUB_PAT` |
| Weekend swap chỉ cho là OFF | Low | Fixed: inline VP/WFH picker |

### Roadmap: Turso DB integration
Turso (LibSQL) added in `feat/persistent-swap-storage` branch.
`lib/db.js` provides persistent swap override storage.
KV remains for config keys (`isEnabled`, `schedule`, `telegram`, `times`) and as a cache layer for mode overrides.

---

## 🤝 Contributing

1. Fork → branch from `main`
2. `npm run dev` → develop
3. `npm test` → các tests phải pass
4. PR với description rõ ràng

---

*Last updated: 2026-02-23*
