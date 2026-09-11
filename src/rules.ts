/**
 * rules.ts — Attendance remark computation business logic.
 *
 * All configurable thresholds and user-facing remark text are exported as named
 * constants at the top of this file so they can be tweaked without touching logic.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REMARK TEXT VERIFICATION NOTE (read before deploying to production):
 * ─────────────────────────────────────────────────────────────────────────────
 * The Burmese strings below (REMARK_LATE_SUFFIX, REMARK_NO_RECORD,
 * REMARK_NO_CHECKOUT) were transcribed from a screenshot of a Zawgyi-encoded
 * file. Screenshots of Zawgyi text can be ambiguous — Zawgyi and Unicode
 * Myanmar look similar but are byte-incompatible. The source .xls file uses
 * Zawgyi encoding (confirmed: embedded font "Zawgyi-One").
 *
 * ACTION REQUIRED: Verify these exact strings against your live production
 * system before relying on them. Replace with the exact byte-sequence your
 * attendance system expects. If your system writes Zawgyi output, you may need
 * to use Zawgyi-encoded strings here too.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { AttendanceRow, RulesConfig } from './types';

// ─── Configurable constants ───────────────────────────────────────────────────

/**
 * Arriving up to and INCLUDING this many minutes late incurs no remark.
 * The 11th late minute and beyond triggers the late-check-in remark.
 */
export const GRACE_MINUTES = 10;

/**
 * Appended after the computed hour-fraction for a late check-in.
 * Example output: "0.36 ခွင့်တိုင်ရန်။"
 *
 * VERIFY this exact string with the client — see file header note.
 */
export const REMARK_LATE_SUFFIX = 'ခွင့်တိုင်ရန်။';

/**
 * Used when every field of Actual Time Card is blank (no attendance record).
 *
 * VERIFY this exact string with the client — see file header note.
 */
export const REMARK_NO_RECORD = 'တိုင်းကာဒ်မရှိပါ။';

/**
 * Used when the employee checked in but is missing the final checkout punch.
 *
 * VERIFY this exact string with the client — see file header note.
 */
export const REMARK_NO_CHECKOUT = 'အထွက်တိုင်းကာဒ်မရှိပါ။';

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Convert a 4-digit HHmm string to minutes since midnight.
 * Returns null if the input is invalid/malformed (so callers can skip gracefully).
 *
 * Examples:
 *   "0700" → 420
 *   "1830" → 1110
 *   "    " → null (blank/spaces)
 *   "abc"  → null
 */
export function hhmmToMinutes(hhmm: string): number | null {
  const s = hhmm.trim();
  if (s.length !== 4) return null;
  const hh = parseInt(s.substring(0, 2), 10);
  const mm = parseInt(s.substring(2, 4), 10);
  if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * Compute the fractional-hour display value for a given number of late minutes.
 *
 * Formula (verified against the full lookup table in plan.md):
 *   hourValue   = Math.floor((lateMinutes / 60) * 10000) / 10000
 *   displayValue = Math.floor(hourValue * 100) / 100
 *
 * Reference table (minutes → displayValue, first few rows):
 *   1  → 0.01   11 → 0.18   21 → 0.35   31 → 0.51
 *   2  → 0.03   12 → 0.2    22 → 0.36   32 → 0.53
 *   ...
 *  60  → 1.0
 *
 * The table in plan.md shows intermediate 4-decimal values (hourValue) which
 * are then floor-truncated to 2 decimals for display (displayValue).
 * Example: 22 minutes → hourValue = 0.3666 → displayValue = 0.36 ✓
 */
export function computeLateHours(lateMinutes: number): number {
  const hourValue = Math.floor((lateMinutes / 60) * 10000) / 10000;
  return Math.floor(hourValue * 100) / 100;
}

// ─── Core remark computation ──────────────────────────────────────────────────

/**
 * Compute the Remarks string for a single attendance row.
 *
 * Precedence (highest → lowest):
 *   1. NO_RECORD      — every field in Actual Time Card is blank
 *   2. LATE_CHECK_IN  — actual first punch > scheduled first punch + grace period
 *   3. NO_CHECKOUT    — check-in present, but last scheduled slot has no actual punch
 *   4. ""             — no remark
 *
 * @param row  A fully-populated AttendanceRow (remarks field will be ignored/overwritten)
 * @param cfg  Optional configuration thresholds and remark texts
 * @returns    The remark string, or "" if no condition applies
 */
export function computeRemark(row: AttendanceRow, cfg?: Partial<RulesConfig>): string {
  const grace = cfg?.graceMinutes ?? GRACE_MINUTES;
  const lateSuffix = cfg?.remarkLateSuffix ?? cfg?.remarkLate ?? REMARK_LATE_SUFFIX;
  const noRecord = cfg?.remarkNoRecord ?? REMARK_NO_RECORD;
  const noCheckout = cfg?.remarkNoCheckout ?? REMARK_NO_CHECKOUT;
  return computeRemarkWith(row, grace, lateSuffix, noRecord, noCheckout);
}

/**
 * Apply computeRemark to every row in an array (mutates the `remarks` field in-place).
 * Optionally accepts a RulesConfig to override the module-level constants.
 */
export function applyRemarks(
  rows: AttendanceRow[],
  onWarn?: (msg: string) => void,
  cfg?: Partial<RulesConfig>
): AttendanceRow[] {
  const grace = cfg?.graceMinutes ?? GRACE_MINUTES;
  const lateSuffix = cfg?.remarkLateSuffix ?? cfg?.remarkLate ?? REMARK_LATE_SUFFIX;
  const noRecord = cfg?.remarkNoRecord ?? REMARK_NO_RECORD;
  const noCheckout = cfg?.remarkNoCheckout ?? REMARK_NO_CHECKOUT;

  for (const row of rows) {
    try {
      row.remarks = computeRemarkWith(row, grace, lateSuffix, noRecord, noCheckout);
    } catch (err) {
      row.remarks = '';
      const msg = `Row (Employee ID "${row.employeeId}", file "${row.sourceFile}"): remark computation error — ${
        err instanceof Error ? err.message : String(err)
      }`;
      if (onWarn) onWarn(msg);
      else console.warn('[rules.ts]', msg);
    }
  }
  return rows;
}

function computeRemarkWith(
  row: AttendanceRow,
  graceMinutes: number,
  lateSuffix: string,
  noRecord: string,
  noCheckout: string
): string {
  const stdFields = row.standardTimeCard.split(',').map((f) => f.trim());
  const actFields = row.actualTimeCard.split(',').map((f) => f.trim());
  const isBlank = (s: string) => s === '';

  if (actFields.every(isBlank)) return noRecord;

  const standardFirst = stdFields[0] ?? '';
  const actualFirst = actFields[0] ?? '';

  if (!isBlank(actualFirst)) {
    const stdMinutes = hhmmToMinutes(standardFirst);
    const actMinutes = hhmmToMinutes(actualFirst);
    if (stdMinutes !== null && actMinutes !== null) {
      const lateMinutes = actMinutes - stdMinutes;
      if (lateMinutes > graceMinutes) {
        return `${computeLateHours(lateMinutes)} ${lateSuffix}`;
      }
    }
  }

  let lastStdIdx = -1;
  for (let i = stdFields.length - 1; i >= 0; i--) {
    if (!isBlank(stdFields[i])) { lastStdIdx = i; break; }
  }
  if (lastStdIdx >= 0 && isBlank(actFields[lastStdIdx] ?? '')) return noCheckout;

  return '';
}

