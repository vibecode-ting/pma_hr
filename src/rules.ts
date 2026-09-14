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
export const REMARK_LEAVE_APPLIED = 'ခွင့်တိုင်ပြီး';
export const REMARK_NO_CHECKOUT = '';
export const REMARK_OT_SUFFIX = 'အိုတီတင်ရန်';
export const REMARK_OT_APPLIED = 'အိုတီတင်ပြီး';
export const REMARK_COMBINE_JOIN = ' နှင့် ';

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
 * Get current system time as minutes from midnight (0..1439).
 */
export function getCurrentTimeMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Main remark computation function for a single row.
 */
export function computeRemark(
  row: AttendanceRow,
  cfg?: Partial<RulesConfig>,
  todayStr: string = getTodayDateString(),
  currentMinutes: number = getCurrentTimeMinutes()
): string {
  const shifts = cfg?.shifts && cfg.shifts.length > 0 ? cfg.shifts : DEFAULT_SHIFTS;
  const graceMinutes = cfg?.graceMinutes ?? GRACE_MINUTES;
  const earlyOutGraceMinutes = cfg?.earlyOutGraceMinutes ?? EARLY_OUT_GRACE_MINUTES;
  const otThresholdMinutes = cfg?.otThresholdMinutes ?? OT_THRESHOLD_MINUTES;
  const lateSuffix = cfg?.remarkLateSuffix ?? cfg?.remarkLate ?? REMARK_LATE_SUFFIX;
  const leaveAppliedRemark = cfg?.remarkLeaveApplied ?? REMARK_LEAVE_APPLIED;
  const otSuffix = cfg?.remarkOtSuffix ?? REMARK_OT_SUFFIX;
  const otAppliedRemark = cfg?.remarkOtApplied ?? REMARK_OT_APPLIED;

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

  // Check if attendance date is in the future or today before shift start time:
  const rowDate = (row.attendanceDate || '').trim().replace(/[-/]/g, '');
  if (rowDate && rowDate > todayStr) {
    return '';
  }
  if (rowDate && rowDate === todayStr && actPunches.length === 0) {
    // If shift start time is later than current time (it's still early / night shift / future assign)
    if (currentMinutes < startMin + graceMinutes) {
      return '';
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
  } else {
    // Every shift has 1 hour lunch break deduction ("ဘယ်အဆိုင်းဖြစ်ဖြစ်")
    const defaultLunchStart = startMin + 4 * 60;
    lunch = { start: defaultLunchStart, end: defaultLunchStart + 60 };
  }

  // Helper to map punch time into shift timeline
  const adjustTime = (m: number) => {
    if (m < startMin - 180) return m + 1440;
    return m;
  };

  // Helper to check if absent column is 0
  const isAbsentZero = () => {
    const ab = parseFloat(row.absent);
    return !isNaN(ab) && ab === 0 && row.absent.trim() !== '';
  };

  // 1. Check if completely blank / no punches
  if (actPunches.length === 0) {
    if (isAbsentZero()) {
      return `( 8 နာရီ ${leaveAppliedRemark} )`;
    }
    return `( 8 နာရီ ${lateSuffix} )`;
  }

  let leaveRemark = '';

  // 2. Check-in punch (first punch)
  const firstPunchStr = actPunches[0]!;
  const firstPunchRaw = hhmmToMinutes(firstPunchStr);
  const firstPunchMin = firstPunchRaw !== null ? adjustTime(firstPunchRaw) : null;

  if (firstPunchMin !== null) {
    const lateMinutes = firstPunchMin - startMin;
    if (lateMinutes > graceMinutes) {
      const missedWorkMins = computeWorkMinutes(startMin, firstPunchMin, lunch);
      const missedHours = Math.round((missedWorkMins / 60) * 10) / 10;
      const timeStr = lateMinutes < 60 ? `${lateMinutes} မိနစ်` : `${missedHours} နာရီ`;
      if (isAbsentZero()) {
        leaveRemark = `${timeStr} ${leaveAppliedRemark}`;
      } else {
        leaveRemark = `${timeStr} ${lateSuffix}`;
      }
    }
  }

  // 3. Checkout punch
  let checkoutPunchMin: number | null = null;
  if (actPunches.length >= 2) {
    const lastPunchStr = actPunches[actPunches.length - 1]!;
    const lastPunchRaw = hhmmToMinutes(lastPunchStr);
    if (lastPunchRaw !== null) {
      const adjustedLast = adjustTime(lastPunchRaw);
      // If last punch is not just a quick repeat of check-in
      if (firstPunchMin !== null && adjustedLast - firstPunchMin > 30) {
        checkoutPunchMin = adjustedLast;
      }
    }
  }

  if (checkoutPunchMin !== null) {
    const earlyMinutes = endMin - checkoutPunchMin;
    if (earlyMinutes > earlyOutGraceMinutes) {
      const missedWorkMins = computeWorkMinutes(checkoutPunchMin, endMin, lunch);
      const missedHours = Math.round((missedWorkMins / 60) * 10) / 10;
      const timeStr = earlyMinutes < 60 ? `${earlyMinutes} မိနစ်` : `${missedHours} နာရီ`;
      const earlyStr = isAbsentZero() ? `${timeStr} ${leaveAppliedRemark}` : `${timeStr} ${lateSuffix}`;
      leaveRemark = leaveRemark ? `${leaveRemark} နှင့် ${earlyStr}` : earlyStr;
    }
  }

  // 4. Overtime evaluation
  let otRemark = '';
  let actualCardOt = 0;
  if (checkoutPunchMin !== null && checkoutPunchMin > endMin) {
    let extraMinutes = checkoutPunchMin - endMin;
    // 1-hour lunch break deduction for overtime ("ေန့လည်စာစား ချိန် lunch break 1 နာရီ နှုတ်ရမယ် ေလ. ဘယ်အဆိုင်းဖြစ်ဖြစ်")
    if ((endMin <= 11 * 60 && checkoutPunchMin >= 12 * 60) || extraMinutes >= 90) {
      extraMinutes = Math.max(0, extraMinutes - 60);
    }
    if (extraMinutes >= otThresholdMinutes) {
      actualCardOt = Math.floor((extraMinutes + 10) / 30) * 0.5;
    }
  }

  const existingOt = parseFloat(row.overtimeHours);
  const hasExistingOt = !isNaN(existingOt) && existingOt > 0;

  if (hasExistingOt) {
    // Overtime hours column has data (>0) -> Already submitted
    otRemark = `${existingOt} နာရီ ${otAppliedRemark}`;
  } else if (actualCardOt > 0) {
    // Overtime hours is 0 or empty, but actual card has overtime
    otRemark = `${actualCardOt} နာရီ ${otSuffix}`;
  }

  // 5. Combinations of Leave & OT
  if (leaveRemark && otRemark) {
    return `( ${leaveRemark} နှင့် ${otRemark} )`;
  }
  if (leaveRemark) {
    return `( ${leaveRemark} )`;
  }
  if (otRemark) {
    return `( ${otRemark} )`;
  }
  return '';
}

/**
 * Check if a row is already okay / fixed.
 * Returns true if the row has no pending leave ('ခွင့်တိုင်ရန်') and no pending overtime ('အိုတီတင်ရန်').
 */
export function isRowResolved(row: AttendanceRow): boolean {
  const rem = row.remarks || '';
  if (!rem.trim()) return true;
  return !rem.includes('ခွင့်တိုင်ရန်') && !rem.includes('အိုတီတင်ရန်');
}

/**
 * Apply computeRemark to every row in an array (mutates the `remarks` field in-place).
 */
export function applyRemarks(
  rows: AttendanceRow[],
  onWarn?: (msg: string) => void,
  cfg?: Partial<RulesConfig>,
  todayStr: string = getTodayDateString(),
  currentMinutes: number = getCurrentTimeMinutes()
): AttendanceRow[] {
  for (const row of rows) {
    try {
      row.remarks = computeRemark(row, cfg, todayStr, currentMinutes);
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
