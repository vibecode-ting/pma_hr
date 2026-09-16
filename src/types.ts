/**
 * Shared TypeScript types for the HR-Portal Attendance Error Automation Tool.
 */

/**
 * A single data row from an attendance export file, after parsing.
 * Field names follow the output column spec from plan.md.
 *
 * Encoding note: `name`, `groupName`, `standardTimeCard`, `actualTimeCard`, and
 * `absent` are passed through byte-for-byte / value-for-value from the source file.
 * The source uses Zawgyi encoding in string fields. Do NOT normalize or re-encode them.
 *
 * Only `employeeId`, `groupCode`, and `klass` are trimmed (trailing/leading whitespace).
 */
export interface AttendanceRow {
  /** Original uploaded filename — used for "one file per source" export mode */
  sourceFile: string;

  /** Trimmed numeric string, e.g. "A001" */
  employeeId: string;

  /** Raw Myanmar/Zawgyi-encoded name — do not alter */
  name: string;

  /** Trimmed group code, e.g. "0014" */
  groupCode: string;

  /** Raw group name — do not alter */
  groupName: string;

  /** Raw attendance date — typically "YYYYMMDD" text or may come as a JS Date serial */
  attendanceDate: string;

  /** Raw comma-separated standard (scheduled) time card, e.g. "0700,1200,1300,1600" */
  standardTimeCard: string;

  /** Raw comma-separated actual time card, e.g. "0722,0722,    ,    " */
  actualTimeCard: string;

  /** Raw absent value from source — pass through unchanged, do not recompute */
  absent: string;

  /** Raw overtime hours value from source (Column R) */
  overtimeHours: string;

  /** Trimmed class value, e.g. "11" (field named `klass` because `class` is a JS keyword) */
  klass: string;

  /** Computed remark — empty string means no remark for this row */
  remarks: string;
}

export interface ResourceLink {
  label: string;
  url: string;
}

/**
 * Schema for config.json (fetched at runtime, not bundled).
 */
export interface AppConfig {
  version?: string;
  appTitle: string;
  accounts: Array<{
    username: string;
    password: string;
    displayName: string;
  }>;
  resources?: ResourceLink[];
}

/**
 * Supported themes.
 */
export type Theme = 'dark' | 'light';

/**
 * Filter criteria for Live Preview.
 */
export interface LiveFilterState {
  idNo: string;
  name?: string;
  groupCode: string;
  date: string;
  klass?: string;
  remarks: string;
  absent?: string;
  overtime?: string;
  hideResolved?: boolean;
  hideFutureShifts?: boolean;
  hideApplied?: boolean;
  hideNoCheckout?: boolean;
}

/**
 * Supported UI locales.
 */
export type Locale = 'en' | 'my' | 'zh-Hant';

/**
 * Session data stored in sessionStorage after successful login.
 */
export interface SessionData {
  username: string;
  displayName: string;
}

/**
 * Result of parsing a single uploaded file.
 */
export interface ParseResult {
  rows: AttendanceRow[];
  errors: string[];
}

/**
 * Export modes available to the user.
 */
export type ExportMode = 'per-group' | 'combined' | 'per-source-file';

export interface ShiftConfig {
  shiftNo: string;
  shiftName: string;
  startTime: string;
  lunchTime: string;
  endTime: string;
}

/**
 * Runtime-configurable rule thresholds and remark strings.
 * Loaded from /rules.json at startup; falls back to hardcoded defaults.
 */
export interface RulesConfig {
  graceMinutes: number;
  earlyOutGraceMinutes: number;
  otThresholdMinutes: number;
  remarkLateSuffix: string;
  remarkNoRecord: string;
  remarkNoCheckout: string;
  remarkNoCheckin?: string;
  remarkOtSuffix: string;
  remarkLeaveApplied?: string;
  remarkOtApplied?: string;
  remarkLate?: string;
  remarkNightShift?: string;
  shifts: ShiftConfig[];
}

