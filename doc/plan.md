# Attendance Report Generator — Build Plan for Claude Code

This document is a **ready-to-paste prompt sequence**. Give each "PROMPT" block to
Claude Code, one at a time, in order. Each one assumes the previous one is done.
Everything Claude Code needs to know about the real data (verified against the
actual sample file `1-9.xls`) is written directly into the prompts so it does not
have to guess.

---

## 0. What we're building (read this first, don't paste it)

A **static, client-side-only web app** (no backend, deployable to GitHub Pages)
that:

1. Lets a user upload one or more attendance export files (`.xls` legacy binary
   or `.xlsx`) produced by the company's attendance system.
2. Parses them entirely in the browser (SheetJS), keeping every original string
   value byte-for-byte (see the Myanmar/Zawgyi encoding note below — this matters).
3. Computes a `Remarks` value per row using a late-check-in rule.
4. Lets the user choose how to export the **9-column result**:
   - one workbook per Group Code,
   - one combined workbook for a chosen subset of Group Codes,
   - or one workbook per uploaded source file (all groups together).
5. Generates and downloads real `.xlsx` file(s) (zipped if more than one),
   matching the column layout of the example screenshot.

### Verified facts about the real input file format

The uploaded sample (`1-9.xls`) is a legacy BIFF/OLE Excel file (not a "fake xls"
HTML export), ~1746 data rows, with this structure:

- **Row 1**: column headers (note: cell A1 contains a stray total-count number,
  not a header — ignore column A entirely).
- **Row 2**: always blank.
- **Row 3 onward**: data.
- Relevant headers (there are ~37 columns total; most are irrelevant to us):

  | Header text (exact)   | Notes |
  |---|---|
  | `Employee ID`         | numeric string, padded with trailing spaces — trim it |
  | `Name`                | employee name, Myanmar script |
  | `Group Code`          | e.g. `"0014          "` — trim it |
  | `Group Name`          | e.g. `IT` |
  | `Attendance Date`     | text, format `YYYYMMDD`, e.g. `20260910` |
  | `Standard Time Card`  | comma-separated 4-digit times, e.g. `0700,1200,1300,1600,0330,0630,1600,1800,1830,1930`. Field count varies by shift type (8 or 10 sub-fields seen). **The first field is always the scheduled/required first check-in time.** |
  | `Actual Time Card`    | comma-separated actual punches, same field count as Standard, e.g. `0722,0722,        ,        , ...`. Empty slots are literal strings of spaces, not truly empty. **The first field is always the actual first check-in time (or spaces if the employee never punched in).** |
  | `Absent`               | a number already computed by the source system (e.g. `8`, `7.42`) — **pass through unchanged, do not recompute** |
  | `Class`                | e.g. `"11 "` — trim it, output as `11` |

  Do **not** hardcode column letters/positions — locate each column by matching
  its header text in row 1, because column order/count can vary between export
  files (the sample has ~37 columns; other exports may have fewer/more).

- **Output columns, in this exact order** (matches the example result screenshot):

  `Employee ID | Name | Group Code | Group Name | Attendance Date | Actual Time Card | Absent | Class | Remarks`

  `Remarks` is the only column we compute ourselves; every other output column is
  a straight copy (after trimming string padding) from the matching input column.

### The "late check-in" rule (this is the core business logic)

Given directly by the user, do not change the numbers:

- Compare the **first check-in time** in `Actual Time Card` against the **first
  scheduled time** in `Standard Time Card` (both are 4-digit `HHmm`, e.g. `0700`
  = 7:00 AM, `0722` = 7:22 AM). Compute the difference in minutes.
- **Grace period: 10 minutes.** Arriving up to and including 10 minutes late is
  completely safe — no remark. (Example: scheduled `0700`, actual `0710` →
  no remark.)
- **From the 11th late minute onward**, the employee needs a leave/permission
  entry, and the remark must show how many *hours* that is, using this exact
  lookup (given by the client — minutes 1–59 truncated to 4 decimals of
  `minutes / 60`, and minute 60 = `1`):

  ```
  1  -> 0.0166   16 -> 0.2666   31 -> 0.5166   46 -> 0.7666
  2  -> 0.0333   17 -> 0.2833   32 -> 0.5333   47 -> 0.7833
  3  -> 0.05     18 -> 0.3      33 -> 0.55     48 -> 0.8
  4  -> 0.0666   19 -> 0.3166   34 -> 0.5666   49 -> 0.8166
  5  -> 0.0833   20 -> 0.3333   35 -> 0.5833   50 -> 0.8333
  6  -> 0.1      21 -> 0.35     36 -> 0.6      51 -> 0.85
  7  -> 0.1166   22 -> 0.3666   37 -> 0.6166   52 -> 0.8666
  8  -> 0.1333   23 -> 0.3833   38 -> 0.6333   53 -> 0.8833
  9  -> 0.15     24 -> 0.4      39 -> 0.65     54 -> 0.9
  10 -> 0.1666   25 -> 0.4166   40 -> 0.6666   55 -> 0.9166
  11 -> 0.1833   26 -> 0.4333   41 -> 0.6833   56 -> 0.9333
  12 -> 0.2      27 -> 0.45     42 -> 0.7      57 -> 0.95
  13 -> 0.2166   28 -> 0.4666   43 -> 0.7166   58 -> 0.9666
  14 -> 0.2333   29 -> 0.4833   44 -> 0.7333   59 -> 0.9833
  15 -> 0.25     30 -> 0.5      45 -> 0.75     60 -> 1
  ```

  This table is exactly `Math.floor((minutes / 60) * 10000) / 10000` — implement
  it as that formula (verified against every row above), not as a hardcoded
  array, but keep the table in a code comment for reference.

- **Display rule, verified against the example screenshot** (scheduled `0700`,
  actual `0722` → 22 minutes late → table value `0.3666` → screenshot shows
  remark `"0.36 ..."`; scheduled `0700`, actual `0712` → 12 minutes late →
  table value `0.2` → screenshot shows `"0.2 ..."`): the hour value shown in the
  remark is **truncated (floored) to 2 decimal places** and trailing zeros are
  dropped naturally (`0.20` → `0.2`). Formula:
  `Math.floor(hourValue * 100) / 100`, then just interpolate the plain number
  into the string (no manual zero-padding).
- If not late (≤10 minutes, or arrived early), `Remarks` is blank for that
  reason (it may still be non-blank for the other reasons below).

### Other remark cases seen in the example screenshot (lower confidence — flag to user)

The example screenshot also shows two other remark texts we could not derive a
precise numeric rule for from a single screenshot, and the source file uses a
**Zawgyi-encoded Myanmar font** (confirmed: the embedded font name inside the
`.xls` binary is literally `Zawgyi-One`), which makes pixel-perfect transcription
of Burmese text from a screenshot unreliable — Zawgyi and Unicode Myanmar text
can look subtly different depending on the viewer's font. Build these as
**configurable rules with editable text templates** (see Prompt 3) rather than
hardcoding guessed strings, and call this out to the user for confirmation
before relying on it in production:

1. **No time card at all**: every field in `Actual Time Card` is blank/spaces →
   remark = a "no attendance record" template (best-guess text seen in the
   screenshot, store as an editable constant `REMARK_NO_RECORD`).
2. **Missing check-out**: the employee has a first check-in punch, but the
   final expected punch (last non-empty field of `Standard Time Card`, i.e. the
   scheduled end-of-day time) has no matching actual value → remark = a
   "no check-out record" template (editable constant `REMARK_NO_CHECKOUT`).
3. Precedence when more than one condition is true, top to bottom:
   `NO_RECORD` → `LATE_CHECK_IN` → `NO_CHECKOUT` → blank.

### Encoding rule — do not violate this

Never re-encode, re-normalize, or otherwise transform string values read from
the source file (`Name`, `Group Name`, existing text). Copy them through
byte-for-byte / value-for-value. Only the `Remarks` text we synthesize is our
own string, and it must be stored as an editable config constant (see Prompt 3)
so the user can paste in the exact Zawgyi or Unicode text their system expects.

---

## PROMPT 1 — Project scaffold

```
Create a new static web app project for a browser-only Excel processing tool,
deployable to GitHub Pages with no backend.

Stack:
- Vite + vanilla TypeScript (no framework needed, keep it simple).
- SheetJS (the `xlsx` npm package) for reading BOTH legacy `.xls` (BIFF/OLE) and
  `.xlsx` files, and for writing the output `.xlsx` files.
- `jszip` for bundling multiple output files into one .zip download when the
  user requests multiple result workbooks in one go.
- Plain CSS, no UI framework. Keep the UI in a single page.

Set up:
1. `npm create vite@latest` scaffold (vanilla-ts template).
2. Install `xlsx` (SheetJS) and `jszip`.
3. Configure `vite.config.ts` with the correct `base` path for GitHub Pages
   (base: '/<REPO_NAME>/' — leave a TODO comment for me to fill in the repo
   name).
4. Add a GitHub Actions workflow at `.github/workflows/deploy.yml` that builds
   with Vite and deploys the `dist` folder to GitHub Pages on push to `main`.
5. Create this folder structure under `src/`:
   - `main.ts` (UI wiring / entry point)
   - `types.ts` (shared TypeScript types)
   - `parse.ts` (reading uploaded workbooks into typed row objects)
   - `rules.ts` (the Remarks business logic)
   - `export.ts` (building and downloading output workbook(s))
   - `ui.ts` (rendering the file list, group-code checkboxes, results table preview)
6. Add a `README.md` explaining what the app does, how to run it locally
   (`npm run dev`), and how it's deployed.

Do not implement any business logic yet — just get a working scaffold that
shows an `<input type="file" multiple accept=".xls,.xlsx">` and logs the raw
SheetJS-parsed workbook of whatever is uploaded to the console, so we can
confirm the reading step works before building on top of it.
```

---

## PROMPT 2 — Robust parsing of the real file format

```
Implement `src/types.ts` and `src/parse.ts` for this app, based on the exact,
verified structure of the real input files:

- Row 1 of the first sheet contains column headers. Ignore column A's value
  entirely (it's a stray count, not a header). Row 2 is always blank. Data
  starts at row 3.
- Locate columns by matching header text (case-sensitive, trimmed) in row 1 —
  never assume fixed column indexes, since different export files may have a
  different total column count. The header names we care about, verbatim:
  "Employee ID", "Name", "Group Code", "Group Name", "Attendance Date",
  "Standard Time Card", "Actual Time Card", "Absent", "Class".
- If any of these required headers is missing from an uploaded file, collect
  a clear error message identifying the file name and the missing header(s),
  and surface it to the user in the UI (don't just throw/crash) — skip that
  file and continue processing the others.
- For each data row (stop at the first fully empty row, or the sheet's used
  range, whichever comes first):
  - Trim trailing/leading whitespace from string fields: Employee ID, Group
    Code, Class.
  - Do NOT alter Name, Group Name, Attendance Date, Standard Time Card,
    Actual Time Card, Absent in any way beyond reading their raw cell value
    (no unicode normalization, no re-encoding, no trimming of Name/Group Name
    — trailing spaces there may be meaningful, leave them exactly as read).
  - Store the row's source filename alongside the parsed fields (needed later
    for "one workbook per uploaded file" export mode).
- Define a TypeScript type `AttendanceRow` with fields:
  `sourceFile, employeeId, name, groupCode, groupName, attendanceDate,
  standardTimeCard, actualTimeCard, absent, klass, remarks` (remarks starts
  undefined/empty — computed in a later step). Use `klass` as the field name
  since `class` is a reserved word.
- Read files using SheetJS `xlsx` in the browser via `FileReader` +
  `XLSX.read(data, { type: 'array' })`, which supports both legacy `.xls` and
  `.xlsx`.
- Export a function `parseWorkbookFile(file: File): Promise<{ rows:
  AttendanceRow[]; errors: string[] }>` and a function that runs this over a
  `FileList` and merges all results, keeping per-file errors.

Wire this into `main.ts` so that uploading the sample file logs the parsed
row count and the first 3 parsed rows to the console, and displays any parse
errors in a visible error box in the UI.
```

---

## PROMPT 3 — Remarks business logic (make it configurable)

```
Implement `src/rules.ts` containing the Remarks computation logic, exactly as
specified below. Keep every threshold and every piece of user-facing text as a
named, exported constant at the top of the file so they're trivial to tweak
later without touching logic code.

Constants to expose:
- `GRACE_MINUTES = 10`
- `REMARK_LATE_SUFFIX` — the text appended after the computed hour number for
  a late check-in, default value `"ခွင့်တိုင်ရန်။"` (Burmese: roughly "must
  file a leave/permission request"). Mark this with a comment: "VERIFY this
  exact string with the client — it was transcribed from a screenshot of a
  Zawgyi-encoded file and may not be byte-exact. Replace with the exact string
  they use in production."
- `REMARK_NO_RECORD` — text used when there is no actual time card data at
  all for the day, default `"တိုင်းကာဒ်မရှိပါ။"`, same verification comment
  as above.
- `REMARK_NO_CHECKOUT` — text used when check-in exists but the final
  scheduled punch has no actual value, default `"အထွက်တိုင်းကာဒ်မရှိပါ။"`,
  same verification comment as above.

Logic, in `computeRemark(row: AttendanceRow): string`:

1. Parse `standardTimeCard` and `actualTimeCard` by splitting on `,`. Trim each
   field. A field counts as "blank" if, after trimming, it's an empty string.
2. If every field of the (trimmed) `actualTimeCard` array is blank → return
   `REMARK_NO_RECORD`.
3. Otherwise, compute lateness:
   - `standardFirst` = first field of `standardTimeCard` (4-digit `HHmm`).
   - `actualFirst` = first field of `actualTimeCard`.
   - If `actualFirst` is blank, skip lateness check (fall through to step 4).
   - Convert each `HHmm` string to minutes-since-midnight (helper function
     `hhmmToMinutes`, handle invalid/malformed values defensively by returning
     `null` and skipping the rule rather than throwing).
   - `lateMinutes = actualMinutes - standardMinutes`.
   - If `lateMinutes > GRACE_MINUTES`:
     - `hourValue = Math.floor((lateMinutes / 60) * 10000) / 10000`
     - `displayValue = Math.floor(hourValue * 100) / 100`
     - return `` `${displayValue} ${REMARK_LATE_SUFFIX}` ``
       (e.g. `lateMinutes = 22` → `displayValue = 0.36` →
       `"0.36 ခွင့်တိုင်ရန်။"`, matching the verified example; `lateMinutes = 12`
       → `"0.2 ခွင့်တိုင်ရန်။"`, also matching the verified example).
4. If not returned yet, check missing checkout: find the last non-blank field
   in the trimmed `standardTimeCard` array — call it `standardLast` — and look
   at the field at the same index in `actualTimeCard`. If that actual field is
   blank while `standardLast` is not, return `REMARK_NO_CHECKOUT`.
5. Otherwise return `""` (no remark).

Add unit tests (use Vitest) covering:
- 22 minutes late → "0.36 ..." (exact match to the constant).
- 12 minutes late → "0.2 ..." (exact match).
- Exactly 10 minutes late → no remark.
- Exactly 11 minutes late → smallest non-zero remark.
- Fully blank actual time card → REMARK_NO_RECORD.
- Check-in present, last scheduled slot blank in actual → REMARK_NO_CHECKOUT.
- A normal on-time, complete day → "".

Then wire `computeRemark` into the row-processing pipeline in `main.ts` so
every parsed `AttendanceRow` gets its `remarks` field filled in right after
parsing.
```

---

## PROMPT 4 — Export UI: group-code filtering & output modes

```
Build the export/selection UI and logic in `src/ui.ts` and `src/export.ts`.

After files are parsed (Prompt 2) and remarks computed (Prompt 3), show:

1. A summary: total rows parsed, per uploaded file name, with error messages
   (if any) from Prompt 2 still visible.
2. A checklist of every distinct `groupCode` found across ALL uploaded files,
   each shown as `"<groupCode> — <groupName> (<row count>)"`. Support:
   - "Select all" / "Clear" buttons.
   - Multi-select via checkboxes.
3. A radio group for export mode:
   - **"One file per selected group code"** — for each checked group code,
     produce a separate output workbook containing only that group's rows
     (across all uploaded source files combined).
   - **"One combined file for all selected group codes"** — produce a single
     output workbook containing the rows of every checked group code together.
   - **"One file per uploaded source file"** — ignore the group-code checkboxes
     for this mode; produce one output workbook per uploaded file, containing
     that file's rows (all group codes included, unfiltered).
4. A live-updating row-count preview reflecting the current selection/mode
   before the user clicks export (e.g. "This will produce 3 files, 214 rows
   total").
5. A "Generate & Download" button that calls into `src/export.ts`.

In `src/export.ts`:

- `buildWorkbook(rows: AttendanceRow[]): XLSX.WorkBook` — builds a single-sheet
  workbook with header row exactly:
  `["Employee ID","Name","Group Code","Group Name","Attendance Date",
  "Actual Time Card","Absent","Class","Remarks"]`
  followed by one row per `AttendanceRow`, in that exact column order, pulling
  `remarks` from the field computed in Prompt 3. Freeze the header row and add
  `!autofilter` over the used range so it behaves like a normal filterable
  Excel table. Set reasonable column widths (`!cols`) so text isn't clipped —
  wider for Name/Remarks, narrower for Group Code/Absent/Class.
- `downloadWorkbook(wb: XLSX.WorkBook, filename: string)` — uses
  `XLSX.writeFile` (or `XLSX.write` + a Blob download) to trigger a browser
  download.
- `exportSelection(...)` — given the parsed rows, the checked group codes, and
  the chosen export mode, builds the right set of workbooks with sensible
  filenames (e.g. `attendance_0014_IT.xlsx`, `attendance_combined.xlsx`,
  `attendance_<original-file-name>.xlsx`). If the result is a single workbook,
  download it directly. If it's more than one, zip them with `jszip` into one
  `attendance_export.zip` and download that instead (avoids multiple browser
  download prompts).

Also render a small live preview table (first ~20 rows of the current
selection, using the 9 output columns) above the export button so the user
can sanity-check the Remarks values before downloading.
```

---

## PROMPT 5 — Polish, validation, and edge cases

```
Do a pass over the whole app for robustness and UX polish:

1. Handle completely empty uploads, files with zero data rows, and files where
   `Attendance Date` is stored as a real Excel date value instead of a
   YYYYMMDD text string (SheetJS may return a JS Date or a serial number in
   that case) — normalize both possibilities to a `YYYYMMDD` string for
   display/output so the output column always looks like the example
   (`20260910`), without altering values that are already correct text.
2. Defensively handle malformed `Standard Time Card` / `Actual Time Card`
   values (wrong field count, non-numeric tokens, totally missing) — never let
   a single bad row crash the whole run; skip remark computation for that row
   (leave Remarks blank) and log a warning visible in the UI's error panel,
   tagged with the row's Employee ID and source file.
3. Add a persistent "Reset / start over" button that clears all uploaded data
   and selections.
4. Make the whole flow keyboard-accessible and add basic responsive styling so
   it's usable on a laptop screen (this is an internal HR tool, no need for
   mobile-first design, just don't let it break at ~1000px width).
5. Add a short in-app help panel (collapsible) that documents, in plain
   English: the 10-minute grace period, how the late-hour number is computed,
   and a note that the "no record" / "no checkout" remark text should be
   double-checked against production data before relying on it (per the
   Zawgyi-encoding caveat noted in the plan).
6. Confirm `npm run build` produces a working `dist/` that runs correctly when
   served from a sub-path (simulate the GitHub Pages base path locally with
   `npm run preview`).

Finally, update `README.md` with: what the tool does, the exact business
rules implemented (grace period + hour table + the three remark cases), how
to run/build/deploy it, and a clearly marked "Known limitations" section
listing the two lower-confidence remark rules (no-record / no-checkout) and
the Zawgyi/Unicode text-verification caveat.
```

---

## After Claude Code finishes: things you should personally verify

- **Confirm the exact Burmese remark text** for the "no record" and "no
  checkout" cases (and, ideally, re-confirm the late-check-in suffix too)
  against your live system — screenshots of Zawgyi-encoded files can render
  ambiguously, so don't ship the guessed defaults without checking.
- **Confirm the "missing checkout" detection rule** (comparing the last
  non-blank Standard slot to the same-index Actual slot) against a broader
  sample of real rows, especially split-shift rows with 8 vs. 10 comma
  fields — one screenshot row isn't enough to be fully sure this generalizes.
- **Decide precedence** if a row is both late *and* missing its checkout —
  the plan currently shows "late" winning; change `rules.ts` if you want the
  opposite.
