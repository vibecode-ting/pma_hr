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

export const REMARK_LATE_SUFFIX = 'ခြင့္တိုင္ရန္';
export const REMARK_NO_RECORD = '( Absent / 8 hours ခြင့္တိုင္ရန္ )';
export const REMARK_LEAVE_APPLIED = 'ခြင့္တိုင္ၿပီး';
export const REMARK_NO_CHECKOUT = 'အထြက္တိုင္းကဒ် မရွိပါ';
export const REMARK_NO_CHECKIN = 'အဝင္တိုင္းကဒ် မရွိပါ';
export const REMARK_OT_SUFFIX = 'အိုတီတင္ရန္';
export const REMARK_OT_APPLIED = 'အိုတီတင္ပီး';
export const REMARK_NIGHT_SHIFT = 'ညဆိုင္း';
export const REMARK_COMBINE_JOIN = ' ႏွင့္ ';

export const DEFAULT_SHIFTS: ShiftConfig[] = [
  { shiftNo: '5', shiftName: 'Kitchen,D2 Morning', startTime: '05:00', lunchTime: '09:00~10:00', endTime: '13:00', overtime: [{ work: '13:00~15:00' }, { rest: '15:00~15:30' }, { work: '15:30~16:30' }] },
  { shiftNo: 'B', shiftName: 'Security,Driver,Fire Morning', startTime: '06:30', lunchTime: '11:00~12:00', endTime: '14:30', overtime: [{ work: '14:30~17:00' }, { rest: '17:00~17:30' }, { work: '17:30~18:00' }] },
  { shiftNo: '9', shiftName: 'Engineering Morning', startTime: '07:30', lunchTime: '12:00~13:00', endTime: '15:30', overtime: [{ work: '12:00~12:30' }, { rest: '12:30~13:00' }, { work: '13:00~14:30' }, { work: '15:30~18:00' }, { rest: '18:00~18:30' }, { work: '18:30~19:00' }] },
  { shiftNo: 'C', shiftName: 'Security,Driver,Fire Noon', startTime: '14:30', lunchTime: '18:30~19:30', endTime: '22:30', overtime: [{ work: '13:30~15:30' }, { work: '22:30~00:30' }, { rest: '00:30~01:00' }, { work: '01:00~02:00' }] },
  { shiftNo: '9', shiftName: 'Engineering Noon', startTime: '15:30', lunchTime: '17:30~18:30', endTime: '23:30', overtime: [{ rest: '23:30~00:00' }, { work: '00:00~03:00' }] },
  { shiftNo: 'g', shiftName: 'D2 Night (Sat)', startTime: '17:00', lunchTime: '-', endTime: '21:00', overtime: [{ work: '15:30~17:00' }, { rest: '21:00~22:00' }, { work: '22:00~03:00' }] },
  { shiftNo: 'G', shiftName: 'D2 Night', startTime: '17:00', lunchTime: '21:00~22:00', endTime: '02:00', overtime: [{ work: '14:30~15:00' }, { rest: '15:00~15:30' }, { work: '21:00~22:30' }, { work: '02:00~03:00' }, { rest: '03:00~03:30' }, { work: '03:30~05:30' }] },
  { shiftNo: 'A', shiftName: 'Security,Driver,Fire Night', startTime: '22:30', lunchTime: '02:00~03:00', endTime: '06:30', overtime: [{ work: '20:00~20:30' }, { rest: '20:30~21:00' }, { work: '21:30~23:30' }, { work: '06:30~08:00' }, { rest: '08:00~08:30' }, { work: '08:30~10:00' }] },
  { shiftNo: 'D', shiftName: 'Engineering Night', startTime: '23:30', lunchTime: '02:00~03:00', endTime: '07:30', overtime: [{ work: '07:30~08:00' }, { rest: '08:00~08:30' }, { work: '08:30~11:00' }] },
  { shiftNo: 'p', shiftName: 'Kitchen-Noon, D2-Noon', startTime: '11:30', lunchTime: '15:00~16:00', endTime: '19:30', overtime: [{ work: '09:00~09:30' }, { rest: '09:30~10:00' }, { work: '10:00~11:30' }, { work: '19:30~21:00' }, { rest: '21:00~21:30' }, { work: '21:30~23:00' }] },
  { shiftNo: '11', shiftName: 'AC (Morning)', startTime: '07:00', lunchTime: '12:00~13:00', endTime: '16:00', overtime: [{ work: '04:30~06:30' }, { rest: '06:30~07:00' }, { work: '16:00~18:00' }, { rest: '18:00~18:30' }, { work: '18:30~19:30' }] },
  { shiftNo: '12', shiftName: 'AC (Night)', startTime: '19:00', lunchTime: '00:00~01:00', endTime: '04:00', overtime: [{ work: '04:00~06:00' }, { rest: '06:00~06:30' }, { work: '06:30~07:30' }] },
  { shiftNo: '13', shiftName: 'AC(Morning)(Sat)', startTime: '07:00', lunchTime: '-', endTime: '11:00', overtime: [{ work: '04:30~06:30' }, { rest: '06:30~07:00' }, { work: '11:00~12:00' }, { rest: '12:00~13:00' }, { work: '13:00~17:00' }] },
  { shiftNo: '14', shiftName: 'AC(Night)(Sat)', startTime: '19:00', lunchTime: '-', endTime: '23:00', overtime: [{ work: '23:00~00:00' }, { rest: '00:00~01:00' }, { work: '01:00~05:00' }] },
  { shiftNo: 'a', shiftName: 'Clinic-Noon', startTime: '10:00', lunchTime: '14:00~15:00', endTime: '19:00', overtime: [{ work: '19:00~20:00' }, { rest: '20:00~21:00' }, { work: '21:00~23:00' }] },
  { shiftNo: '15', shiftName: 'Factory(Morning)', startTime: '07:00', lunchTime: '12:00~13:00', endTime: '16:00', overtime: [{ work: '16:00~18:00' }, { rest: '18:00~18:30' }, { work: '18:30~19:30' }] },
  { shiftNo: '17', shiftName: 'Factory(Morning)(Sat)', startTime: '07:00', lunchTime: '-', endTime: '11:00', overtime: [{ work: '11:00~12:00' }, { rest: '12:00~13:00' }, { work: '13:00~17:00' }] },
  { shiftNo: '16', shiftName: 'Factory(Night)', startTime: '19:00', lunchTime: '00:00~01:00', endTime: '04:00', overtime: [{ work: '04:00~06:00' }, { rest: '06:00~06:30' }, { work: '06:30~07:30' }] },
  { shiftNo: '40', shiftName: 'Factory(Night)(Sat)', startTime: '19:00', lunchTime: '-', endTime: '23:00', overtime: [{ work: '23:00~00:00' }, { rest: '00:00~01:00' }, { work: '01:00~05:00' }] },
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
 * Normalize an attendance date string into "YYYYMMDD" format.
 */
export function normalizeDateDigits(dStr: string): string {
  const digits = (dStr || '').trim().replace(/[^0-9]/g, '');
  if (digits.length === 8) {
    if (digits.startsWith('20') || digits.startsWith('19')) {
      return digits;
    }
    if (digits.endsWith('2026') || digits.endsWith('2025') || digits.endsWith('2027') || digits.endsWith('2028')) {
      return digits.slice(4) + digits.slice(2, 4) + digits.slice(0, 2);
    }
  }
  return digits;
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

/**
 * Format minutes into "၁၅ မိနစ် / 0.25 hour" format
 */
export function formatLeaveTime(minutes: number): string {
  const toMyanmarNum = (n: number) => String(n).replace(/\d/g, (d) => '၀၁၂၃၄၅၆၇၈၉'[parseInt(d, 10)]);
  const mm = toMyanmarNum(minutes);
  const hrs = Number((minutes / 60).toFixed(4));
  return `${mm} မိနစ္ / ${hrs} hour`;
}

// ─── Shift Matching & Computation ─────────────────────────────────────────────

export function resolveShift(klass: string, shifts: ShiftConfig[]): ShiftConfig | null {
  const trimmed = klass.trim();
  if (!trimmed) return null;
  // Exact case-sensitive match (e.g. 'g' vs 'G')
  return shifts.find((s) => s.shiftNo === trimmed) ?? null;
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
  let otSuffix = cfg?.remarkOtSuffix ?? REMARK_OT_SUFFIX;
  // Clean up any stray "hour" or "နာရီ" in otSuffix to prevent "1 နာရီ hour အိုတီတင်ရန်"
  otSuffix = otSuffix.replace(/hour\s*/gi, '').replace(/နာရီ\s*/gi, '').trim() || REMARK_OT_SUFFIX;
  const otAppliedRemark = cfg?.remarkOtApplied ?? REMARK_OT_APPLIED;
  const noCheckoutRemark = cfg?.remarkNoCheckout || REMARK_NO_CHECKOUT;
  const noCheckinRemark = cfg?.remarkNoCheckin || REMARK_NO_CHECKIN;

  const shift = resolveShift(row.klass, shifts);
  const actPunches = extractPunches(row.actualTimeCard);
  const stdSlots = (row.standardTimeCard || '').split(',').map((s) => s.trim());
  const actSlots = (row.actualTimeCard || '').split(',').map((s) => s.trim());

  // Parse shift times or fallbacks
  let startMin = 7 * 60; // default 07:00
  let endMin = 16 * 60;  // default 16:00
  let lunchRaw = parseLunchInterval('12:00~13:00');

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
    if (stdPunches.length > 1) {
      const e = hhmmToMinutes(stdPunches[stdPunches.length - 1] ?? '');
      if (e !== null) endMin = e;
    }
    if (stdPunches.length === 4) {
      const ls = hhmmToMinutes(stdPunches[1] ?? '');
      const le = hhmmToMinutes(stdPunches[2] ?? '');
      if (ls !== null && le !== null) {
        lunchRaw = { start: ls, end: le };
      }
    }
  }

  // Night shift detection: class or shift schedule starting in the evening / night
  const isNightShift = Boolean(
    (shift && shift.shiftName.toLowerCase().includes('night')) ||
    ['g', 'G', 'A', 'D', '12', '14', '16', '40'].includes(row.klass.trim()) ||
    startMin >= 16 * 60 // 16:00 (4:00 PM) or later
  );
  const nightShiftRemark = cfg?.remarkNightShift || REMARK_NIGHT_SHIFT;

  // Check if attendance date is in the future or today before shift start time:
  const rowDate = normalizeDateDigits(row.attendanceDate);
  if (rowDate && rowDate > todayStr) {
    if (isNightShift && actPunches.length === 0) {
      return nightShiftRemark;
    }
    return '';
  }
  if (rowDate && rowDate === todayStr && actPunches.length === 0) {
    // If shift start time is in the evening / night or later today
    if (isNightShift && currentMinutes < startMin + graceMinutes) {
      return nightShiftRemark;
    }
    if (currentMinutes < startMin + graceMinutes) {
      return '';
    }
  }

  // Adjust for overnight shifts
  if (endMin <= startMin) {
    endMin += 1440;
  }

  let lunch: { start: number; end: number } | null = null;
  const isNoLunch = !lunchRaw || (shift && shift.lunchTime.trim() === '-');
  if (lunchRaw) {
    let lStart = lunchRaw.start;
    let lEnd = lunchRaw.end;
    if (lStart < startMin - 180) lStart += 1440;
    if (lEnd < startMin - 180) lEnd += 1440;
    if (lEnd <= lStart) lEnd += 1440;
    lunch = { start: lStart, end: lEnd };
  } else if (!isNoLunch) {
    // Every regular shift has 1 hour lunch break deduction
    const defaultLunchStart = startMin + 4 * 60;
    lunch = { start: defaultLunchStart, end: defaultLunchStart + 60 };
  }

  // Helper to map punch time into shift timeline
  const adjustTime = (m: number) => {
    // If shift starts in the afternoon/evening (>= 12:00), punches before noon (< 12:00) are next day:
    if (startMin >= 720 && m < 720) return m + 1440;
    // If overnight shift (endMin > 1440), punches before noon are next day:
    if (endMin > 1440 && m < 720) return m + 1440;
    // For any shift, if punch is > 4 hours before shift start, it's next-day punch/OT:
    if (m < startMin - 240) return m + 1440;
    return m;
  };

  // Helper to check if absent column is 0 or leave applied
  const isAbsentZero = () => {
    const ab = parseFloat(row.absent);
    return !isNaN(ab) && ab === 0 && row.absent.trim() !== '';
  };

  // 1. Check if completely blank / no punches
  if (actPunches.length === 0) {
    let absentMins = isNoLunch ? 4 * 60 : computeWorkMinutes(startMin, endMin, lunch);
    const abVal = parseFloat(row.absent);
    if (!isNaN(abVal) && abVal > 0) {
      absentMins = Math.round(abVal * 60);
    }
    const hrs = +(absentMins / 60).toFixed(4);
    const hrsStr = hrs === 1 ? '1 hour' : `${hrs} hours`;
    if (isAbsentZero()) {
      return `( Absent / ${hrsStr} ${leaveAppliedRemark} )`;
    }
    return `( Absent / ${hrsStr} ${lateSuffix} )`;
  }

  // Determine shift check-in and checkout punches
  const isSlotAligned = stdSlots.length >= 4 && actSlots.length === stdSlots.length;
  const shiftOutSlot = isNoLunch ? 1 : 3;

  let inPunchMin: number | null = null;
  let hasPreShiftOt = false;
  let outPunchMin: number | null = null;

  if (isSlotAligned) {
    // Check Slot 0 for standard check-in
    if (actSlots[0] && actSlots[0].length >= 4) {
      const pRaw = hhmmToMinutes(actSlots[0]);
      if (pRaw !== null) inPunchMin = adjustTime(pRaw);
    }

    // Check pre-shift OT slots
    for (let s = shiftOutSlot + 1; s < actSlots.length; s++) {
      const actP = actSlots[s];
      const stdP = stdSlots[s];
      if (actP && actP.length >= 4 && stdP && stdP.length >= 4) {
        const sMin = hhmmToMinutes(stdP);
        if (sMin !== null) {
          const adjS = adjustTime(sMin);
          if (adjS < startMin) {
            hasPreShiftOt = true;
            if (inPunchMin === null) {
              const pRaw = hhmmToMinutes(actP);
              if (pRaw !== null) inPunchMin = adjustTime(pRaw);
            }
          }
        }
      }
    }

    // Check shift checkout slot
    if (actSlots[shiftOutSlot] && actSlots[shiftOutSlot].length >= 4) {
      const pRaw = hhmmToMinutes(actSlots[shiftOutSlot]);
      if (pRaw !== null) outPunchMin = adjustTime(pRaw);
    }

    // Check post-shift OT slots for latest departure
    for (let s = shiftOutSlot + 1; s < actSlots.length; s++) {
      const actP = actSlots[s];
      const stdP = stdSlots[s];
      if (actP && actP.length >= 4 && stdP && stdP.length >= 4) {
        const sMin = hhmmToMinutes(stdP);
        if (sMin !== null) {
          const adjS = adjustTime(sMin);
          if (adjS >= endMin) {
            const pRaw = hhmmToMinutes(actP);
            if (pRaw !== null) {
              const adj = adjustTime(pRaw);
              if (outPunchMin === null || adj > outPunchMin) {
                outPunchMin = adj;
              }
            }
          }
        }
      }
    }
  }

  // If there are at least two distinct punches, user has BOTH in and out!
  if (actPunches.length >= 2) {
    const sortedAdj = actPunches
      .map((p) => {
        const raw = hhmmToMinutes(p);
        return raw !== null ? adjustTime(raw) : null;
      })
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b);

    if (sortedAdj.length >= 2) {
      const earliest = sortedAdj[0];
      const latest = sortedAdj[sortedAdj.length - 1];
      // If earliest and latest are distinct (> 15 mins apart, not accidental double tap)
      if (latest - earliest > 15) {
        if (inPunchMin === null) inPunchMin = earliest;
        if (outPunchMin === null || latest > outPunchMin) outPunchMin = latest;
      }
    }
  }

  // Fallback for single punch or unaligned rows
  if (inPunchMin === null && outPunchMin === null && actPunches.length > 0) {
    const singleRaw = hhmmToMinutes(actPunches[0]!);
    if (singleRaw !== null) {
      const singleAdj = adjustTime(singleRaw);
      const midpoint = (startMin + endMin) / 2;
      if (singleAdj <= midpoint) {
        inPunchMin = singleAdj;
      } else {
        outPunchMin = singleAdj;
      }
    }
  }

  // Missing Check-in evaluation
  let checkinRemark = '';
  if (inPunchMin === null && outPunchMin !== null) {
    checkinRemark = noCheckinRemark;
  }

  // 2. Late check-in evaluation
  let leaveRemark = '';
  if (inPunchMin !== null && !hasPreShiftOt) {
    const lateMinutes = inPunchMin - startMin;
    if (lateMinutes > graceMinutes) {
      const missedWorkMins = computeWorkMinutes(startMin, inPunchMin, lunch);
      const timeStr = formatLeaveTime(missedWorkMins);
      if (isAbsentZero()) {
        leaveRemark = `${timeStr} ${leaveAppliedRemark}`;
      } else {
        leaveRemark = `${timeStr} ${lateSuffix}`;
      }
    }
  }

  // 3. Checkout evaluation (Missing checkout or Early departure)
  let checkoutRemark = '';
  if (inPunchMin !== null && outPunchMin === null) {
    // If attendance date is today and shift has not ended yet, the employee is still currently working
    if (rowDate && rowDate === todayStr && currentMinutes < endMin) {
      checkoutRemark = '';
    } else {
      checkoutRemark = noCheckoutRemark;
    }
  } else if (outPunchMin !== null) {
    const earlyMinutes = endMin - outPunchMin;
    if (earlyMinutes > earlyOutGraceMinutes) {
      const missedWorkMins = computeWorkMinutes(outPunchMin, endMin, lunch);
      const timeStr = formatLeaveTime(missedWorkMins);
      const earlyStr = isAbsentZero() ? `${timeStr} ${leaveAppliedRemark}` : `${timeStr} ${lateSuffix}`;
      checkoutRemark = earlyStr;
    }
  }

  // 4. Overtime evaluation (pre-shift early arrival and post-shift late departure)
  //    Uses shift.overtime[] work/rest periods to deduct rest breaks from OT hours
  let otRemark = '';
  let actualCardOt = 0;

  // Helper: compute total rest minutes from shift overtime config within a time range
  const computeOtRestMinutes = (fromMin: number, toMin: number): number => {
    if (!shift || !shift.overtime || shift.overtime.length === 0) return 0;
    let restMins = 0;
    for (const block of shift.overtime) {
      if (!block.rest) continue;
      const parts = block.rest.split('~');
      if (parts.length !== 2) continue;
      let rStart = hhmmToMinutes(parts[0]);
      let rEnd = hhmmToMinutes(parts[1]);
      if (rStart === null || rEnd === null) continue;
      rStart = adjustTime(rStart);
      rEnd = adjustTime(rEnd);
      if (rEnd <= rStart) rEnd += 1440;
      // Overlap with [fromMin, toMin]
      const overlapStart = Math.max(fromMin, rStart);
      const overlapEnd = Math.min(toMin, rEnd);
      if (overlapEnd > overlapStart) {
        restMins += (overlapEnd - overlapStart);
      }
    }
    return restMins;
  };

  let preShiftCardOt = 0;
  if (inPunchMin !== null && inPunchMin < startMin) {
    const earlyMinutes = startMin - inPunchMin;
    const restDeduction = computeOtRestMinutes(inPunchMin, startMin);
    const effectiveMinutes = earlyMinutes - restDeduction;
    if (effectiveMinutes >= otThresholdMinutes) {
      preShiftCardOt = Math.floor((effectiveMinutes + 10) / 30) * 0.5;
    }
  }

  let postShiftCardOt = 0;
  if (outPunchMin !== null && outPunchMin > endMin) {
    let extraMinutes = outPunchMin - endMin;
    const restDeduction = computeOtRestMinutes(endMin, outPunchMin);
    extraMinutes -= restDeduction;
    if (isNoLunch && (endMin <= 11 * 60 && outPunchMin >= 12 * 60) && restDeduction === 0) {
      extraMinutes = Math.max(0, extraMinutes - 60);
    }
    if (extraMinutes >= otThresholdMinutes) {
      postShiftCardOt = Math.floor((extraMinutes + 10) / 30) * 0.5;
    }
  }

  actualCardOt = preShiftCardOt + postShiftCardOt;

  const existingOt = parseFloat(row.overtimeHours);
  const hasExistingOt = !isNaN(existingOt) && existingOt > 0;

  if (hasExistingOt) {
    otRemark = `${existingOt} နာရီ ${otAppliedRemark}`;
  } else if (actualCardOt > 0) {
    otRemark = `${actualCardOt} နာရီ ${otSuffix}`;
  }

  // 5. Combinations of Remarks
  const parts = [checkinRemark, leaveRemark, checkoutRemark, otRemark].filter(Boolean);
  if (parts.length > 0) {
    return `( ${parts.join(REMARK_COMBINE_JOIN)} )`;
  }
  return '';
}

/**
 * Check if a row is already okay / fixed.
 * Returns true if the row has no pending leave ('ခြင့္တိုင္ရန္' / 'ခွင့်တိုင်ရန်'),
 * no pending overtime ('အိုတီတင္ရန္' / 'အိုတီတင်ရန်'), and no missing punch ('မရွိပါ' / 'မရှိပါ').
 */
export function isRowResolved(row: AttendanceRow): boolean {
  const rem = row.remarks || '';
  if (!rem.trim()) return true;
  return (
    !rem.includes('တိုင္ရန္') &&
    !rem.includes('တိုင်ရန်') &&
    !rem.includes('တင္ရန္') &&
    !rem.includes('တင်ရန်') &&
    !rem.includes('မရွိပါ') &&
    !rem.includes('မရှိပါ')
  );
}

/**
 * Check if a remark is Green (already applied leave / OT with NO pending/missing actions).
 */
export function isRemarkGreen(rem: string): boolean {
  if (!rem || !rem.trim()) return false;
  const hasApplied =
    rem.includes('တိုင္ၿပီး') ||
    rem.includes('တိုင်ပြီး') ||
    rem.includes('တင္ပီး') ||
    rem.includes('တင္ပြီး') ||
    rem.includes('တင်ပြီး') ||
    rem.includes('တင်ပီး');
  const hasPending =
    rem.includes('တိုင္ရန္') ||
    rem.includes('တိုင်ရန်') ||
    rem.includes('တင္ရန္') ||
    rem.includes('တင်ရန်') ||
    rem.includes('မရွိပါ') ||
    rem.includes('မရှိပါ');
  return hasApplied && !hasPending;
}

/**
 * Check if a remark is Red (requires action: pending leave, pending OT, or missing punch).
 */
export function isRemarkRed(rem: string): boolean {
  if (!rem || !rem.trim()) return false;
  return (
    rem.includes('တိုင္ရန္') ||
    rem.includes('တိုင်ရန်') ||
    rem.includes('တင္ရန္') ||
    rem.includes('တင်ရန်') ||
    rem.includes('မရွိပါ') ||
    rem.includes('မရှိပါ')
  );
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
