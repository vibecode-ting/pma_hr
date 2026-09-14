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

  it('10 minutes late → no remark (within grace period)', () => {
    const row = makeRow('0710,1600', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('');
  });

  it('11 minutes late with absent empty → "( 11 မိနစ် ခွင့်တိုင်ရန် )"', () => {
    const row = makeRow('0711,1600', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 11 မိနစ် ခွင့်တိုင်ရန် )');
  });

  it('11 minutes late with absent == 0 → "ခွင့်တိုင်ပြီး"', () => {
    const row = makeRow('0711,1600', { absent: '0', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('ခွင့်တိုင်ပြီး');
  });

  it('user shows up at 12:00 for Shift 11 (07:00 start, 11:30~12:30 lunch) → "( 4.5 နာရီ ခွင့်တိုင်ရန် )"', () => {
    const row = makeRow('1200,1600', { klass: '11', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 4.5 နာရီ ခွင့်တိုင်ရန် )');
  });

  it('user shows up at 12:00 with absent == 0 → "ခွင့်တိုင်ပြီး"', () => {
    const row = makeRow('1200,1600', { klass: '11', absent: '0', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('ခွင့်တိုင်ပြီး');
  });

  it('completely blank actual card → "( 8 နာရီ ခွင့်တိုင်ရန် )"', () => {
    const row = makeRow('    ,    ', { klass: '11', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 8 နာရီ ခွင့်တိုင်ရန် )');
  });

  it('completely blank actual card with absent == 0 → "ခွင့်တိုင်ပြီး"', () => {
    const row = makeRow('    ,    ', { klass: '11', absent: '0', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('ခွင့်တိုင်ပြီး');
  });

  it('checkout at 15:50 (10 min early) → safe (within early out grace)', () => {
    const row = makeRow('0655,1550', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('');
  });

  it('early checkout half-day at 12:30 → "( 3.5 နာရီ ခွင့်တိုင်ရန် )"', () => {
    const row = makeRow('0655,1230', { attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 3.5 နာရီ ခွင့်တိုင်ရန် )');
  });

  it('early checkout with absent == 0 → "ခွင့်တိုင်ပြီး"', () => {
    const row = makeRow('0655,1230', { absent: '0', attendanceDate: todayDate });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('ခွင့်တိုင်ပြီး');
  });

  it('overtime punch at 17:00 (1h OT, col R empty) → "( 1 hour အိုတီတင်ရန် )"', () => {
    const row = makeRow('0655,1700', { attendanceDate: todayDate, overtimeHours: '0' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 1 hour အိုတီတင်ရန် )');
  });

  it('overtime punch at 17:00 and overtimeHours in Col R equals 1 → "အိုတီတင်ပီး"', () => {
    const row = makeRow('0655,1700', { attendanceDate: todayDate, overtimeHours: '1' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('အိုတီတင်ပီး');
  });

  it('Saturday shift 13 (07:00~11:00) checkout 14:30 with 1h lunch deduction → 2.5h OT needed if col R empty', () => {
    const row = makeRow('0655,1430', { klass: '13', attendanceDate: todayDate, overtimeHours: '0' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('( 2.5 hour အိုတီတင်ရန် )');
  });

  it('Saturday shift 13 checkout 14:30 when col R has 2.5 hrs → "အိုတီတင်ပီး"', () => {
    const row = makeRow('0655,1430', { klass: '13', attendanceDate: todayDate, overtimeHours: '2.5' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('အိုတီတင်ပီး');
  });

  it('Saturday shift 13 checkout 14:00 when col R has 2 hrs → "အိုတီတင်ပီး"', () => {
    const row = makeRow('0655,1400', { klass: '13', attendanceDate: todayDate, overtimeHours: '2' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('အိုတီတင်ပီး');
  });

  it('both leave applied and overtime applied → "ခွင့်တိုင်ပြီး အိုတီတင်ပီး"', () => {
    const row = makeRow('0720,1700', { attendanceDate: todayDate, absent: '0', overtimeHours: '1' });
    expect(computeRemark(row, { shifts: DEFAULT_SHIFTS }, todayDate)).toBe('ခွင့်တိုင်ပြီး အိုတီတင်ပီး');
  });
});

describe('isRowResolved', () => {
  it('empty remarks → resolved', () => {
    const row = makeRow('0700,1600', { remarks: '' });
    expect(isRowResolved(row)).toBe(true);
  });

  it('ခွင့်တိုင်ပြီး → resolved', () => {
    const row = makeRow('0700,1600', { remarks: 'ခွင့်တိုင်ပြီး' });
    expect(isRowResolved(row)).toBe(true);
  });

  it('အိုတီတင်ပီး → resolved', () => {
    const row = makeRow('0700,1600', { remarks: 'အိုတီတင်ပီး' });
    expect(isRowResolved(row)).toBe(true);
  });

  it('ခွင့်တိုင်ပြီး အိုတီတင်ပီး → resolved', () => {
    const row = makeRow('0700,1600', { remarks: 'ခွင့်တိုင်ပြီး အိုတီတင်ပီး' });
    expect(isRowResolved(row)).toBe(true);
  });

  it('contains ခွင့်တိုင်ရန် → NOT resolved', () => {
    const row = makeRow('0700,1600', { remarks: '( 8 နာရီ ခွင့်တိုင်ရန် )' });
    expect(isRowResolved(row)).toBe(false);
  });

  it('contains အိုတီတင်ရန် → NOT resolved', () => {
    const row = makeRow('0700,1600', { remarks: '( 1 hour အိုတီတင်ရန် )' });
    expect(isRowResolved(row)).toBe(false);
  });
});
