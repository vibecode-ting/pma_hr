# Design System & UX Spec — "HR-Portal: Employee Attendance Error Automation Tool"

Companion doc to `plan.md`. Where `plan.md` covers data/logic, this covers
**look, feel, language, and login**. Same usage pattern: paste the "PROMPT"
blocks to Claude Code in order, after `plan.md`'s prompts are done (or
interleave — Prompt A can run right after `plan.md` Prompt 1).

---

## 0. Naming & framework note (read first, don't paste)

**Naming, pulled from your factory's real identity:**

- Company/site title (browser tab, login header): **`Pouchen Myanmar Adidas B150 | HR-Portal`**
- App/product name (shown inside the app, on buttons, emails, etc.): **`Employee Attendance Error Automation Tool`**
- Short name (mobile home-screen / favicon tooltip / compact header): **`B150 HR-Portal`**
- Suggested `<meta>` keywords: `Pouchen, Pouchen Myanmar, Adidas, B150, HR Portal, Attendance, Attendance Error, Automation, Employee Time Card, Payroll Tool`
- Suggested `<meta name="description">`: `Internal HR tool for Pouchen Myanmar Adidas B150 — automatically detects attendance and time-card errors from raw attendance exports.`

**Framework note:** You wrote "astro" — I'm treating that as **two things** and
building both in: (1) a **visual theme** — dark background, gold/brass accent,
a subtle cosmic/starfield motif ("astro" look), and (2) a **suggestion to use
the [Astro](https://astro.build) static-site framework** instead of plain Vite,
since it's purpose-built for exactly this use case (static, content-light,
single-page-feeling site, ships zero JS by default, deploys straight to GitHub
Pages). Prompt A below migrates `plan.md`'s scaffold to Astro. If you'd rather
keep the plain Vite scaffold from `plan.md`, skip Prompt A and tell Claude Code
to apply the rest of this doc to the existing Vite app instead — everything
after Prompt A works the same either way.

---

## 1. Visual identity

**Mood:** premium, quiet, industrial-factory-meets-nightsky. Think a dark
control-room dashboard with warm brass/gold highlights, not a flashy neon
theme. Confident, minimal, a little bit "space observatory" — small dot/star
accents in empty dark space, a soft radial glow behind the login card, thin
gold hairline borders instead of heavy boxes.

### Color tokens

| Token | Hex | Usage |
|---|---|---|
| `--bg-void` | `#0B0E14` | page background (near-black, slight blue undertone) |
| `--bg-panel` | `#12161F` | cards, table backgrounds, the login card |
| `--bg-panel-raised` | `#181D29` | hovered rows, modals, dropdowns |
| `--bg-inset` | `#0E1119` | input fields, code/mono blocks |
| `--border-hairline` | `#2A2F3D` | default borders/dividers |
| `--border-gold` | `#C9A24B` | focused inputs, active tab underline, accent borders |
| `--gold-500` | `#D4AF37` | primary buttons, links, key numbers, active nav |
| `--gold-400` | `#E6C766` | hover state of gold elements |
| `--gold-700` | `#8A6D24` | pressed state, gold text on light backgrounds |
| `--gold-glow` | `rgba(212,175,55,0.18)` | soft glow / box-shadow behind gold elements |
| `--text-primary` | `#F5F1E6` | headings, primary text (warm off-white, not pure white) |
| `--text-secondary` | `#A9AFC0` | secondary text, helper copy, table sub-values |
| `--text-muted` | `#6B7080` | placeholders, disabled text, timestamps |
| `--star-dim` | `rgba(245,241,230,0.35)` | decorative starfield dots |
| `--success` | `#4FBE7E` | success toast, "on time" badge |
| `--warning` | `#E0A93B` | late/remark badge (distinct from gold — slightly more orange) |
| `--danger` | `#E5555F` | errors, "no record" / missing-checkout badge, destructive buttons |
| `--info` | `#5FA8D3` | informational banners |

Contrast check: `--text-primary` on `--bg-void`/`--bg-panel` and `--bg-void` on
`--gold-500` (for button labels, use `--bg-void` as text color on gold
buttons, not white) both clear WCAG AA for normal text — verify in-browser
with the browser's contrast checker once built.

### The "astro" background motif

- Full-page background: `--bg-void`, with a **fixed, very low-opacity
  starfield** — a sparse scattering of 1–2px dots at `--star-dim`, generated
  once as an inline SVG or canvas pattern, `position: fixed`, `z-index: 0`,
  `pointer-events: none`. Keep it subtle — this is an HR tool, not a game;
  density should read as "texture," not "decoration you notice."
- Behind the login card and behind the app's main header: a soft **radial
  gradient glow** in `--gold-glow`, centered above the element, large blur
  radius, fading to transparent — like a distant light source. No animation
  required; a very slow (30–60s), barely-perceptible drift is optional
  polish, not a requirement.
- No particle effects, no parallax, no heavy animation. This is a factory HR
  tool used daily — it must feel calm and fast, not decorative.

### Typography

Load fonts via Google Fonts (self-host the woff2 files at build time for
GitHub Pages reliability — don't depend on the Google Fonts CDN at runtime).

| Role | Font | Notes |
|---|---|---|
| English UI text | **Inter** | weights 400/500/600/700 |
| English display/headings | **Manrope** | weight 700/800, used for the big login title and section headers only |
| Burmese (`my`) | **Noto Sans Myanmar** | weights 400/500/700 — this is a real Unicode Myanmar font; see the encoding note below, this is separate from the Zawgyi issue in the source data |
| Chinese Traditional (`zh-Hant`) | **Noto Sans TC** | weights 400/500/700 |
| Numeric/tabular data (times, hours, IDs) | **Inter**, with `font-variant-numeric: tabular-nums` | keeps columns of numbers aligned in the results table |

Set the `lang` attribute and a per-locale `font-family` stack on `<html>` /
`<body>` whenever the active UI language changes, e.g.:

```css
:lang(en) { font-family: 'Inter', system-ui, sans-serif; }
:lang(my) { font-family: 'Noto Sans Myanmar', 'Inter', system-ui, sans-serif; }
:lang(zh-Hant) { font-family: 'Noto Sans TC', 'Inter', system-ui, sans-serif; }
```

**Important distinction:** the UI chrome (buttons, labels, menus) should use
proper **Unicode** Noto Sans Myanmar for the Burmese locale — this is normal,
correct Myanmar Unicode text that we author ourselves. This is unrelated to
the **Zawgyi-encoded data** coming from the uploaded Excel files (see
`plan.md`) — that raw data is displayed as opaque, unstyled text in the
results table/preview and must NOT be forced into the Noto Sans Myanmar
Unicode-shaping pipeline the same way, or it may render incorrectly. Render
table-cell values from the source file in a plain, generic font stack
(`font-family: sans-serif`) rather than the curated `Noto Sans Myanmar` stack,
so the browser's default Myanmar font substitution (often more Zawgyi-tolerant)
takes over. Add a code comment explaining this exact reasoning where the
results table is styled.

### Iconography

- Use the **lucide** icon set (`lucide` or `lucide-static`), stroke-based,
  1.5–2px stroke width, sized 18–20px inline with text and 24px for standalone
  buttons. Icon color = current text color (inherit), except in gold primary
  buttons where icon color = `--bg-void`.
- Icon usage map:
  - Upload area: `upload-cloud`
  - File chip: `file-spreadsheet`
  - Group code checklist: `layers` (section header), `check-square` (item)
  - Export mode radios: `split` (per group code), `merge` (combined), `folder-output` (per source file)
  - Download button: `download`
  - Reset button: `rotate-ccw`
  - Language switcher: `languages`
  - Login username field: `user`
  - Login password field: `lock`
  - Error banner: `alert-triangle`
  - Success toast: `check-circle-2`
  - Help/info panel: `info` (collapsed), `chevron-down` / `chevron-up` (toggle)
  - Late-remark badge: `clock-alert` (or `alarm-clock` if unavailable in the installed lucide version)
  - No-record badge: `file-x`
  - Logout: `log-out`

### Emoji policy

Use emoji **sparingly and only in two places**, since this is a formal
internal factory HR tool, not a consumer chat app:

1. **Toast/status messages only** — e.g. success toast may end with a single
   ✅, an error toast with a single ⚠️. Never stack multiple emoji.
2. **Empty states** — e.g. "No files uploaded yet 📂" on the initial empty
   upload area, "All clear — no attendance errors found 🎉" on a zero-error
   result. These are the only two allowed empty-state emoji.

Do **not** use emoji in: buttons, table headers, table data, the login page,
nav labels, or any Burmese/Chinese translated string where emoji rendering
conventions may differ — if a translation needs the message reworded to make
sense without the emoji, prefer that.

---

## 2. Layout

### 2.1 Login page (full-viewport, single centered card)

```
┌───────────────────────────────────────────────────────────┐
│  (fixed starfield background, radial gold glow behind card) │
│                                                             │
│                     [factory wordmark / logo]              │
│                Pouchen Myanmar Adidas B150                 │
│                       HR-Portal                             │
│         Employee Attendance Error Automation Tool           │
│                                                             │
│              ┌─────────────────────────────┐               │
│              │   [user icon]  Username      │               │
│              │   ┌─────────────────────┐   │               │
│              │   └─────────────────────┘   │               │
│              │   [lock icon]  Password      │               │
│              │   ┌─────────────────────┐   │               │
│              │   └─────────────────────┘   │               │
│              │                             │               │
│              │   [ error text, if any ]     │               │
│              │                             │               │
│              │   [   Sign In (gold btn)  ]  │               │
│              └─────────────────────────────┘               │
│                                                             │
│                [ EN | မြန်မာ | 繁體中文 ]  ← language switcher │
│                                                             │
│         © Pouchen Myanmar Adidas B150 — Internal Use Only    │
└───────────────────────────────────────────────────────────┘
```

- Card: `--bg-panel`, 1px `--border-hairline`, 12px border-radius, generous
  padding (40–48px), `max-width: 380px`, centered both axes.
- Title stack above the card: small factory name line in `--text-secondary`,
  then "HR-Portal" large in `--gold-500` (Manrope 800), then the tool's full
  name in `--text-secondary` smaller, italic-free, as a subtitle.
- Inputs: `--bg-inset` background, `--border-hairline` border, on focus the
  border becomes `--border-gold` with a soft `--gold-glow` box-shadow — no
  harsh blue browser default focus ring.
- Primary button ("Sign In"): full width of the card, `--gold-500` background,
  `--bg-void` text, 600 weight, 8px radius; hover → `--gold-400`; active/pressed
  → `--gold-700`; disabled (while "checking") → 50% opacity + spinner icon.
- Wrong credentials: red-bordered inline error text under the password field
  using `--danger`, with the `alert-triangle` icon — do not use a browser
  `alert()`.
- Language switcher sits below the card, three plain-text pill buttons,
  active one underlined in `--border-gold`.

### 2.2 Main app page (after login)

```
┌───────────────────────────────────────────────────────────────────┐
│ [logo] B150 HR-Portal          Attendance Error Automation Tool     │
│                                    [EN|MY|ZH]   [user@name] [logout]│
├───────────────────────────────────────────────────────────────────┤
│  ① Upload                                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │   [upload-cloud icon]  Drag files here or click to browse     │  │
│  │        .xls / .xlsx — multiple files supported                │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  [file-spreadsheet 1-9.xls  ✕]  [file-spreadsheet 10-15.xls  ✕]     │
│                                                                     │
│  ② Group Codes                    ③ Export Mode                    │
│  ┌───────────────────────────┐   ○ One file per group code         │
│  │ [x] Select all             │   ● Combined file (selected)       │
│  │ [x] 0014 — IT (42)         │   ○ One file per source file        │
│  │ [ ] 0043 — General Affairs │                                    │
│  │ [ ] 0046 — Clinic          │   [ Generate & Download ⭳ ]         │
│  │ ...                        │                                    │
│  └───────────────────────────┘                                    │
│                                                                     │
│  ④ Preview (first 20 rows of current selection)                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Employee ID | Name | Group Code | ... | Class | Remarks       │  │
│  │ ...table rows, monospace-numeric columns, remark badges...    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ▸ Help & rules (collapsible)                                      │
└───────────────────────────────────────────────────────────────────┘
```

- Top header: sticky, `--bg-panel`, 1px bottom hairline border. Left: small
  factory wordmark + "B150 HR-Portal" in gold. Right: language switcher, the
  logged-in username as plain text, then a `log-out` icon button.
- Section numbering (①②③④ shown above as a layout aid) should render as
  simple styled numeral badges (a small gold circle with the number), not
  literal emoji — keep the visual rhythm of "step 1, step 2..." without
  calling it a "wizard"; all sections are visible at once, no forced
  linear flow.
- Group-code checklist: scrollable panel, max-height ~320px, each row shows
  code, name, and row-count in `--text-secondary`, with a "select all / clear"
  pair of small text-buttons above the list.
- Export mode: radio cards (not plain radio buttons) — each option is a small
  clickable card with the icon, a bold label, and one line of muted helper
  text, the selected one gets a `--border-gold` outline.
- Preview table: `--bg-panel` background, sticky header row in
  `--bg-panel-raised`, zebra striping using `--bg-inset` on alternate rows,
  `--border-hairline` row dividers. The `Remarks` column renders as a small
  pill/badge when non-empty: warning-colored pill (`--warning` text on a
  translucent warning background) for the late-check-in case, danger-colored
  pill for the no-record/no-checkout cases, and simply an em-dash `—` in
  `--text-muted` when there is no remark.
- Help panel: collapsed by default, `chevron-down`/`chevron-up` toggle,
  content in `--text-secondary`, small `info` icon before the heading.

### 2.3 Buttons — full spec

| Variant | Background | Text | Border | Use for |
|---|---|---|---|---|
| Primary | `--gold-500` (hover `--gold-400`, active `--gold-700`) | `--bg-void` | none | Sign In, Generate & Download |
| Secondary | `--bg-panel-raised` | `--text-primary` | 1px `--border-hairline` | Select all / Clear, Reset |
| Ghost/text | transparent | `--gold-500` | none, underline on hover | language pills, links, "show more" |
| Danger | `--bg-panel-raised` | `--danger` | 1px `--danger` at 40% opacity | Remove file (✕), Reset everything |

All buttons: 8px border-radius, 500-weight label, 10–12px vertical padding /
16–20px horizontal, `transition: all 120ms ease`, and a visible focus outline
(`2px solid --border-gold`, offset 2px) for keyboard accessibility — never
`outline: none` without replacing it.

---

## 3. i18n architecture

- Three locales: `en` (default/fallback), `my` (Burmese), `zh-Hant` (Chinese
  Traditional).
- Store translation strings as flat JSON per locale:
  `src/i18n/en.json`, `src/i18n/my.json`, `src/i18n/zh-Hant.json`, each with
  the same key set, e.g.:
  ```json
  {
    "app.title": "Employee Attendance Error Automation Tool",
    "app.shortTitle": "B150 HR-Portal",
    "login.username": "Username",
    "login.password": "Password",
    "login.submit": "Sign In",
    "login.error": "Incorrect username or password.",
    "upload.dropHint": "Drag files here or click to browse",
    "upload.emptyState": "No files uploaded yet 📂",
    "results.emptyState": "All clear — no attendance errors found 🎉",
    "export.perGroupCode": "One file per group code",
    "export.combined": "Combined file (selected groups)",
    "export.perSourceFile": "One file per source file",
    "export.generate": "Generate & Download",
    "nav.logout": "Log Out"
  }
  ```
- Ship a tiny hand-rolled i18n helper (no need for a heavy library given only
  3 static locales and no pluralization complexity): a `t(key: string): string`
  function that reads from the active locale's JSON with fallback to `en` for
  any missing key, plus a `setLocale(locale)` that updates `<html lang>` and
  re-renders text nodes tagged with `data-i18n="key"`.
- Persist the chosen language in `localStorage` (`hr_portal_locale`) so it
  survives reloads; default to the browser's language if it matches one of
  the three, else `en`.
- The language switcher (pill buttons: `EN | မြန်မာ | 繁體中文`) appears on
  both the login page and the main app header, always in sync.
- Do **not** attempt to translate any data pulled from the uploaded Excel
  files (names, group names, remarks) — i18n applies only to the app's own
  UI chrome.

---

## 4. Auth spec (hardcoded, static-site login gate)

**Read this caveat first and keep it in the app's own help panel too:** this
is a static site with no server, so there is no way to make a login
"actually secure" — any values placed in `.env`/`config.json` get bundled or
fetched as plain text and are visible to anyone who opens browser dev tools
or views the deployed `config.json`. This gate is a **basic access-friction
layer for an internal tool on a private/trusted network**, not real
authentication. Say this plainly in the UI's help panel footer and in
`README.md`.

Given that constraint, implement it as follows:

- Store accounts in a single `config.json` at the project root (not
  `.env`, since `.env` values get baked into the JS bundle at build time and
  are harder to update without a rebuild+redeploy; `config.json` can be
  edited and redeployed independently, or even fetched at runtime):
  ```json
  {
    "appTitle": "Pouchen Myanmar Adidas B150 | HR-Portal",
    "accounts": [
      { "username": "hr.admin", "password": "CHANGE_ME", "displayName": "HR Admin" },
      { "username": "it.b150", "password": "CHANGE_ME", "displayName": "IT — B150" }
    ]
  }
  ```
- On app load, `fetch('./config.json')` once, cache it in memory.
- Login form checks the entered username/password against `accounts` (exact
  string match). On success, store a simple session flag + `displayName` in
  `sessionStorage` (not `localStorage`, so closing the tab/browser requires
  logging in again) and route to the main app. On failure, show the inline
  error described in section 2.1 — never reveal whether the username or the
  password was the wrong part.
- Route guard: the main app's script checks `sessionStorage` for the session
  flag on load; if absent, render only the login page (don't even mount the
  upload UI). This is a client-side visibility gate, not a security boundary.
- Logout: clear `sessionStorage` and return to the login page.
- Add a placeholder `config.example.json` committed to the repo (with obvious
  fake credentials like `demo` / `demo123`) and add real `config.json` to
  `.gitignore`, so real passwords are never committed to a public GitHub
  repo — call this out clearly in `README.md` since GitHub Pages sites are
  public by default.

---

## PROMPT A — (optional) migrate the scaffold to Astro

```
Migrate the existing Vite scaffold to the Astro static site framework, keeping
all business logic from plan.md's Prompts 2–4 intact (parse.ts, rules.ts,
export.ts should be usable as-is or with minimal import path changes, since
they're framework-agnostic TypeScript):

1. Re-scaffold with `npm create astro@latest` (choose the minimal/empty
   template, TypeScript strict).
2. Configure `astro.config.mjs` with `site` and `base` set for GitHub Pages
   deployment (leave a TODO for me to fill in the actual GitHub username/repo).
3. Move the existing TS modules (parse.ts, rules.ts, export.ts, types.ts) into
   `src/lib/`.
4. Create the app as a single Astro page (`src/pages/index.astro`) that
   mounts one client-side island (a small vanilla-TS or Preact component —
   pick vanilla TS with `client:load` to keep dependencies minimal) containing
   all the interactive upload/preview/export UI, since none of this can be
   pre-rendered (it depends entirely on user-uploaded files in the browser).
5. Update the GitHub Actions workflow to build with Astro's build command and
   deploy `dist/`.
6. Confirm `npm run dev` and `npm run build && npm run preview` both work
   before moving on.
```

---

## PROMPT B — Global theme & typography

```
Implement the design tokens and global styles from the "Visual identity"
section of design.md:

1. Create `src/styles/tokens.css` defining every color listed in the Color
   tokens table as a CSS custom property on `:root`.
2. Self-host Inter, Manrope, Noto Sans Myanmar, and Noto Sans TC: download the
   required weights as woff2 (or use `@fontsource/*` npm packages, which is
   simpler for a build-time static site) and set up the `:lang()` font-family
   rules exactly as specified in the Typography section, including the
   explicit exception for the raw-data preview table (plain sans-serif stack,
   not the curated Noto Sans Myanmar stack) — add the code comment explaining
   why, verbatim from design.md's encoding note.
3. Build the fixed starfield background layer (inline SVG or canvas, sparse
   dots at `--star-dim`, `position: fixed`, `z-index: 0`, non-interactive) as
   a small reusable component/partial used on both the login and main pages.
4. Build the radial gold-glow effect as a reusable CSS class (`.gold-glow`)
   applied behind the login card and the app header.
5. Install the `lucide` icon package and create a thin wrapper so icons can be
   used consistently by name (matching the icon usage map in design.md)
   across the app.
6. Do not build any page content yet — just confirm, with a temporary test
   page, that: both fonts render correctly per language when you manually set
   `<html lang="my">` / `lang="zh-Hant">` / `lang="en">`, the starfield and
   glow render correctly, and a couple of lucide icons render at the right
   size/color.
```

---

## PROMPT C — i18n setup

```
Implement the i18n system exactly as specified in design.md section 3:

1. Create src/i18n/en.json, src/i18n/my.json, src/i18n/zh-Hant.json with a
   shared key set covering every UI string needed by the login page and main
   app page described in design.md's layout section (login labels/errors,
   upload area text and empty state, group-code panel labels, export mode
   labels and helper text, preview table headers, remark badge labels ["Late",
   "No Record", "No Checkout" and their translations], help panel content,
   nav/logout, and the two allowed empty-state strings with their single
   emoji each). For the my.json and zh-Hant.json files, provide genuinely
   translated strings (not placeholders) — these are real UI labels for a
   Myanmar garment-factory HR tool and a Taiwan/HK-facing Chinese Traditional
   audience, so keep the tone plain, professional, and unambiguous, avoiding
   idioms that don't translate cleanly.
2. Implement the small `t()`/`setLocale()` helper described in design.md
   (no external i18n library), with localStorage persistence under the key
   `hr_portal_locale` and browser-language auto-detection on first visit.
3. Build the language switcher component (`EN | မြန်မာ | 繁體中文` pill
   buttons) and use it on both the login page and the main app header,
   keeping them in sync via the shared `setLocale` call.
4. Update `<html lang>` reactively whenever the locale changes, so the
   `:lang()` font rules from Prompt B apply correctly.
```

---

## PROMPT D — Login page

```
Build the login page exactly as laid out in design.md section 2.1 and wired
to the auth spec in design.md section 4:

1. Create `config.example.json` at the project root matching the schema in
   design.md's auth spec, with obviously-fake demo credentials, and add real
   `config.json` to `.gitignore`. Also create a real `config.json` locally
   (gitignored) so the app is runnable, using the same demo credentials for
   now — I will replace them with real accounts before deploying.
2. On load, fetch `config.json`, and use `accounts` for credential checking as
   described in the auth spec — exact match on username and password, generic
   error message on failure (never reveal which field was wrong), no
   `alert()` popups.
3. Build the login UI to match the ASCII layout in design.md 2.1: factory
   name / "HR-Portal" / tool subtitle stack, the card with username (user
   icon) and password (lock icon) fields, inline error text with the
   alert-triangle icon, the full-width gold primary submit button (with a
   loading/disabled state while checking), the language switcher below the
   card, and a footer copyright line using `appTitle` from config.json.
4. On successful login, store the session flag + displayName in
   sessionStorage and route to the main app (if using Astro with a single
   page + island, this can just be a state toggle inside the island rather
   than a real route change).
5. Add a route guard so refreshing the page while logged out never shows the
   main app UI, and refreshing while logged in skips straight past the login
   form.
6. Use the i18n keys from Prompt C for every piece of text — no hardcoded
   English strings on this page.
```

---

## PROMPT E — Main app shell & styling pass

```
Apply the full main-app layout and component styling from design.md section
2.2–2.3 on top of the working upload/parse/rules/export functionality already
built from plan.md:

1. Build the sticky header exactly as specified: logo + "B150 HR-Portal" in
   gold on the left, language switcher + displayName + logout icon-button on
   the right (logout clears sessionStorage and returns to the login page).
2. Restyle the upload area, file chips, group-code checklist, export-mode
   radio cards, and the "Generate & Download" button to match the color
   tokens, spacing, and icon usage specified in design.md, including the
   numbered section badges (① ② ③ ④ as styled numeral badges, not literal
   emoji characters).
3. Restyle the preview table: sticky header row, zebra striping, tabular-nums
   for numeric columns, and the Remarks column rendered as colored badges per
   design.md's rules (warning-colored for late check-in, danger-colored for
   no-record/no-checkout, muted em-dash for none) — reuse the same
   badge-classification logic that already exists in rules.ts rather than
   re-deriving it in the UI layer.
4. Restyle the collapsible help panel per design.md, including the plain-
   language explanation of the business rules AND the "this login is not
   real security" caveat from the auth spec.
5. Make sure every visible string goes through the i18n `t()` helper from
   Prompt C, and that switching languages mid-session re-renders all of this
   without a page reload.
6. Do a final accessibility pass: visible focus states on every interactive
   element (per the Buttons spec's outline rule), sufficient color contrast,
   and correct `lang` attributes so screen readers pick the right
   pronunciation per section if the UI language differs from the raw data
   language.
```

---

## After Claude Code finishes: things you should personally do

- Replace the demo credentials in your real (gitignored) `config.json` with
  actual accounts before you deploy anything, and double-check `config.json`
  is really excluded from the git repo (`git status` should not show it).
- Remember GitHub Pages sites are public — do not treat this login as
  protecting anything sensitive; if the exported attendance data itself is
  sensitive, keep the repo private and use GitHub Pages' private-repo Pages
  support (requires GitHub Enterprise) or host it somewhere access-controlled
  instead.
- Sanity-check the Noto Sans Myanmar UI text and the raw Zawgyi data side by
  side once real data is loaded, to confirm the font-stack exception in
  Prompt B actually renders both correctly at the same time.
