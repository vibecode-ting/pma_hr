/**
 * rules.test.ts — Vitest unit tests for src/rules.ts
 *
 * Covers all 7 cases specified in plan.md's PROMPT 3.
 */

import { describe, it, expect } from 'vitest';
import {
  computeRemark,
  hhmmToMinutes,
  computeLateHours,
  GRACE_MINUTES,
  REMARK_LATE_SUFFIX,
  REMARK_NO_RECORD,
  REMARK_NO_CHECKOUT,
} from './rules';
import type { AttendanceRow } from './types';

// ─── Helper to build a test AttendanceRow ────────────────────────────────────

function makeRow(
  standard: string,
  actual: string,
  overrides: Partial<AttendanceRow> = {}
): AttendanceRow {
  return {
    sourceFile: 'test.xls',
    employeeId: 'TEST001',
    name: 'Test Employee',
    groupCode: '0014',
    groupName: 'IT',
    attendanceDate: '20260910',
    standardTimeCard: standard,
    actualTimeCard: actual,
    absent: '0',
    overtimeHours: '0',
    klass: '11',
    remarks: '',
    ...overrides,
  };
}

// ─── hhmmToMinutes ───────────────────────────────────────────────────────────

describe('hhmmToMinutes', () => {
  it('converts "0700" to 420', () => expect(hhmmToMinutes('0700')).toBe(420));
  it('converts "1830" to 1110', () => expect(hhmmToMinutes('1830')).toBe(1110));
  it('returns null for blank', () => expect(hhmmToMinutes('    ')).toBeNull());
  it('returns null for empty', () => expect(hhmmToMinutes('')).toBeNull());
  it('returns null for non-numeric', () => expect(hhmmToMinutes('abcd')).toBeNull());
  it('handles leading zeros', () => expect(hhmmToMinutes('0030')).toBe(30));
});

// ─── computeLateHours ────────────────────────────────────────────────────────

describe('computeLateHours', () => {
  it('22 minutes late → 0.36', () => expect(computeLateHours(22)).toBe(0.36));
  it('12 minutes late → 0.2', () => expect(computeLateHours(12)).toBe(0.2));
  it('11 minutes late → 0.18', () => expect(computeLateHours(11)).toBe(0.18));
  it('60 minutes late → 1', () => expect(computeLateHours(60)).toBe(1));
  it('1 minute late → 0.01', () => expect(computeLateHours(1)).toBe(0.01));
});

// ─── computeRemark — the 7 required test cases from plan.md ─────────────────

describe('computeRemark', () => {
  // Case 1: 22 minutes late → "0.36 <suffix>"
  it('22 minutes late → "0.36 ..."', () => {
    const row = makeRow('0700,1200,1300,1600', '0722,0722,    ,    ');
    expect(computeRemark(row)).toBe(`0.36 ${REMARK_LATE_SUFFIX}`);
  });

  // Case 2: 12 minutes late → "0.2 <suffix>"
  it('12 minutes late → "0.2 ..."', () => {
    const row = makeRow('0700,1200,1300,1600', '0712,0712,    ,    ');
    expect(computeRemark(row)).toBe(`0.2 ${REMARK_LATE_SUFFIX}`);
  });

  // Case 3: exactly 10 minutes late → no remark (within grace period)
  it(`exactly ${GRACE_MINUTES} minutes late → no remark`, () => {
    const row = makeRow('0700,1200,1300,1600', '0710,1200,1300,1600');
    expect(computeRemark(row)).toBe('');
  });

  // Case 4: exactly 11 minutes late → smallest non-zero remark
  it('exactly 11 minutes late → "0.18 ..."', () => {
    const row = makeRow('0700,1200,1300,1600', '0711,    ,    ,    ');
    expect(computeRemark(row)).toBe(`0.18 ${REMARK_LATE_SUFFIX}`);
  });

  // Case 5: fully blank actual time card → REMARK_NO_RECORD
  it('fully blank actual time card → NO_RECORD', () => {
    const row = makeRow('0700,1200,1300,1600', '    ,    ,    ,    ');
    expect(computeRemark(row)).toBe(REMARK_NO_RECORD);
  });

  // Case 6: check-in present, but last scheduled slot blank in actual → REMARK_NO_CHECKOUT
  it('check-in present, last scheduled slot blank in actual → NO_CHECKOUT', () => {
    // Has a check-in, last scheduled slot (1600) has no actual punch
    const row = makeRow('0700,1200,1300,1600', '0700,1200,1300,    ');
    expect(computeRemark(row)).toBe(REMARK_NO_CHECKOUT);
  });

  // Case 7: normal on-time, complete day → ""
  it('normal on-time, complete day → ""', () => {
    const row = makeRow('0700,1200,1300,1600', '0700,1200,1300,1600');
    expect(computeRemark(row)).toBe('');
  });

  // Bonus: early arrival → no remark
  it('early arrival (negative lateMinutes) → ""', () => {
    const row = makeRow('0700,1200,1300,1600', '0655,1200,1300,1600');
    expect(computeRemark(row)).toBe('');
  });

  // Bonus: malformed actual time (non-numeric) → gracefully skip late check, fall through
  it('malformed actual time → does not throw', () => {
    const row = makeRow('0700,1200', 'XXXX,1200');
    expect(() => computeRemark(row)).not.toThrow();
  });

  // Bonus: NO_RECORD takes precedence over late check (all blank)
  it('NO_RECORD has higher precedence than late check-in (all blanks wins)', () => {
    const row = makeRow('0700,1200,1300,1600', '    ,    ,    ,    ');
    expect(computeRemark(row)).toBe(REMARK_NO_RECORD);
  });
});
