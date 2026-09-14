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
    absent: '0',
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
    // 07:00 to 16:00 (420 to 960) = 540 min elapsed, 60 min lunch = 480 min (8 hrs)
    expect(computeWorkMinutes(420, 960, lunch)).toBe(480);
  });

  it('user arrives at 12:00 (missed work time before 12:00 excluding lunch)', () => {
    // 07:00 to 12:00 = 300 min elapsed. Lunch overlap [11:30..12:00] = 30 min.
    // Missed work = 270 min = 4.5 hours!
    expect(computeWorkMinutes(420, 720, lunch)).toBe(270);
  });

  it('computes missed work for early out at 12:30', () => {
    // End is 16:00 (960). Left at 12:30 (750).
    // Lunch [690..750] doesn't overlap [750..960].
    // Missed work = 960 - 750 = 210 min = 3.5 hours!
    expect(computeWorkMinutes(750, 960, lunch)).toBe(210);
  });
});

describe('computeRemark - Shift Schedule Rules', () => {
  const pastDate = '20260909';
  const todayDate = '20260914';

  it('10 minutes late → no remark (within grace period)', () => {
    const row = makeRow('0710,1600', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('');
  });

  it('11 minutes late → "( 11 မိနစ် ခွင့်တိုင်ရန် )"', () => {
    const row = makeRow('0711,1600', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 11 မိနစ် ခွင့်တိုင်ရန် )');
  });

  it('22 minutes late → "( 22 မိနစ် ခွင့်တိုင်ရန် )"', () => {
    const row = makeRow('0722,1600', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 22 မိနစ် ခွင့်တိုင်ရန် )');
  });

  it('user shows up at 12:00 for Shift 11 (07:00 start, 11:30~12:30 lunch) → "( 4.5 နာရီ ခွင့်တိုင်ရန် )"', () => {
    const row = makeRow('1200,1600', { klass: '11', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 4.5 နာရီ ခွင့်တိုင်ရန် )');
  });

  it('completely blank actual card for 8h shift → "( 8 နာရီ ခွင့်တိုင်ရန် )"', () => {
    const row = makeRow('    ,    ', { klass: '11', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 8 နာရီ ခွင့်တိုင်ရန် )');
  });

  it('completely blank actual card for 4h shift (Shift 13 Sat) → "( 4 နာရီ ခွင့်တိုင်ရန် )"', () => {
    const row = makeRow('    ,    ', { klass: '13', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 4 နာရီ ခွင့်တိုင်ရန် )');
  });

  it('uploading today date with only check-in punch → does NOT write missing checkout remark', () => {
    // Punch at 06:49, no checkout yet, date is today
    const row = makeRow('0649,        ', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('');
  });

  it('uploading past date with only check-in punch and default empty checkout remark → ""', () => {
    const row = makeRow('0649,        ', { attendanceDate: pastDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('');
  });

  it('uploading past date with only check-in punch and custom missing checkout remark → writes remark', () => {
    const row = makeRow('0649,        ', { attendanceDate: pastDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS, remarkNoCheckout: 'အထွက်တိုင်းကာဒ်မရှိပါ။' }, todayDate)).toBe('အထွက်တိုင်းကာဒ်မရှိပါ။');
  });

  it('checkout at 15:50 (10 min early) → safe (within early out grace)', () => {
    const row = makeRow('0655,1550', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('');
  });

  it('checkout at 15:49 (11 min early) → "( 11 မိနစ် ခွင့်တိုင်ရန် )"', () => {
    const row = makeRow('0655,1549', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 11 မိနစ် ခွင့်တိုင်ရန် )');
  });

  it('early checkout half-day at 12:30 → "( 3.5 နာရီ ခွင့်တိုင်ရန် )"', () => {
    const row = makeRow('0655,1230', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 3.5 နာရီ ခွင့်တိုင်ရန် )');
  });

  it('overtime punch at 16:25 (25m past 16:00, col R empty) → "( 0.5 hour အိုတီ တင်ရန် )"', () => {
    const row = makeRow('0655,1625', { attendanceDate: todayDate, overtimeHours: '0' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 0.5 hour အိုတီ တင်ရန် )');
  });

  it('overtime punch at 17:00 (60m past 16:00, col R empty) → "( 1 hour အိုတီ တင်ရန် )"', () => {
    const row = makeRow('0655,1700', { attendanceDate: todayDate, overtimeHours: '0' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 1 hour အိုတီ တင်ရန် )');
  });

  it('overtime punch present, but overtimeHours already has value in Col R → no OT remark', () => {
    const row = makeRow('0655,1630', { attendanceDate: todayDate, overtimeHours: '0.5' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('');
  });
});
