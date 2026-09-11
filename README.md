# Pouchen Myanmar Adidas B150 | HR-Portal
## Employee Attendance Error Automation Tool

A static, client-side-only web app for automatically detecting attendance and time-card errors from raw attendance export files (`.xls` / `.xlsx`). Deployable to GitHub Pages with no backend required.

---

## What this tool does

1. **Uploads** one or more attendance export files (`.xls` BIFF legacy or `.xlsx`).
2. **Parses** them entirely in the browser using SheetJS, locating columns by name (never by position).
3. **Computes** a `Remarks` value per row using the rules below.
4. **Lets you filter** rows by Group Code and choose an export mode.
5. **Generates and downloads** real `.xlsx` file(s) (auto-zipped if more than one) with the 9 required output columns.

---

## Business rules implemented

### Late check-in rule
- Compare the **first** field of `Actual Time Card` against the **first** field of `Standard Time Card` (both `HHmm` 4-digit strings, e.g. `0700` = 7:00 AM).
- **Grace period: 10 minutes.** Up to and including 10 minutes late = no remark.
- **From the 11th minute late:** remark is computed as:
  ```
  hourValue    = Math.floor((lateMinutes / 60) * 10000) / 10000
  displayValue = Math.floor(hourValue * 100) / 100
  remark       = "<displayValue> ခွင့်တိုင်ရန်။"
  ```
  Examples: 22 min late → `"0.36 ..."`, 12 min late → `"0.2 ..."`.

### No attendance record
- If **every** field of `Actual Time Card` is blank/spaces → remark = `REMARK_NO_RECORD`.

### Missing check-out
- If the employee has a check-in punch but the **last non-blank** scheduled slot has no actual value → remark = `REMARK_NO_CHECKOUT`.

### Precedence
`No Record` → `Late Check-in` → `No Checkout` → (blank)

---

## Known limitations

> **⚠ VERIFY BEFORE PRODUCTION USE:**

1. **Burmese remark strings** (`REMARK_LATE_SUFFIX`, `REMARK_NO_RECORD`, `REMARK_NO_CHECKOUT` in `src/rules.ts`) were transcribed from a screenshot of a **Zawgyi-encoded** file. Screenshots of Zawgyi text can be ambiguous — Zawgyi and Unicode Myanmar look similar but are byte-incompatible. Confirm these exact strings against your live production system before relying on them.

2. **Missing check-out detection rule** (comparing the last non-blank `Standard` slot to the same-index `Actual` slot) was derived from one screenshot row. Verify it holds for all your shift types, especially split-shifts with 8 vs. 10 comma-separated fields.

3. **Login is NOT real security.** This is a static site with no server. The login form is a basic access-friction layer. Anyone with browser DevTools can read `config.json` credentials. See the Auth section below.

---

## Auth / credentials

Credentials are stored in `config.json` at the project root (not in `.env`, which gets bundled into the JS):

```json
{
  "appTitle": "Pouchen Myanmar Adidas B150 | HR-Portal",
  "accounts": [
    { "username": "hr.admin", "password": "YOUR_REAL_PASSWORD", "displayName": "HR Admin" }
  ]
}
```

**`config.json` is in `.gitignore` — never commit real credentials to the repo.**

See `config.example.json` for the schema. Copy it:
```bash
cp config.example.json config.json
# then edit config.json with real credentials
```

> **GitHub Pages sites are public by default.** If the exported attendance data is sensitive, either keep the GitHub repo private (requires GitHub Enterprise for private Pages) or host this on an access-controlled server.

---

## Running locally

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev
```

Visit `http://localhost:5173` and log in with the credentials from your local `config.json`.

---

## Building for production

```bash
npm run build
# Output is in dist/

# Preview the production build locally (simulates GitHub Pages sub-path)
npm run preview
```

---

## Running unit tests

```bash
npm run test
```

Tests cover all 7 remark-computation cases from `plan.md` plus defensive edge cases (see `src/rules.test.ts`).

---

## Deployment to GitHub Pages

1. Edit `vite.config.ts` and replace `'/hr-err/'` with `'/<YOUR_REPO_NAME>/'`.
2. Push to the `main` branch.
3. The GitHub Actions workflow at `.github/workflows/deploy.yml` will build and deploy automatically.
4. Enable Pages in your repo's Settings → Pages → Source: GitHub Actions.

---

## Column mapping (input → output)

| Output column | Source column (input file) | Notes |
|---|---|---|
| Employee ID | `Employee ID` | Trimmed |
| Name | `Name` | Raw — Zawgyi-encoded, do not alter |
| Group Code | `Group Code` | Trimmed |
| Group Name | `Group Name` | Raw |
| Attendance Date | `Attendance Date` | Normalized to `YYYYMMDD` |
| Actual Time Card | `Actual Time Card` | Raw |
| Absent | `Absent` | Raw — passed through unchanged |
| Class | `Class` | Trimmed |
| Remarks | *(computed)* | One of: blank, late formula, no-record text, no-checkout text |

---

## Tech stack

- **Vite** + **Vanilla TypeScript** (no framework)
- **SheetJS (`xlsx`)** — reads legacy `.xls` (BIFF/OLE) and modern `.xlsx`; writes output `.xlsx`
- **JSZip** — bundles multiple output files into one `.zip` download
- **Lucide icons** — SVG icons (inlined)
- **@fontsource/*** — self-hosted Inter, Manrope, Noto Sans Myanmar, Noto Sans TC
- **Vitest** — unit tests
- **GitHub Actions** — CI/CD to GitHub Pages

---

*Internal use only. © Pouchen Myanmar Adidas B150*
