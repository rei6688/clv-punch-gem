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
| Database | **Vercel KV** (Upstash Redis) — xem chi tiết bên dưới |
| Automation | GitHub Actions (`wfh-punch.yml`) |
| Dev server | Node.js custom (`server/dev.js`) |
| Tests | Playwright |

---

## 🗄️ Database — Vercel KV (Redis)

Repo **KHÔNG dùng SQL**. State được lưu trong **Vercel KV** (Redis KV store via Upstash).

### Key schema

```
punch:config:isEnabled              → boolean
punch:config:schedule               → { "0":"off","1":"wfh","2":"wio",... }
punch:config:telegram               → { chatId, token }
punch:config:times                  → { am:"08:30", pm:"20:00" }
punch:day:{YYYY-MM-DD}:off          → true  (TTL 3 ngày)
punch:day:{YYYY-MM-DD}:am           → { status, recordedPunchTime, ... }  (TTL 3 ngày)
punch:day:{YYYY-MM-DD}:pm           → { status, ... }  (TTL 3 ngày)
punch:day:{YYYY-MM-DD}:mode_override → "wfh" | "wio"  (TTL 7 ngày) ⚠️
```

> ⚠️ `mode_override` có TTL 7 ngày — không phù hợp lưu override dài hạn.  
> Xem [HANDOVER_2026_02_23.md](HANDOVER_2026_02_23.md) để biết recommendation migrate sang Turso/Neon.

### Env vars cần thiết

```env
PUNCH_SECRET=xxx               # password để call API từ frontend
KV_REST_API_URL=xxx            # Vercel KV endpoint
KV_REST_API_TOKEN=xxx          # Vercel KV token (read/write)
KV_REST_API_READ_ONLY_TOKEN=xxx
KV_URL=xxx
REDIS_URL=xxx
GOOGLE_CHAT_WEBHOOK_URL=xxx    # optional — nhận thông báo swap/punch
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
| `mode_override` TTL 7 ngày | High | Cần persistent DB |
| Không có swap history | High | Cần DB với table `swap_overrides` |
| GHA không trigger local | Low | Bình thường — cần `GITHUB_PAT` |
| Weekend swap chỉ cho là OFF | Low | Đã fix: giờ có inline VP/WFH picker |

### Roadmap: Migrate to persistent DB
Xem chi tiết trong [HANDOVER_2026_02_23.md § Đề xuất DB](HANDOVER_2026_02_23.md).  
TL;DR: Dùng **Turso** (LibSQL, free 500 DB) hoặc **Neon** (Postgres, free 0.5GB).

---

## 🤝 Contributing

1. Fork → branch from `main`
2. `npm run dev` → develop
3. `npm test` → các tests phải pass
4. PR với description rõ ràng

---

*Last updated: 2026-02-23*
