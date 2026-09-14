/**
 * parse.ts — Reads uploaded .xls/.xlsx attendance export files using SheetJS.
 *
 * Key invariants enforced here (per plan.md):
 * - Columns are found by HEADER NAME in row 1, never by position.
 * - Row 2 is always blank (skipped).
 * - Data starts at row 3 (index 2 in 0-based).
 * - Column A's value in row 1 is a stray count — we ignore column A entirely.
 * - `name`, `groupName`, `standardTimeCard`, `actualTimeCard`, `absent` are
 *   passed through raw — no trimming, no normalization, no re-encoding.
 * - `employeeId`, `groupCode`, `klass` are trimmed.
 * - Source file's Attendance Date may arrive as text ("YYYYMMDD") or as a JS Date
 *   serial (SheetJS may decode real Excel date cells) — both are normalized to
 *   "YYYYMMDD" string.
 */

import * as XLSX from 'xlsx';
import type { AttendanceRow, ParseResult } from './types';

/** Headers we must find in row 1 (exact, case-sensitive, trimmed). */
const REQUIRED_HEADERS = [
  'Employee ID',
  'Name',
  'Group Code',
  'Group Name',
  'Attendance Date',
  'Standard Time Card',
  'Actual Time Card',
  'Absent',
  'Class',
] as const;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number] | 'Overtime hours';

/**
 * Normalize a cell value to a string.
 * Returns an empty string for null/undefined cells.
 */
function cellToString(cell: XLSX.CellObject | undefined): string {
  if (cell == null) return '';
  if (cell.t === 'n') return String(cell.v ?? '');
  if (cell.t === 'd') return cell.v instanceof Date ? String(cell.v) : String(cell.v ?? '');
  return String(cell.v ?? '');
}

/**
 * Normalize an Attendance Date cell value to a YYYYMMDD string.
 * The source may provide:
 *   (a) a text string already in YYYYMMDD format, e.g. "20260910"
 *   (b) a JS Date object (SheetJS decoded a real Excel date serial)
 *   (c) an Excel date serial number (integer, e.g. 46185)
 * All are normalized to "YYYYMMDD".
 */
function normalizeAttendanceDate(cell: XLSX.CellObject | undefined): string {
  if (cell == null) return '';

  // Case (b): SheetJS decoded a real date cell into a JS Date
  if (cell.t === 'd' && cell.v instanceof Date) {
    const d = cell.v as Date;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  // Case (c): numeric date serial (Excel epoch: Jan 1 1900 = 1, with the leap-year bug)
  if (cell.t === 'n' && typeof cell.v === 'number') {
    // Use XLSX's utility to convert serial → JS Date
    const jsDate = XLSX.SSF.parse_date_code(cell.v);
    if (jsDate) {
      const y = jsDate.y;
      const m = String(jsDate.m).padStart(2, '0');
      const d = String(jsDate.d).padStart(2, '0');
      return `${y}${m}${d}`;
    }
    return String(cell.v);
  }

  // Case (a): already a text YYYYMMDD string — return as-is
  return String(cell.v ?? '');
}

/**
 * Build a column-address → header-name map from row 1 of a sheet.
 * Column A (index 0) is intentionally skipped (it's a stray count in the source).
 *
 * @returns A map from column letter (e.g. "B", "C") to trimmed header text
 */
function buildHeaderMap(sheet: XLSX.WorkSheet): Map<string, string> {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const map = new Map<string, string>();
  for (let col = 1; col <= range.e.c; col++) {
    // Skip column A (col index 0) per spec
    const addr = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = sheet[addr] as XLSX.CellObject | undefined;
    if (cell) {
      const header = String(cell.v ?? '').trim();
      if (header) map.set(addr.replace(/\d+/, ''), header);
    }
  }
  return map;
}

/**
 * Given the header map, return a map from header name → column letter.
 * Validates that all required headers are present.
 * Supports Absent in Column O or P, and Overtime hours in Column R.
 */
function resolveColumns(
  headerMap: Map<string, string>,
  fileName: string
): { colMap: Map<RequiredHeader, string>; missing: string[] } {
  const colMap = new Map<RequiredHeader, string>();
  const missing: string[] = [];

  for (const header of REQUIRED_HEADERS) {
    if (header === 'Absent') {
      // Check column 'O' and 'P' for header 'Absent'
      const oHeader = headerMap.get('O');
      const pHeader = headerMap.get('P');
      if (oHeader && /^absent$/i.test(oHeader)) {
        colMap.set('Absent', 'O');
        continue;
      }
      if (pHeader && /^absent$/i.test(pHeader)) {
        colMap.set('Absent', 'P');
        continue;
      }
      // Check any column matching 'Absent'
      let foundCol: string | null = null;
      for (const [col, name] of headerMap) {
        if (/^absent$/i.test(name)) {
          foundCol = col;
          break;
        }
      }
      if (foundCol) {
        colMap.set('Absent', foundCol);
        continue;
      }
      // Fallback: if 'O' exists in sheet headers, use 'O'; otherwise 'P'
      if (oHeader !== undefined) {
        colMap.set('Absent', 'O');
        continue;
      }
      if (pHeader !== undefined) {
        colMap.set('Absent', 'P');
        continue;
      }
      missing.push('Absent');
      continue;
    }

    let found = false;
    for (const [col, name] of headerMap) {
      if (name === header) {
        colMap.set(header, col);
        found = true;
        break;
      }
    }
    if (!found) missing.push(header);
  }

  // Optional Overtime hours column (typically Column R)
  const rHeader = headerMap.get('R');
  if (rHeader && /overtime/i.test(rHeader)) {
    colMap.set('Overtime hours', 'R');
  } else {
    for (const [col, name] of headerMap) {
      if (/overtime\s*hours/i.test(name) || /^overtime/i.test(name)) {
        colMap.set('Overtime hours', col);
        break;
      }
    }
    if (!colMap.has('Overtime hours') && rHeader !== undefined) {
      colMap.set('Overtime hours', 'R');
    }
  }

  return { colMap, missing };
}

/**
 * Parse a single SheetJS WorkBook into AttendanceRow[].
 */
function parseSheet(
  sheet: XLSX.WorkSheet,
  fileName: string
): { rows: AttendanceRow[]; errors: string[] } {
  const errors: string[] = [];

  const headerMap = buildHeaderMap(sheet);
  const { colMap, missing } = resolveColumns(headerMap, fileName);

  if (missing.length > 0) {
    errors.push(
      `"${fileName}": Missing required column(s): ${missing.map((h) => `"${h}"`).join(', ')}`
    );
    return { rows: [], errors };
  }

  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const rows: AttendanceRow[] = [];

  // Data starts at row index 2 (row 3 in 1-based; row 1 = headers, row 2 = blank)
  for (let rowIdx = 2; rowIdx <= range.e.r; rowIdx++) {
    const getCell = (header: RequiredHeader) => {
      const col = colMap.get(header);
      if (!col) return undefined;
      const addr = `${col}${rowIdx + 1}`; // SheetJS uses 1-based row in addresses
      return sheet[addr] as XLSX.CellObject | undefined;
    };

    // Stop at first fully empty row
    const empIdCell = getCell('Employee ID');
    const nameCell = getCell('Name');
    if (!empIdCell && !nameCell) continue;

    const employeeId = cellToString(empIdCell).trim();
    const name = cellToString(nameCell); // RAW — do not trim
    const groupCode = cellToString(getCell('Group Code')).trim();
    const groupName = cellToString(getCell('Group Name')); // RAW — do not trim
    const attendanceDate = normalizeAttendanceDate(getCell('Attendance Date'));
    const standardTimeCard = cellToString(getCell('Standard Time Card')); // RAW
    const actualTimeCard = cellToString(getCell('Actual Time Card')); // RAW
    const absent = cellToString(getCell('Absent')).trim();
    const klass = cellToString(getCell('Class')).trim();

    // Skip rows where all meaningful fields are blank
    if (!employeeId && !name && !groupCode && !attendanceDate) continue;

    // Requirement #2: "My app logic need to catch only where this values is greather than 0 ."
    const absentNum = parseFloat(absent);
    if (isNaN(absentNum) || absentNum <= 0) continue;

    const otCell = getCell('Overtime hours');
    const overtimeHours = cellToString(otCell).trim() || '0';

    rows.push({
      sourceFile: fileName,
      employeeId,
      name,
      groupCode,
      groupName,
      attendanceDate,
      standardTimeCard,
      actualTimeCard,
      absent,
      overtimeHours,
      klass,
      remarks: '', // computed later by rules.ts
    });
  }

  return { rows, errors };
}

/**
 * Parse a single uploaded File (`.xls` or `.xlsx`) into AttendanceRows.
 * Uses FileReader + XLSX.read with `type: 'array'` — supports both legacy BIFF and modern xlsx.
 */
export function parseWorkbookFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(data, {
          type: 'array',
          cellDates: true, // Ask SheetJS to parse date cells as JS Date objects
          raw: false, // Return formatted text for text cells
        });

        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) {
          resolve({
            rows: [],
            errors: [`"${file.name}": Workbook has no sheets.`],
          });
          return;
        }

        const sheet = wb.Sheets[firstSheet];
        if (!sheet || !sheet['!ref']) {
          resolve({
            rows: [],
            errors: [`"${file.name}": First sheet is empty.`],
          });
          return;
        }

        const { rows, errors } = parseSheet(sheet, file.name);
        resolve({ rows, errors });
      } catch (err) {
        resolve({
          rows: [],
          errors: [
            `"${file.name}": Failed to parse — ${err instanceof Error ? err.message : String(err)}`,
          ],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        rows: [],
        errors: [`"${file.name}": File read error — ${reader.error?.message ?? 'unknown'}`],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse all files in a FileList (or array of Files), merging rows and collecting per-file errors.
 */
export async function parseAllFiles(files: File[]): Promise<ParseResult> {
  const allRows: AttendanceRow[] = [];
  const allErrors: string[] = [];

  for (const file of files) {
    const { rows, errors } = await parseWorkbookFile(file);
    allRows.push(...rows);
    allErrors.push(...errors);
  }

  return { rows: allRows, errors: allErrors };
}
