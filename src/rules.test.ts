/**
 * rules.test.ts — Unit tests for shift schedule logic, leave calculations, and OT rules.
 */

import { describe, it, expect } from 'vitest';
import {
  computeRemark,
  hhmmToMinutes,
  computeWorkMinutes,
  parseLunchInterval,
  DEFAULT_SHIFTS,
  REMARK_NO_CHECKOUT,
  REMARK_NIGHT_SHIFT,
  isRowResolved,
} from './rules';
import type { AttendanceRow } from './types';

function makeRow(
  actual: string,
  overrides: Partial<AttendanceRow> = {}
): AttendanceRow {
  return {
    sourceFile: 'test.xls',
    employeeId: '500830',
    name: 'ျမင့္ျမင့္ရီ',
    groupCode: '0014',
    groupName: 'IT',
    attendanceDate: '20260909',
    standardTimeCard: '0700,1200,1300,1600',
    actualTimeCard: actual,
    absent: '',
    overtimeHours: '0',
    klass: '11',
    remarks: '',
    ...overrides,
  };
}

describe('hhmmToMinutes', () => {
  it('converts "07:00" and "0700" to 420', () => {
    expect(hhmmToMinutes('07:00')).toBe(420);
    expect(hhmmToMinutes('0700')).toBe(420);
    expect(hhmmToMinutes('7:00')).toBe(420);
  });
  it('converts "16:00" to 960', () => expect(hhmmToMinutes('16:00')).toBe(960));
  it('converts "00:00" to 0', () => expect(hhmmToMinutes('00:00')).toBe(0));
  it('returns null for blank or invalid strings', () => {
    expect(hhmmToMinutes('    ')).toBeNull();
    expect(hhmmToMinutes('')).toBeNull();
    expect(hhmmToMinutes('abc')).toBeNull();
  });
});

describe('computeWorkMinutes', () => {
  const lunch = parseLunchInterval('11:30~12:30'); // 690 to 750

  it('computes full work day minus lunch', () => {
    expect(computeWorkMinutes(420, 960, lunch)).toBe(480);
  });

  it('user arrives at 12:00 (missed work time before 12:00 excluding lunch)', () => {
    expect(computeWorkMinutes(420, 720, lunch)).toBe(270);
  });

  it('computes missed work for early out at 12:30', () => {
    expect(computeWorkMinutes(750, 960, lunch)).toBe(210);
  });
});

describe('computeRemark - Shift Schedule Rules', () => {
  const todayDate = '20260914';
  const afternoonTime = 13 * 60; // 13:00 (780 mins)
  const eveningTime = 17 * 60; // 17:00 (1020 mins, after shift end)

  it('10 minutes late → no remark (within grace period)', () => {
    const row = makeRow('0710,1600', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('');
  });

  it('11 minutes late with absent empty → "( ၁၁ မိနစ္ / 0.1833 hour ခြင့္တိုင္ရန္ )"', () => {
    const row = makeRow('0711,1600', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( ၁၁ မိနစ္ / 0.1833 hour ခြင့္တိုင္ရန္ )');
  });

  it('11 minutes late with absent == 0 → "( ၁၁ မိနစ္ / 0.1833 hour ခြင့္တိုင္ၿပီး )"', () => {
    const row = makeRow('0711,1600', { absent: '0', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( ၁၁ မိနစ္ / 0.1833 hour ခြင့္တိုင္ၿပီး )');
  });

  it('user shows up at 12:00 for Shift 11 (07:00 start, 12:00~13:00 lunch) → "( ၃၀၀ မိနစ္ / 5 hour ခြင့္တိုင္ရန္ )"', () => {
    const row = makeRow('1200,1600', { klass: '11', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( ၃၀၀ မိနစ္ / 5 hour ခြင့္တိုင္ရန္ )');
  });

  it('user shows up at 12:00 with absent == 0 → "( ၃၀၀ မိနစ္ / 5 hour ခြင့္တိုင္ၿပီး )"', () => {
    const row = makeRow('1200,1600', { klass: '11', absent: '0', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( ၃၀၀ မိနစ္ / 5 hour ခြင့္တိုင္ၿပီး )');
  });

  it('completely blank actual card after shift start time with absent col = 4.5 → "( Absent / 4.5 hours ခြင့္တိုင္ရန္ )"', () => {
    const row = makeRow('    ,    ', { klass: '11', absent: '4.5', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( Absent / 4.5 hours ခြင့္တိုင္ရန္ )');
  });

  it('completely blank actual card after shift start time (no absent col) → "( Absent / 8 hours ခြင့္တိုင္ရန္ )"', () => {
    const row = makeRow('    ,    ', { klass: '11', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( Absent / 8 hours ခြင့္တိုင္ရန္ )');
  });

  it('completely blank actual card before shift start time for night shift (e.g. night shift 19:00, checking at 13:00) → "ညဆိုင္း"', () => {
    const row = makeRow('    ,    ', { klass: '12', attendanceDate: todayDate }); // shift 12 starts at 19:00
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe(REMARK_NIGHT_SHIFT);
  });

  it('completely blank actual card before shift start time for noon shift (e.g. shift 9 starts at 14:30, checked at 13:00) → "" (not absent yet)', () => {
    const row = makeRow('    ,    ', { klass: '9', attendanceDate: todayDate }); // shift 9 starts at 14:30
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('');
  });

  it('completely blank actual card after shift start time for noon shift (e.g. shift 9 starts at 14:30, checked at 17:00) → "( Absent / 7 hours ခြင့္တိုင္ရန္ )"', () => {
    const row = makeRow('    ,    ', { klass: '9', attendanceDate: todayDate }); // shift 9 starts at 14:30
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, eveningTime)).toBe('( Absent / 7 hours ခြင့္တိုင္ရန္ )');
  });

  it('completely blank actual card with absent == 0 → "( Absent / 8 hours ခြင့္တိုင္ၿပီး )"', () => {
    const row = makeRow('    ,    ', { klass: '11', absent: '0', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( Absent / 8 hours ခြင့္တိုင္ၿပီး )');
  });

  it('checkout at 15:50 (10 min early) → safe (within early out grace)', () => {
    const row = makeRow('0655,1550', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('');
  });

  it('early checkout half-day at 12:30 (with 12:00~13:00 lunch) → "( ၁၈၀ မိနစ္ / 3 hour ခြင့္တိုင္ရန္ )"', () => {
    const row = makeRow('0655,1230', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( ၁၈၀ မိနစ္ / 3 hour ခြင့္တိုင္ရန္ )');
  });

  it('early checkout with absent == 0 → "( ၁၈၀ မိနစ္ / 3 hour ခြင့္တိုင္ၿပီး )"', () => {
    const row = makeRow('0655,1230', { absent: '0', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( ၁၈၀ မိနစ္ / 3 hour ခြင့္တိုင္ၿပီး )');
  });

  it('overtime punch at 17:00 (1h OT, col R empty) → "( 1 နာရီ အိုတီတင္ရန္ )"', () => {
    const row = makeRow('0655,1700', { attendanceDate: todayDate, overtimeHours: '0' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( 1 နာရီ အိုတီတင္ရန္ )');
  });

  it('overtime punch at 17:00 and overtimeHours in Col R equals 1 → "( 1 နာရီ အိုတီတင္ပီး )"', () => {
    const row = makeRow('0655,1700', { attendanceDate: todayDate, overtimeHours: '1' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( 1 နာရီ အိုတီတင္ပီး )');
  });

  it('Saturday shift 13 (07:00~11:00) checkout 14:30 with 1h lunch deduction → 2.5h OT needed if col R empty', () => {
    const row = makeRow('0655,1430', { klass: '13', attendanceDate: todayDate, overtimeHours: '0' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( 2.5 နာရီ အိုတီတင္ရန္ )');
  });

  it('Saturday shift 13 checkout 14:30 when col R has 2.5 hrs → "( 2.5 နာရီ အိုတီတင္ပီး )"', () => {
    const row = makeRow('0655,1430', { klass: '13', attendanceDate: todayDate, overtimeHours: '2.5' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( 2.5 နာရီ အိုတီတင္ပီး )');
  });

  it('Saturday shift 13 checkout 14:00 when col R has 2 hrs → "( 2 နာရီ အိုတီတင္ပီး )"', () => {
    const row = makeRow('0655,1400', { klass: '13', attendanceDate: todayDate, overtimeHours: '2' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( 2 နာရီ အိုတီတင္ပီး )');
  });

  it('both leave applied and overtime applied → "( ၂၀ မိနစ္ / 0.3333 hour ခြင့္တိုင္ၿပီး ႏွင့္ 1 နာရီ အိုတီတင္ပီး )"', () => {
    const row = makeRow('0720,1700', { attendanceDate: todayDate, absent: '0', overtimeHours: '1' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( ၂၀ မိနစ္ / 0.3333 hour ခြင့္တိုင္ၿပီး ႏွင့္ 1 နာရီ အိုတီတင္ပီး )');
  });

  it('slot-aligned pre-shift OT (Class 9 arriving 12:00, checkout 22:30) does NOT trigger false late', () => {
    // Class 9: standard 14:30~22:30, pre-shift OT at 11:00~14:30
    const row = makeRow('', {
      klass: '9',
      standardTimeCard: '1430,1830,1930,2230,1100,1300,1330,1430,2230,0030,0100,0200',
      actualTimeCard: '    ,        ,        ,2230,1200,1200,        ,        ,        ,        ,        ,        ',
      absent: '',
      overtimeHours: '2',
      attendanceDate: todayDate,
    });
    // Should NOT be 7 hours late; should accurately report 2 hrs OT applied
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( 2 နာရီ အိုတီတင္ပီး )');
  });

  it('slot-aligned missing checkout with check-in punch after shift end → "( အထြက္တိုင္းကဒ် မရွိပါ )"', () => {
    const row = makeRow('', {
      klass: '11',
      standardTimeCard: '0700,1200,1300,1600,0330,0630,1600,1800,1830,1930',
      actualTimeCard: '0649,        ,        ,        ,        ,        ,        ,        ,        ,        ',
      absent: '8',
      overtimeHours: '0',
      attendanceDate: todayDate,
    });
    // At 13:00 (during active shift), not missing checkout yet:
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('');
    // At 17:00 (after 16:00 shift end), marked missing checkout:
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, eveningTime)).toBe('( အထြက္တိုင္းကဒ် မရွိပါ )');
  });

  it('slot-aligned missing check-in with checkout punch → "( အဝင္တိုင္းကဒ် မရွိပါ )"', () => {
    const row = makeRow('', {
      klass: '11',
      standardTimeCard: '0700,1200,1300,1600,0330,0630,1600,1800,1830,1930',
      actualTimeCard: '    ,        ,        ,1601,        ,        ,        ,        ,        ,        ',
      absent: '',
      overtimeHours: '0',
      attendanceDate: todayDate,
    });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( အဝင္တိုင္းကဒ် မရွိပါ )');
  });

  it('post-shift OT in Slot 7 with overtime hours in Col R → "( 2 နာရီ အိုတီတင္ပီး )"', () => {
    const row = makeRow('', {
      klass: '11',
      standardTimeCard: '0700,1200,1300,1600,0330,0630,1600,1800,1830,1930',
      actualTimeCard: '0700,        ,        ,        ,        ,        ,        ,1803,        ,        ',
      absent: '',
      overtimeHours: '2',
      attendanceDate: todayDate,
    });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( 2 နာရီ အိုတီတင္ပီး )');
  });

  it('Row 1639 (Shift 14, in 18:56, out 05:02 next day, OT 5 hrs) → "( 5 နာရီ အိုတီတင္ပီး )", NOT missing checkout', () => {
    const row = makeRow('1856,        ,        ,        ,        ,        ,        ,0502', {
      klass: '14',
      standardTimeCard: '1900,2300,1530,1830,2300,0000,0100,0500',
      overtimeHours: '5',
      absent: '0',
      attendanceDate: todayDate,
    });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( 5 နာရီ အိုတီတင္ပီး )');
  });

  it('pre-shift early arrival (came in at 05:00 for 07:00 shift, left on time) → "( 2 နာရီ အိုတီတင္ရန္ )"', () => {
    const row = makeRow('0500,1600', { klass: '11', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime)).toBe('( 2 နာရီ အိုတီတင္ရန္ )');
  });

  it('two distinct punches never remark missing checkout or missing checkin', () => {
    const row = makeRow('1856,0502', { klass: '14', attendanceDate: todayDate });
    const rem = computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate, afternoonTime);
    expect(rem).not.toContain('မရွိပါ');
  });
});

describe('isRowResolved', () => {
  it('empty remarks → resolved', () => {
    const row = makeRow('0700,1600', { remarks: '' });
    expect(isRowResolved(row)).toBe(true);
  });

  it('ခြင့္တိုင္ၿပီး → resolved', () => {
    const row = makeRow('0700,1600', { remarks: '( Absent / 8 hours ခြင့္တိုင္ၿပီး )' });
    expect(isRowResolved(row)).toBe(true);
  });

  it('အိုတီတင္ပီး → resolved', () => {
    const row = makeRow('0700,1600', { remarks: '( 2.5 နာရီ အိုတီတင္ပီး )' });
    expect(isRowResolved(row)).toBe(true);
  });

  it('ခြင့္တိုင္ၿပီး ႏွင့္ အိုတီတင္ပီး → resolved', () => {
    const row = makeRow('0700,1600', { remarks: '( Absent / 8 hours ခြင့္တိုင္ၿပီး ႏွင့္ 2.5 နာရီ အိုတီတင္ပီး )' });
    expect(isRowResolved(row)).toBe(true);
  });

  it('contains ခြင့္တိုင္ရန္ → NOT resolved', () => {
    const row = makeRow('0700,1600', { remarks: '( Absent / 8 hours ခြင့္တိုင္ရန္ )' });
    expect(isRowResolved(row)).toBe(false);
  });

  it('contains အိုတီတင္ရန္ → NOT resolved', () => {
    const row = makeRow('0700,1600', { remarks: '( 1 နာရီ အိုတီတင္ရန္ )' });
    expect(isRowResolved(row)).toBe(false);
  });
});
