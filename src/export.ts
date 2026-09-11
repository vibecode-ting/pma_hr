/**
 * export.ts — Builds and downloads output .xlsx workbooks.
 *
 * Supports three export modes:
 *   - 'per-group'       : one workbook per selected group code
 *   - 'combined'        : one workbook containing all selected group codes
 *   - 'per-source-file' : one workbook per original uploaded file (ignores group selection)
 *
 * If the result is more than one workbook, all are zipped into attendance_export.zip
 * before download, to avoid triggering multiple browser download prompts.
 */

import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import type { AttendanceRow, ExportMode } from './types';

/** Output column order — must match the spec in plan.md exactly */
const OUTPUT_HEADERS = [
  'Employee ID',
  'Name',
  'Group Code',
  'Group Name',
  'Attendance Date',
  'Actual Time Card',
  'Absent',
  'Class',
  'Remarks',
] as const;

/** Approximate column widths (in Excel character units) for readability */
const COLUMN_WIDTHS: Record<string, number> = {
  'Employee ID': 14,
  Name: 28,
  'Group Code': 12,
  'Group Name': 16,
  'Attendance Date': 16,
  'Actual Time Card': 38,
  Absent: 10,
  Class: 8,
  Remarks: 42,
};

/**
 * Convert an array of AttendanceRows to a 2D array for SheetJS,
 * in the exact 9-column output order.
 */
function rowsToAoa(rows: AttendanceRow[]): (string | number)[][] {
  const header: string[] = [...OUTPUT_HEADERS];
  const dataRows = rows.map((r) => [
    r.employeeId,
    r.name,
    r.groupCode,
    r.groupName,
    r.attendanceDate,
    r.actualTimeCard,
    r.absent,
    r.klass,
    r.remarks,
  ]);
  return [header, ...dataRows];
}

/**
 * Build a single-sheet XLSX WorkBook from an array of AttendanceRows.
 * Includes: frozen header row, autofilter, reasonable column widths.
 */
export function buildWorkbook(rows: AttendanceRow[]): XLSX.WorkBook {
  const aoa = rowsToAoa(rows);
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Freeze the header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };

  // AutoFilter over the entire used range
  const totalCols = OUTPUT_HEADERS.length;
  const totalRows = aoa.length;
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: totalRows - 1, c: totalCols - 1 },
    }),
  };

  // Column widths
  ws['!cols'] = OUTPUT_HEADERS.map((h) => ({ wch: COLUMN_WIDTHS[h] ?? 16 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  return wb;
}

/**
 * Trigger a browser download of a WorkBook as an .xlsx file.
 */
export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const wbArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename);
}

/**
 * Trigger a browser download of arbitrary Blob data.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Sanitize a string for use in a filename (replace non-alphanumeric with underscores).
 */
function sanitize(s: string): string {
  return s.replace(/[^\w.-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Main export entry point: builds and downloads workbooks according to the chosen mode.
 *
 * @param rows           All parsed + remark-computed AttendanceRows
 * @param selectedGroups Set of group codes checked by the user
 * @param mode           Export mode selected by the user
 * @param onProgress     Optional progress callback (called with a status message)
 */
export async function exportSelection(
  rows: AttendanceRow[],
  selectedGroups: Set<string>,
  mode: ExportMode,
  onProgress?: (msg: string) => void
): Promise<void> {
  const log = (msg: string) => onProgress?.(msg);

  let workbooks: Array<{ wb: XLSX.WorkBook; filename: string }> = [];

  if (mode === 'per-group') {
    // One workbook per selected group code
    for (const groupCode of selectedGroups) {
      const groupRows = rows.filter((r) => r.groupCode === groupCode);
      if (groupRows.length === 0) continue;
      const groupName = sanitize(groupRows[0].groupName || groupCode);
      const wb = buildWorkbook(groupRows);
      workbooks.push({ wb, filename: `attendance_${sanitize(groupCode)}_${groupName}.xlsx` });
    }
  } else if (mode === 'combined') {
    // One workbook for all selected group codes combined
    const filteredRows = rows.filter((r) => selectedGroups.has(r.groupCode));
    const wb = buildWorkbook(filteredRows);
    workbooks.push({ wb, filename: 'attendance_combined.xlsx' });
  } else if (mode === 'per-source-file') {
    // One workbook per source file — ignore group selection
    const sourceFiles = [...new Set(rows.map((r) => r.sourceFile))];
    for (const sourceFile of sourceFiles) {
      const fileRows = rows.filter((r) => r.sourceFile === sourceFile);
      const baseName = sourceFile.replace(/\.[^.]+$/, ''); // strip extension
      const wb = buildWorkbook(fileRows);
      workbooks.push({ wb, filename: `attendance_${sanitize(baseName)}.xlsx` });
    }
  }

  if (workbooks.length === 0) {
    log('No rows matched the current selection — nothing to download.');
    return;
  }

  if (workbooks.length === 1) {
    // Single file: download directly without zipping
    log(`Downloading ${workbooks[0].filename}…`);
    downloadWorkbook(workbooks[0].wb, workbooks[0].filename);
    return;
  }

  // Multiple files: zip them all into one download
  log(`Building ZIP with ${workbooks.length} files…`);
  const zip = new JSZip();
  for (const { wb, filename } of workbooks) {
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    zip.file(filename, buf);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  log('Downloading attendance_export.zip…');
  triggerDownload(zipBlob, 'attendance_export.zip');
}

/**
 * Compute a preview summary of what the current export will produce.
 */
export function exportPreviewSummary(
  rows: AttendanceRow[],
  selectedGroups: Set<string>,
  mode: ExportMode
): { fileCount: number; rowCount: number } {
  if (mode === 'per-group') {
    const groupCodes = [...selectedGroups].filter((gc) => rows.some((r) => r.groupCode === gc));
    const rowCount = rows.filter((r) => selectedGroups.has(r.groupCode)).length;
    return { fileCount: groupCodes.length, rowCount };
  } else if (mode === 'combined') {
    const rowCount = rows.filter((r) => selectedGroups.has(r.groupCode)).length;
    return { fileCount: rowCount > 0 ? 1 : 0, rowCount };
  } else {
    // per-source-file
    const sourceFiles = new Set(rows.map((r) => r.sourceFile));
    return { fileCount: sourceFiles.size, rowCount: rows.length };
  }
}
