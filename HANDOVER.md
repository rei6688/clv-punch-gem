# Handover Tasks

## Branch: `fix/revert-to-punch-secret`
## PR: #23 (https://github.com/duynguyen2626/clv-punch-gem/pull/23)

---

## Pending QA / Verification Items

### 1. Settings: Swap Overrides vs Default Schedule

**User report:** After swapping WIO > WFH for specific days (e.g., Mon/Thu/Fri), the Settings page appears to show the schedule as changed.

**What was implemented:**
- Swaps create **per-date overrides** via `setDayModeOverride()` -- they do NOT modify the default weekly schedule (`getSchedule()`).
- A new **"Active Swap Overrides"** section was added below the default schedule in Settings. It shows which dates have been overridden, what the default was, what it was swapped to, and a "Clear" button to remove each override.

**QA needed:**
- [ ] Verify the default weekly schedule (top section in Settings) remains unchanged after swapping days
- [ ] Verify the "Active Swap Overrides" section correctly lists swapped dates
- [ ] Verify clicking "Clear" on an override removes it and restores the default mode for that date
- [ ] Verify swaps do NOT affect future weeks -- only the specific dates that were swapped
- [ ] If the Settings UI still appears confusing (default schedule looks like it changed), consider adding a visual separator or label clarifying "This is your DEFAULT weekly schedule -- swaps are shown below"

**Key files:**
- `public/js/app-enhanced.js` -- `renderSettings()` function, "Active Swap Overrides" section
- `api/actions.js` -- `clearSwapOverride` action handler
- `lib/db.js` -- `deleteSwapOverride()` helper

---

### 2. Enhanced Calendar on Dashboard

**User report:** Calendar on dashboard was just colored dots with no real functionality.

**What was implemented:**
- **Mode badges** on each calendar day cell: **H** (WFH), **O** (Office), **OFF**
- Swapped days show a **dashed outline** on the badge
- **Click any day** to see a detail popup showing:
  - Day label + date (e.g., "T2 24/02/2026")
  - Mode (WFH / Office / OFF) with "(Swapped)" indicator if overridden
  - AM punch status + time (or "Not yet" / "No data")
  - PM punch status + time
- **Month navigation** re-fetches bulk state to show correct mode icons when switching months
- **Click outside** or click X to dismiss the popup

**QA needed:**
- [ ] Verify mode badges (H/O/OFF) display correctly for each day
- [ ] Verify swapped days show the dashed outline on the badge
- [ ] Verify clicking a day shows the detail popup with correct info
- [ ] Verify AM/PM punch status in popup matches actual punch history
- [ ] Verify navigating between months correctly refreshes mode badges
- [ ] Verify popup dismisses on click-outside or X button
- [ ] Test on mobile -- popup should be centered and responsive
- [ ] Consider adding more features per user request: reminders, off-day schedule, quick swap action from popup

**Key files:**
- `public/js/charts.js` -- `renderMiniCalendar()` with `bulkState` param and mode badges
- `public/js/app-enhanced.js` -- `attachCalendarCellListeners()`, `fetchMonthBulkState()`, `rerenderCalendar()`
- `public/css/style.css` -- `.cell-mode`, `.calendar-popup` styles

---

## Test Results

- **Playwright E2E test:** Fails due to missing `CYBERLOGITEC_USERNAME`/`CYBERLOGITEC_PASSWORD` in `.env` -- expected for local dev without credentials. Test infrastructure is functional.
- **No unit tests exist** for the calendar/settings features.

---

## Architecture Notes

### Auth Flow (after revert)
- **Local dev:** Auto-reads `PUNCH_SECRET` from `.env` via `/api/dev-secret` endpoint (blocked on Vercel)
- **Production:** First visit shows "Enter PUNCH_SECRET" form. Secret stored in `localStorage`, verified via `X-Secret` header on each API call.

### Swap Override Data Flow
1. User swaps a day via Dashboard modal -> calls `api/actions` with `swap` action
2. `setDayModeOverride(date, mode)` saves to Vercel KV (or in-memory fallback) + Turso DB
3. `getBulkState(dates)` returns `effectiveMode`, `modeOverride`, `scheduleMode`, `isOff` per date
4. Calendar reads `bulkState.byDate` to render mode badges
5. Settings reads bulk state for next 14 days to show active overrides
6. `clearSwapOverride` action deletes from KV + DB, restoring default mode

### Files Modified in This PR
| File | Changes |
|------|---------|
| `api/actions.js` | Added `clearSwapOverride` action |
| `lib/db.js` | Added `deleteSwapOverride()` |
| `public/css/style.css` | Mode badge styles, calendar popup styles |
| `public/js/api.js` | Added `clearSwapOverride()` client function |
| `public/js/app-enhanced.js` | Settings swap overrides section, calendar click popup, nav fix |
| `public/js/charts.js` | `renderMiniCalendar()` enhanced with `bulkState` + mode badges |
