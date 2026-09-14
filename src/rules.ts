/**
 * rules.ts — Attendance remark computation business logic.
 *
 * Shift-based leave calculation, grace period checking, lunch break deduction,
 * date-aware checkout validation, and overtime detection.
 */

import type { AttendanceRow, RulesConfig, ShiftConfig } from './types';

// ─── Default Constants ─────────────────────────────────────────────────────────

export const GRACE_MINUTES = 10;
export const EARLY_OUT_GRACE_MINUTES = 10;
export const OT_THRESHOLD_MINUTES = 20;

export const REMARK_LATE_SUFFIX = 'ခွင့်တိုင်ရန်';
export const REMARK_NO_RECORD = '( 8 နာရီ ခွင့်တိုင်ရန် )';
export const REMARK_NO_CHECKOUT = '';
export const REMARK_OT_SUFFIX = 'hour အိုတီ တင်ရန်';

export const DEFAULT_SHIFTS: ShiftConfig[] = [
  { shiftNo: '5', shiftName: 'Kitchen,D2 Morning', startTime: '05:00', lunchTime: '09:00~10:00', endTime: '13:00' },
  { shiftNo: '8', shiftName: 'Security,Driver,Fire Morning', startTime: '06:30', lunchTime: '11:00~12:00', endTime: '14:30' },
  { shiftNo: 'B', shiftName: 'Engineering Morning', startTime: '07:30', lunchTime: '12:00~13:00', endTime: '15:30' },
  { shiftNo: '9', shiftName: 'Security,Driver,Fire Noon', startTime: '14:30', lunchTime: '18:30~19:30', endTime: '22:30' },
  { shiftNo: 'C', shiftName: 'Engineering Noon', startTime: '15:30', lunchTime: '17:30~18:30', endTime: '23:30' },
  { shiftNo: 'g', shiftName: 'D2 Night (Sat)', startTime: '17:00', lunchTime: '-', endTime: '21:00' },
  { shiftNo: 'G', shiftName: 'D2 Night', startTime: '17:00', lunchTime: '21:00~22:00', endTime: '02:00' },
  { shiftNo: 'A', shiftName: 'Security,Driver,Fire Night', startTime: '22:30', lunchTime: '02:00~03:00', endTime: '06:30' },
  { shiftNo: 'D', shiftName: 'Engineering Night', startTime: '23:30', lunchTime: '02:00~03:00', endTime: '07:30' },
  { shiftNo: 'p', shiftName: 'Kitchen-Noon, D2-Noon', startTime: '11:30', lunchTime: '15:00~16:00', endTime: '19:30' },
  { shiftNo: '11', shiftName: 'AC (Morning)', startTime: '07:00', lunchTime: '11:30~12:30', endTime: '16:00' },
  { shiftNo: '12', shiftName: 'AC (Night)', startTime: '19:00', lunchTime: '00:00~01:00', endTime: '04:00' },
  { shiftNo: '13', shiftName: 'AC(Morning)(Sat)', startTime: '07:00', lunchTime: '-', endTime: '11:00' },
  { shiftNo: '14', shiftName: 'AC(Night)(Sat)', startTime: '19:00', lunchTime: '-', endTime: '23:00' },
  { shiftNo: 'a', shiftName: 'Clinic-Noon', startTime: '10:00', lunchTime: '14:00~15:00', endTime: '19:00' },
  { shiftNo: '15', shiftName: 'Factory(Morning)', startTime: '07:00', lunchTime: '12:00~13:00', endTime: '16:00' },
  { shiftNo: '17', shiftName: 'Factory(Morning)(Sat)', startTime: '19:00', lunchTime: '00:00~01:00', endTime: '04:00' },
  { shiftNo: '16', shiftName: 'Factory(Night)', startTime: '07:00', lunchTime: '-', endTime: '11:00' },
  { shiftNo: '40', shiftName: 'Factory(Night)(Sat)', startTime: '19:00', lunchTime: '-', endTime: '23:00' },
];

// ─── Time & Date Helpers ──────────────────────────────────────────────────────

/**
 * Convert HH:mm or HHmm string to minutes from midnight (0..1439).
 */
export function hhmmToMinutes(hhmm: string): number | null {
  const s = hhmm.trim().replace(':', '');
  if (s.length !== 4 && s.length !== 3) return null;
  const pad = s.padStart(4, '0');
  const hh = parseInt(pad.substring(0, 2), 10);
  const mm = parseInt(pad.substring(2, 4), 10);
  if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * Parse lunch interval string e.g. "11:30~12:30" or "-"
 */
export function parseLunchInterval(lunchStr: string): { start: number; end: number } | null {
  if (!lunchStr || lunchStr.trim() === '-' || !lunchStr.includes('~')) return null;
  const parts = lunchStr.split('~');
  const start = hhmmToMinutes(parts[0] ?? '');
  const end = hhmmToMinutes(parts[1] ?? '');
  if (start === null || end === null) return null;
  return { start, end };
}

/**
 * Get today's local date as "YYYYMMDD".
 */
export function getTodayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Calculate working minutes between fromMin and toMin, deducting lunch break if overlapping.
 */
export function computeWorkMinutes(
  fromMin: number,
  toMin: number,
  lunch: { start: number; end: number } | null
): number {
  if (toMin <= fromMin) return 0;
  let elapsed = toMin - fromMin;
  if (lunch) {
    const overlapStart = Math.max(fromMin, lunch.start);
    const overlapEnd = Math.min(toMin, lunch.end);
    if (overlapEnd > overlapStart) {
      elapsed -= (overlapEnd - overlapStart);
    }
  }
  return Math.max(0, elapsed);
}

// ─── Shift Matching & Computation ─────────────────────────────────────────────

export function resolveShift(klass: string, shifts: ShiftConfig[]): ShiftConfig | null {
  const trimmed = klass.trim();
  if (!trimmed) return null;
  // Exact case-sensitive match (e.g. 'g' vs 'G')
  const exact = shifts.find((s) => s.shiftNo === trimmed);
  if (exact) return exact;
  // Case-insensitive fallback
  return shifts.find((s) => s.shiftNo.toLowerCase() === trimmed.toLowerCase()) ?? null;
}

/**
 * Parse punch times from actualTimeCard string into 4-digit strings.
 */
export function extractPunches(actualTimeCard: string): string[] {
  return actualTimeCard
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && !isNaN(parseInt(s, 10)));
}

/**
 * Main remark computation function for a single row.
 */
export function computeRemark(
  row: AttendanceRow,
  cfg?: Partial<RulesConfig>,
  todayStr: string = getTodayDateString()
): string {
  const shifts = cfg?.shifts && cfg.shifts.length > 0 ? cfg.shifts : DEFAULT_SHIFTS;
  const graceMinutes = cfg?.graceMinutes ?? GRACE_MINUTES;
  const earlyOutGraceMinutes = cfg?.earlyOutGraceMinutes ?? EARLY_OUT_GRACE_MINUTES;
  const otThresholdMinutes = cfg?.otThresholdMinutes ?? OT_THRESHOLD_MINUTES;
  const noCheckoutRemark = cfg?.remarkNoCheckout ?? REMARK_NO_CHECKOUT;
  const otSuffix = cfg?.remarkOtSuffix ?? REMARK_OT_SUFFIX;

  const shift = resolveShift(row.klass, shifts);
  const actPunches = extractPunches(row.actualTimeCard);

  // Parse shift times or fallbacks
  let startMin = 7 * 60; // default 07:00
  let endMin = 16 * 60;  // default 16:00
  let lunchRaw = parseLunchInterval('11:30~12:30');

  if (shift) {
    const s = hhmmToMinutes(shift.startTime);
    const e = hhmmToMinutes(shift.endTime);
    if (s !== null) startMin = s;
    if (e !== null) endMin = e;
    lunchRaw = parseLunchInterval(shift.lunchTime);
  } else if (row.standardTimeCard) {
    const stdPunches = extractPunches(row.standardTimeCard);
    if (stdPunches.length > 0) {
      const s = hhmmToMinutes(stdPunches[0] ?? '');
      if (s !== null) startMin = s;
    }
    if (stdPunches.length >= 4) {
      const e = hhmmToMinutes(stdPunches[3] ?? '');
      if (e !== null) endMin = e;
    }
  }

  // Adjust for overnight shifts
  if (endMin <= startMin) {
    endMin += 1440;
  }

  let lunch: { start: number; end: number } | null = null;
  if (lunchRaw) {
    let lStart = lunchRaw.start;
    let lEnd = lunchRaw.end;
    if (lStart < startMin - 180) lStart += 1440;
    if (lEnd < startMin - 180) lEnd += 1440;
    if (lEnd <= lStart) lEnd += 1440;
    lunch = { start: lStart, end: lEnd };
  }

  const scheduledWorkMins = computeWorkMinutes(startMin, endMin, lunch);
  const scheduledWorkHours = Math.round((scheduledWorkMins / 60) * 10) / 10;

  // Helper to map punch time into shift timeline
  const adjustTime = (m: number) => {
    if (m < startMin - 180) return m + 1440;
    return m;
  };

  // 1. Check if completely blank / no punches
  if (actPunches.length === 0) {
    return `( ${scheduledWorkHours} နာရီ ခွင့်တိုင်ရန် )`;
  }

  const remarksList: string[] = [];

  // 2. Identify check-in and checkout punches
  const firstPunchStr = actPunches[0]!;
  const firstPunchRaw = hhmmToMinutes(firstPunchStr);
  const firstPunchMin = firstPunchRaw !== null ? adjustTime(firstPunchRaw) : null;

  // Evaluate check-in
  if (firstPunchMin !== null) {
    const lateMinutes = firstPunchMin - startMin;
    if (lateMinutes > graceMinutes) {
      if (lateMinutes < 60) {
        remarksList.push(`( ${lateMinutes} မိနစ် ခွင့်တိုင်ရန် )`);
      } else {
        const missedWorkMins = computeWorkMinutes(startMin, firstPunchMin, lunch);
        const missedHours = Math.round((missedWorkMins / 60) * 10) / 10;
        remarksList.push(`( ${missedHours} နာရီ ခွင့်တိုင်ရန် )`);
      }
    }
  }

  // Determine if checkout punch exists
  let checkoutPunchMin: number | null = null;
  if (actPunches.length >= 2) {
    const lastPunchStr = actPunches[actPunches.length - 1]!;
    const lastPunchRaw = hhmmToMinutes(lastPunchStr);
    if (lastPunchRaw !== null) {
      const adjustedLast = adjustTime(lastPunchRaw);
      // If last punch is not just a quick repeat of check-in (within 30 mins of arrival)
      if (firstPunchMin !== null && adjustedLast - firstPunchMin > 30) {
        checkoutPunchMin = adjustedLast;
      }
    }
  }

  // Clean date string comparison
  const rowDateDigits = row.attendanceDate.replace(/\D/g, '');
  const isTodayOrFuture = rowDateDigits.length === 8 && rowDateDigits >= todayStr;

  if (checkoutPunchMin === null) {
    // Punch out missing
    if (!isTodayOrFuture) {
      // Past date with missing checkout
      if (noCheckoutRemark.trim() !== '') {
        remarksList.push(noCheckoutRemark);
      }
    }
    // If today or future, do nothing (shift is ongoing)
  } else {
    // Checkout punch is present
    const earlyMinutes = endMin - checkoutPunchMin;
    if (earlyMinutes > earlyOutGraceMinutes) {
      // Early checkout
      if (earlyMinutes < 60) {
        remarksList.push(`( ${earlyMinutes} မိနစ် ခွင့်တိုင်ရန် )`);
      } else {
        const missedWorkMins = computeWorkMinutes(checkoutPunchMin, endMin, lunch);
        const missedHours = Math.round((missedWorkMins / 60) * 10) / 10;
        remarksList.push(`( ${missedHours} နာရီ ခွင့်တိုင်ရန် )`);
      }
    } else if (checkoutPunchMin > endMin) {
      // Overtime check (only if not already populated in column R)
      const existingOt = parseFloat(row.overtimeHours);
      if (isNaN(existingOt) || existingOt <= 0) {
        const extraMinutes = checkoutPunchMin - endMin;
        if (extraMinutes >= otThresholdMinutes) {
          const otHours = Math.floor((extraMinutes + 10) / 30) * 0.5;
          if (otHours > 0) {
            remarksList.push(`( ${otHours} ${otSuffix} )`);
          }
        }
      }
    }
  }

  return remarksList.join(' ');
}

/**
 * Apply computeRemark to every row in an array (mutates the `remarks` field in-place).
 */
export function applyRemarks(
  rows: AttendanceRow[],
  onWarn?: (msg: string) => void,
  cfg?: Partial<RulesConfig>,
  todayStr: string = getTodayDateString()
): AttendanceRow[] {
  for (const row of rows) {
    try {
      row.remarks = computeRemark(row, cfg, todayStr);
    } catch (err) {
      row.remarks = '';
      const msg = `Row (Employee ID "${row.employeeId}", file "${row.sourceFile}"): remark error — ${
        err instanceof Error ? err.message : String(err)
      }`;
      if (onWarn) onWarn(msg);
      else console.warn('[rules.ts]', msg);
    }
  }
  return rows;
}
