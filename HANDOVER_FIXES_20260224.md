# Handover Addendum: Calendar & History Fixes
**Date:** 2026-02-24
**Branch:** `fix/calendar-and-history-source`

## Summary of New Fixes

This update addresses remaining issues after the initial `enhancement/settings-overrides-distinction` work:

1. **DB History Source Mapping Fix** (`lib/db.js`)
   - Fixed `getPunchHistory()` which was querying the `source` column but not including it in the returned results.
   - History now correctly retrieves source data from the database.

2. **Refined Auto/Manual Logic** (`public/js/app-enhanced.js`)
   - Updated `statusBadge()` to correctly identify "Auto" vs "Manual" records.
   - **Auto Sources:** `gha`, `cron-reset`, `auto` (legacy default).
   - **Manual Sources:** `api`, `telegram`, or status `manual_done`.
   - Manual records now consistently use the blue badge style.

3. **Calendar Icon Visibility Boost** (`public/css/style.css`)
   - Increased default opacity of calendar mode icons (🏠, 🏢, 🌴) from `0.4` to `0.5`.
   - Icons are now clearly visible "dimmed" by default and become full opacity on hover.

## Verification
- [x] DB: History records now contain source property.
- [x] UI: "Auto" label appears for GHA punches.
- [x] UI: "Manual" label appears for API/Telegram/Manual clicks.
- [x] UI: Calendar emojis are visible without hover.

## Next Steps
- Merge `fix/calendar-and-history-source` to `main`.
- Clean up any remaining `debug-*.js` files if confirmed not needed.
