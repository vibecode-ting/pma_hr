# Implementation Plan — Theme Toggle, Header Help Modal, Live Preview Filters, Credits & Configurable Resources

Add a Light/Dark theme switcher, move Help & Rules to the header as a `?` modal, upgrade Preview to a full "Live Preview" showing all rows with a 4-field (ID No, Group Code, Date, Remarks) dropdown/type filter panel, style the App Title (Large Bold White in Dark, Blue in Light), add developer credits on the login page, and add configurable resource links from `config.json`.

## User Review Required

> [!NOTE]
> - **Theme Persistence**: The chosen theme (Dark by default or Light) will be stored in `localStorage` under `hr_portal_theme` so it remains active across reloads and sessions.
> - **All Rows in Live Preview**: Rather than capping preview at 20 rows, all parsed/filtered rows will be rendered. To maintain excellent UX and performance with thousands of rows, the table container will feature a smooth scrollable viewport with a sticky table header.
> - **Filter Inputs**: Each filter field (`ID No`, `Group Code`, `Date`, `Remarks`) will feature both direct typing and clickable dropdown choices populated from the active dataset.
> - **Configurable Resources**: Resources in `config.json` will be rendered as clean external link chips on the login page as well as inside the Header Help modal.

---

## Proposed Changes

### Configuration & Typing

#### [MODIFY] [config.json](file:///d:/Users/ting.hah/Downloads/hr-err/config.json)
- Add `resources` array with placeholders:
  ```json
  "resources": [
    { "label": "APP Source Code", "url": "https://examplesourcecode.com" },
    { "label": "Feedback the app", "url": "https://typeform.com" }
  ]
  ```

#### [MODIFY] [config.example.json](file:///d:/Users/ting.hah/Downloads/hr-err/config.example.json)
- Add matching `resources` placeholder array.

#### [MODIFY] [src/types.ts](file:///d:/Users/ting.hah/Downloads/hr-err/src/types.ts)
- Add `ResourceLink` interface: `{ label: string; url: string; }`
- Update `AppConfig` to include optional `resources?: ResourceLink[]`.

---

### Styling & Theme Support

#### [MODIFY] [src/styles/tokens.css](file:///d:/Users/ting.hah/Downloads/hr-err/src/styles/tokens.css)
- Add light theme CSS token definitions under `[data-theme="light"]`:
  - Background layers (`--bg-void: #F4F6F9;`, `--bg-panel: #FFFFFF;`, `--bg-panel-raised: #E9ECEF;`, `--bg-inset: #F8F9FA;`)
  - Border and divider tokens (`--border-hairline: #E2E8F0;`)
  - Text tokens (`--text-primary: #0F172A;`, `--text-secondary: #475569;`, `--text-muted: #94A3B8;`)
  - App title dynamic color token: `--app-title-color: #FFFFFF` in dark theme, `#1D4ED8` (Blue) in light theme.
  - Card shadows tuned for light background.

#### [MODIFY] [src/styles/global.css](file:///d:/Users/ting.hah/Downloads/hr-err/src/styles/global.css)
- Add theme switcher button styling (sun/moon icon button with smooth transition).
- App title styling: Large, bold, responsive font size, with white text in dark theme and vibrant blue text in light theme.
- Style the Help & Rules Modal dialog (backdrop overlay, centered responsive card, close button).
- Style the Live Preview Filter Panel:
  - Filter grid with 4 input/select boxes (ID No, Group Code, Date, Remarks).
  - Search input with datalist / dropdown button for instant selection.
  - Filter summary badge / "Reset Filters" action.
  - Scrollable table container with sticky header for viewing all rows comfortably.
- Style developer credits and resource link chips on the login page.

---

### UI Components & Logic

#### [MODIFY] [src/ui.ts](file:///d:/Users/ting.hah/Downloads/hr-err/src/ui.ts)
- Add `buildThemeSwitcher(getTheme, onToggle)` component.
- Add `buildHelpModal(resources)` component to display Help & Rules and Resource Links in a modal with ESC key and backdrop click handlers.
- Update `buildPreviewTable` to support all rows with sticky header and zero-data state.
- Create `buildLivePreviewSection({ rows, onFilterChange })` containing:
  - Header with title "Live Preview" (localized).
  - 4-filter panel:
    - ID No (search / dropdown of unique IDs)
    - Group Code (dropdown / search)
    - Date (dropdown / search of unique dates)
    - Remarks (dropdown with choices: All, With Remarks Only, No Record, No Checkout, Late, No Remarks)
  - Result row count badge ("Showing X of Y rows").
  - Table rendering all filtered rows.

#### [MODIFY] [src/main.ts](file:///d:/Users/ting.hah/Downloads/hr-err/src/main.ts)
- Initialize theme from `localStorage` ('dark' default), applying `data-theme` to `<html>`.
- Header:
  - Add App Title with large bold styling (White in Dark, Blue in Light).
  - Add `?` Help & Rules icon button opening the modal.
  - Add Theme switcher button.
- Login Page:
  - Add developer credit text: `"Developed by ting | Htet Aung Hlaing @ PMA IT PCB Team"`.
  - Add resource links section rendered from `appConfig.resources`.
- Replace Preview section with Live Preview containing the live multi-field Filter Panel showing all rows.

---

### Internationalization & Fixes

#### [MODIFY] [src/i18n/en.json](file:///d:/Users/ting.hah/Downloads/hr-err/src/i18n/en.json), [my.json](file:///d:/Users/ting.hah/Downloads/hr-err/src/i18n/my.json), [zh-Hant.json](file:///d:/Users/ting.hah/Downloads/hr-err/src/i18n/zh-Hant.json)
- Update "Preview" strings to "Live Preview" / "တိုက်ရိုက် အစမ်းကြည့်ခြင်း (Live Preview)".
- Add keys for filters: `filter.idNo`, `filter.groupCode`, `filter.date`, `filter.remarks`, `filter.all`, `filter.clear`, `filter.showingCount`.
- Add developer team credits and theme switch aria-labels.

#### [MODIFY] [tsconfig.json](file:///d:/Users/ting.hah/Downloads/hr-err/tsconfig.json)
- Set target and lib to `ES2022` to fix `String.prototype.replaceAll` TypeScript compiler error.

#### [MODIFY] [src/rules.test.ts](file:///d:/Users/ting.hah/Downloads/hr-err/src/rules.test.ts)
- Fix line 80 in test: supply complete actual punches to avoid false "No Checkout" trigger when testing the 10-minute grace period.

---

## Verification Plan

### Automated Tests
- Run `npm test` to verify Vitest test suite passes 100%.
- Run `npm run build` (`tsc && vite build`) to confirm clean TypeScript compilation and bundle generation.

### Manual Verification via Browser Subagent
- Launch Vite dev server (`npm run dev`).
- Test Light/Dark theme toggle:
  - Verify dark theme is default with white bold app title.
  - Verify clicking toggle switches to light theme with blue app title and light backgrounds.
  - Verify reloading page preserves theme state.
- Test Header `?` icon:
  - Verify clicking `?` opens Help & Rules modal with business rules and resource links.
  - Verify closing via ✕ or clicking backdrop.
- Test Live Preview:
  - Upload `1-9.xls`.
  - Check Live Preview header shows "Live Preview".
  - Verify all rows are visible with scrollable viewport.
  - Test filtering by ID No, Group Code, Date, Remarks.
  - Test dropdown choices and custom typing.
- Test Login Page:
  - Log out and verify developer credit `"Developed by ting | Htet Aung Hlaing @ PMA IT PCB Team"` and resource links (`APP Source Code`, `Feedback the app`).
