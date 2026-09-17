/**
 * ui.ts — UI rendering helpers for file list, group-code checklist,
 * export mode radio cards, preview table, error panels, toasts, and help panel.
 *
 * All user-facing strings go through t() from i18n.ts.
 * Lucide icons are inlined as SVG strings for zero-dependency usage.
 */

import { t } from './i18n';
import type { AttendanceRow, ExportMode, LiveFilterState, Theme, RulesConfig, ResourceLink } from './types';
import { exportPreviewSummary } from './export';
import {
  REMARK_NO_RECORD,
  REMARK_NO_CHECKOUT,
  REMARK_LATE_SUFFIX,
  GRACE_MINUTES,
  isRowResolved,
  isRemarkGreen,
  isRemarkRed,
  normalizeDateDigits,
} from './rules';

// ─── Lucide SVG icon strings ──────────────────────────────────────────────────
// Using raw SVG so we have zero extra dependency complexity at runtime.

const icons: Record<string, string> = {
  maximize: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`,
  minimize: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6m0 0v6m0-6L3 21m17-7h-6m0 0v6m0-6l7 7M4 10h6m0 0V4m0 6L3 3m17 7h-6m0 0V4m0 6l7-7"/></svg>`,
  uploadCloud: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`,
  fileSpreadsheet: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  split: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/></svg>`,
  merge: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 6 4-4 4 4"/><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22"/><path d="m20 22-5-5"/></svg>`,
  folderOutput: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><polyline points="15 13 18 16 15 19"/><line x1="10" y1="16" x2="18" y2="16"/></svg>`,
  download: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  rotateCcw: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>`,
  alertTriangle: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  checkCircle2: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  chevronUp: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
  clockAlert: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/></svg>`,
  fileX: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9.5" y1="12.5" x2="14.5" y2="17.5"/><line x1="14.5" y1="12.5" x2="9.5" y2="17.5"/></svg>`,
  logOut: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  user: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  lock: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  moon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  helpCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  filter: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  externalLink: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  messageSquare: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  panelLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
};

// ─── Starfield ─────────────────────────────────────────────────────────────────

/**
 * Generate a fixed SVG starfield background of ~80 random dots.
 */
export function createStarfield(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.id = 'starfield';
  wrapper.setAttribute('aria-hidden', 'true');

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.position = 'absolute';
  svg.style.inset = '0';

  // Seed a deterministic pseudo-random sequence so the starfield is consistent
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const count = 85;
  for (let i = 0; i < count; i++) {
    const circle = document.createElementNS(svgNS, 'circle');
    const cx = rand() * 100;
    const cy = rand() * 100;
    const r = rand() * 0.8 + 0.2; // 0.2 – 1.0 px radius
    const opacity = rand() * 0.5 + 0.15; // 0.15 – 0.65 opacity

    circle.setAttribute('cx', `${cx}%`);
    circle.setAttribute('cy', `${cy}%`);
    circle.setAttribute('r', String(r));
    circle.setAttribute('fill', `rgba(245,241,230,${opacity.toFixed(2)})`);
    svg.appendChild(circle);
  }

  wrapper.appendChild(svg);
  return wrapper;
}

// ─── Language switcher ────────────────────────────────────────────────────────

type LocaleSetter = (locale: 'en' | 'my' | 'zh-Hant') => void;

/**
 * Build a language switcher pill group.
 * @param getLocale  Function returning the current locale
 * @param setLocale  Callback when a locale is chosen
 */
export function buildLangSwitcher(
  getLocale: () => string,
  setLocale: LocaleSetter
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'lang-switcher';
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute('aria-label', 'Language / ဘာသာ / 語言');

  const locales: Array<{ id: 'en' | 'my' | 'zh-Hant'; label: string; title: string }> = [
    { id: 'en', label: 'EN', title: 'English' },
    { id: 'my', label: 'MY', title: 'မြန်မာစာ' },
    { id: 'zh-Hant', label: 'ZH', title: '繁體中文' },
  ];

  const buttons: HTMLButtonElement[] = [];

  locales.forEach(({ id, label, title }, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'lang-divider';
      sep.textContent = '|';
      sep.setAttribute('aria-hidden', 'true');
      wrapper.appendChild(sep);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `lang-pill${getLocale() === id ? ' active' : ''}`;
    btn.textContent = label;
    btn.title = title;
    btn.dataset.locale = id;
    btn.addEventListener('click', () => {
      setLocale(id);
      buttons.forEach((b) => b.classList.toggle('active', b.dataset.locale === id));
    });
    buttons.push(btn);
    wrapper.appendChild(btn);
  });

  // Keep in sync when locale changes externally
  document.addEventListener('localechange', (e) => {
    const locale = (e as CustomEvent).detail?.locale;
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.locale === locale));
  });

  return wrapper;
}

/**
 * Build the sidebar language switcher:
 * - When expanded: shows a dropdown select box (<select class="sidebar-lang-select">)
 * - When folded/collapsed: shows a compact button (<button class="sidebar-lang-folded-btn">)
 *   Clicking the folded button rotates through languages: EN >> MY >> ZH >> EN
 *
 * @param getLocale  Function returning the current locale
 * @param setLocale  Callback when a locale is chosen
 */
export function buildSidebarLangSwitcher(
  getLocale: () => string,
  setLocale: LocaleSetter
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'sidebar-lang-switcher-wrap';

  const locales: Array<{ id: 'en' | 'my' | 'zh-Hant'; label: string; full: string }> = [
    { id: 'en', label: 'EN', full: 'English (EN)' },
    { id: 'my', label: 'MY', full: 'မြန်မာစာ (MY)' },
    { id: 'zh-Hant', label: 'ZH', full: '繁體中文 (ZH)' },
  ];

  // 1. Dropdown select box (for expanded sidebar)
  const select = document.createElement('select');
  select.className = 'sidebar-lang-select';
  select.id = 'sidebar-lang-select';
  select.setAttribute('aria-label', 'Language selection / ဘာသာစကား / 語言');

  locales.forEach(({ id, full }) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = full;
    if (getLocale() === id) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    const nextLocale = select.value as 'en' | 'my' | 'zh-Hant';
    setLocale(nextLocale);
    updateFoldedBtn();
  });

  // 2. Folded cycle button (for collapsed sidebar)
  const foldedBtn = document.createElement('button');
  foldedBtn.type = 'button';
  foldedBtn.className = 'sidebar-lang-folded-btn';
  foldedBtn.id = 'sidebar-lang-folded-btn';

  const updateFoldedBtn = () => {
    const cur = (getLocale() as 'en' | 'my' | 'zh-Hant') || 'en';
    const found = locales.find((l) => l.id === cur) || locales[0];
    const curIndex = locales.findIndex((l) => l.id === cur);
    const nextIndex = (curIndex + 1) % locales.length;
    const next = locales[nextIndex];

    foldedBtn.innerHTML = `
      <span class="sidebar-lang-folded-icon">${icons.globe}</span>
      <span class="sidebar-lang-folded-badge">${found.label}</span>
    `;
    foldedBtn.title = `${found.full} — Click to switch to ${next.label} (${next.full})`;
    foldedBtn.setAttribute('aria-label', foldedBtn.title);

    select.value = cur;
  };

  foldedBtn.addEventListener('click', () => {
    const cur = (getLocale() as 'en' | 'my' | 'zh-Hant') || 'en';
    // Cycle sequence: EN >> MY >> ZH >> EN
    let next: 'en' | 'my' | 'zh-Hant' = 'en';
    if (cur === 'en') next = 'my';
    else if (cur === 'my') next = 'zh-Hant';
    else next = 'en';

    setLocale(next);
    updateFoldedBtn();
  });

  updateFoldedBtn();

  // Keep in sync with external locale changes (e.g. from login page or other triggers)
  document.addEventListener('localechange', (e) => {
    const loc = (e as CustomEvent).detail?.locale;
    if (loc) {
      select.value = loc;
      updateFoldedBtn();
    }
  });

  wrapper.appendChild(select);
  wrapper.appendChild(foldedBtn);
  return wrapper;
}

// ─── File chips ───────────────────────────────────────────────────────────────

/**
 * Build the file chip list from the current set of uploaded files.
 * @param files     Current file list
 * @param onRemove  Callback when a file's ✕ button is clicked
 */
export function buildFileChips(files: File[], onRemove: (file: File) => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'upload-file-list';

  for (const file of files) {
    const chip = document.createElement('div');
    chip.className = 'file-chip';

    const icon = document.createElement('span');
    icon.innerHTML = icons.fileSpreadsheet;
    chip.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'file-chip-name';
    name.textContent = file.name;
    name.title = file.name;
    chip.appendChild(name);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-chip-remove';
    removeBtn.innerHTML = icons.x;
    removeBtn.setAttribute('aria-label', `${t('upload.removeFile')}: ${file.name}`);
    removeBtn.addEventListener('click', () => onRemove(file));
    chip.appendChild(removeBtn);

    wrapper.appendChild(chip);
  }

  return wrapper;
}

// ─── Group code checklist ─────────────────────────────────────────────────────

export interface GroupInfo {
  code: string;
  name: string;
  count: number;
}

/**
 * Build the group-code checklist.
 * @param groups        All distinct groups found in parsed data
 * @param selected      Currently selected group codes
 * @param onChange      Callback with updated set of selected codes
 */
export function buildGroupChecklist(
  groups: GroupInfo[],
  selected: Set<string>,
  onChange: (selected: Set<string>) => void
): HTMLElement {
  const wrapper = document.createElement('div');

  // Controls row
  const controls = document.createElement('div');
  controls.className = 'group-list-controls';

  const selectAllBtn = document.createElement('button');
  selectAllBtn.className = 'btn btn-secondary btn-sm';
  selectAllBtn.setAttribute('data-i18n', 'groups.selectAll');
  selectAllBtn.textContent = t('groups.selectAll');
  selectAllBtn.addEventListener('click', () => {
    const newSet = new Set(groups.map((g) => g.code));
    updateCheckboxes(newSet);
    onChange(newSet);
  });
  controls.appendChild(selectAllBtn);

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn btn-secondary btn-sm';
  clearBtn.setAttribute('data-i18n', 'groups.clearAll');
  clearBtn.textContent = t('groups.clearAll');
  clearBtn.addEventListener('click', () => {
    updateCheckboxes(new Set());
    onChange(new Set());
  });
  controls.appendChild(clearBtn);
  wrapper.appendChild(controls);

  // Scrollable list
  const list = document.createElement('div');
  list.className = 'group-checklist';
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', t('groups.heading'));

  const checkboxMap = new Map<string, HTMLInputElement>();

  for (const group of groups) {
    const item = document.createElement('label');
    item.className = 'group-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = group.code;
    cb.checked = selected.has(group.code);
    cb.id = `group-${group.code}`;
    checkboxMap.set(group.code, cb);

    cb.addEventListener('change', () => {
      const newSet = new Set(
        [...checkboxMap.entries()]
          .filter(([, el]) => el.checked)
          .map(([code]) => code)
      );
      onChange(newSet);
    });

    const labelText = document.createElement('span');
    labelText.className = 'group-item-label';
    labelText.textContent = `${group.code} — ${group.name}`;
    labelText.setAttribute('for', cb.id);

    const count = document.createElement('span');
    count.className = 'group-item-count';
    count.textContent = `${group.count} ${t('groups.rows')}`;

    item.appendChild(cb);
    item.appendChild(labelText);
    item.appendChild(count);
    list.appendChild(item);
  }

  wrapper.appendChild(list);

  function updateCheckboxes(newSet: Set<string>) {
    checkboxMap.forEach((cb, code) => {
      cb.checked = newSet.has(code);
    });
  }

  return wrapper;
}

// ─── Export mode radio cards ──────────────────────────────────────────────────

/**
 * Build the three export-mode radio cards.
 * @param current   Currently selected mode
 * @param onChange  Callback with newly selected mode
 */
export function buildExportModeCards(
  current: ExportMode,
  onChange: (mode: ExportMode) => void
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'export-modes';
  wrapper.setAttribute('role', 'radiogroup');
  wrapper.setAttribute('aria-label', t('export.heading'));

  const modes: Array<{ id: ExportMode; iconKey: string; labelKey: string; hintKey: string }> = [
    { id: 'per-group', iconKey: 'split', labelKey: 'export.perGroupCode', hintKey: 'export.perGroupCodeHint' },
    { id: 'combined', iconKey: 'merge', labelKey: 'export.combined', hintKey: 'export.combinedHint' },
    { id: 'per-source-file', iconKey: 'folderOutput', labelKey: 'export.perSourceFile', hintKey: 'export.perSourceFileHint' },
  ];

  const cards: HTMLLabelElement[] = [];

  for (const mode of modes) {
    const card = document.createElement('label');
    card.className = `export-mode-card${current === mode.id ? ' selected' : ''}`;
    card.setAttribute('for', `export-mode-${mode.id}`);

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'export-mode';
    radio.id = `export-mode-${mode.id}`;
    radio.value = mode.id;
    radio.checked = current === mode.id;

    radio.addEventListener('change', () => {
      cards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      onChange(mode.id as ExportMode);
    });

    const iconEl = document.createElement('span');
    iconEl.innerHTML = icons[mode.iconKey] ?? '';

    const textEl = document.createElement('div');
    textEl.className = 'export-mode-text';

    const labelEl = document.createElement('span');
    labelEl.className = 'export-mode-label';
    labelEl.setAttribute('data-i18n', mode.labelKey);
    labelEl.textContent = t(mode.labelKey);

    const hintEl = document.createElement('span');
    hintEl.className = 'export-mode-hint';
    hintEl.setAttribute('data-i18n', mode.hintKey);
    hintEl.textContent = t(mode.hintKey);

    textEl.appendChild(labelEl);
    textEl.appendChild(hintEl);

    card.appendChild(radio);
    card.appendChild(iconEl);
    card.appendChild(textEl);
    cards.push(card);
    wrapper.appendChild(card);
  }

  return wrapper;
}

// ─── Preview table ────────────────────────────────────────────────────────────

const PREVIEW_LIMIT = 20;

const COLUMN_DEFS: Array<{ key: keyof AttendanceRow; i18nKey: string; numeric?: boolean; raw?: boolean }> = [
  { key: 'employeeId',     i18nKey: 'preview.colEmployeeId', numeric: true },
  { key: 'name',           i18nKey: 'preview.colName',       raw: true },
  { key: 'groupCode',      i18nKey: 'preview.colGroupCode',  numeric: true },
  { key: 'groupName',      i18nKey: 'preview.colGroupName',  raw: true },
  { key: 'attendanceDate', i18nKey: 'preview.colDate',       numeric: true },
  { key: 'actualTimeCard', i18nKey: 'preview.colActualTimeCard', raw: true },
  { key: 'absent',         i18nKey: 'preview.colAbsent',     numeric: true },
  { key: 'overtimeHours',  i18nKey: 'preview.colOvertimeHours', numeric: true },
  { key: 'klass',          i18nKey: 'preview.colClass',      numeric: true },
  { key: 'remarks',        i18nKey: 'preview.colRemarks' },
];

/**
 * Classify a remark string for badge rendering.
 * Returns: 'late' | 'no-record' | 'no-checkout' | 'none'
 */
function classifyRemark(remark: string): 'late' | 'no-record' | 'no-checkout' | 'none' {
  if (!remark) return 'none';
  if (remark === REMARK_NO_RECORD) return 'no-record';
  if (remark === REMARK_NO_CHECKOUT) return 'no-checkout';
  if (remark.includes(REMARK_LATE_SUFFIX)) return 'late';
  return 'none'; // Fallback for any other remark text
}

/**
 * Render the Remarks cell as a colored badge (or em-dash if empty).
 * Applied (ခြင့္တိုင္ၿပီး / အိုတီတင္ပီး) -> Green badge.
 * Required actions (ခြင့္တိုင္ရန္ / အိုတီတင္ရန္ / မရွိပါ) -> Red badge.
 */
function renderRemarkCell(remark: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = 'col-remark-cell';

  if (!remark || !remark.trim()) {
    td.className = 'col-remark-cell badge-muted';
    td.textContent = '—';
    td.style.color = 'var(--text-muted)';
    return td;
  }

  const badge = document.createElement('span');

  if (remark.includes('ညဆိုင္း')) {
    badge.className = 'badge badge-night';
    badge.innerHTML = `🌙 <span class="remark-text zawgyi-font">${remark}</span>`;
  } else if (isRemarkGreen(remark)) {
    badge.className = 'badge badge-green';
    badge.innerHTML = `<span class="remark-icon">✓</span> <span class="remark-text zawgyi-font">${remark}</span>`;
  } else if (isRemarkRed(remark)) {
    badge.className = 'badge badge-danger badge-red';
    badge.innerHTML = `${icons.alertTriangle || '⚠'} <span class="remark-text zawgyi-font">${remark}</span>`;
  } else {
    badge.className = 'badge badge-warning';
    badge.innerHTML = `${icons.clockAlert || '⏰'} <span class="remark-text zawgyi-font">${remark}</span>`;
  }

  badge.title = remark;
  td.appendChild(badge);
  return td;
}

/**
 * Build the preview table for all provided rows.
 * Includes sticky header, Excel-like vertical grid borders, and scrollable container.
 */
export function buildPreviewTable(rows: AttendanceRow[]): HTMLElement {
  let sortKey: string | null = null;
  let sortAsc = true;
  
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-table-wrapper';

  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'padding: 28px; text-align: center; color: var(--text-muted); font-size: 0.88rem;';
    empty.setAttribute('data-i18n', 'preview.noData');
    empty.textContent = t('preview.noData');
    wrapper.appendChild(empty);
    return wrapper;
  }

  const isGridEnabled = localStorage.getItem('hr_portal_table_grid') !== 'false';
  const table = document.createElement('table');
  table.className = `preview-table live-preview-table${isGridEnabled ? ' grid-enabled' : ''}`;
  table.setAttribute('aria-label', t('preview.heading'));

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const tbody = document.createElement('tbody');

  const addResizeHandle = (th: HTMLTableCellElement) => {
    const resizer = document.createElement('div');
    resizer.className = 'th-resize-handle';
    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.pageX;
        const startWidth = th.offsetWidth;
        const onMove = (me: MouseEvent) => {
            th.style.width = Math.max(40, startWidth + me.pageX - startX) + 'px';
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
    th.style.position = 'relative';
    th.appendChild(resizer);
  };
  
  const handleSort = (key: string) => {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }
    
    headerRow.querySelectorAll('.sort-indicator').forEach(span => span.textContent = '');
    const th = headerRow.querySelector(`th[data-sort-key="${key}"]`);
    if (th) {
      const indicator = th.querySelector('.sort-indicator');
      if (indicator) indicator.textContent = sortAsc ? ' ▲' : ' ▼';
    }
    
    renderTbody();
  };

  // Serial No column header "No"
  const thNo = document.createElement('th');
  thNo.setAttribute('data-sort-key', 'no');
  thNo.className = 'col-header-centered col-numeric col-serial-header';
  thNo.style.cssText = 'width: 50px; min-width: 50px; text-align: center; cursor: pointer;';
  
  const noText = document.createElement('span');
  noText.setAttribute('data-i18n', 'preview.colNo');
  noText.textContent = t('preview.colNo') || 'No';
  thNo.appendChild(noText);
  
  const noIndicator = document.createElement('span');
  noIndicator.className = 'sort-indicator';
  thNo.appendChild(noIndicator);
  
  thNo.addEventListener('click', () => handleSort('no'));
  addResizeHandle(thNo);
  headerRow.appendChild(thNo);

  for (const col of COLUMN_DEFS) {
    const th = document.createElement('th');
    th.setAttribute('data-sort-key', col.key);
    th.className = 'col-header-centered';
    if (col.numeric) th.classList.add('col-numeric');
    th.style.cursor = 'pointer';
    
    const textSpan = document.createElement('span');
    textSpan.setAttribute('data-i18n', col.i18nKey);
    textSpan.textContent = t(col.i18nKey);
    th.appendChild(textSpan);
    
    const indicator = document.createElement('span');
    indicator.className = 'sort-indicator';
    th.appendChild(indicator);
    
    th.addEventListener('click', () => handleSort(col.key));
    addResizeHandle(th);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const renderTbody = () => {
    tbody.innerHTML = '';
    
    let displayRows = [...rows].map((row, idx) => ({ row, idx }));
    
    if (sortKey) {
      displayRows.sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';
        if (sortKey === 'no') {
          valA = a.idx;
          valB = b.idx;
        } else {
          valA = a.row[sortKey as keyof AttendanceRow] || '';
          valB = b.row[sortKey as keyof AttendanceRow] || '';
        }
        
        if (sortKey === 'absent' || sortKey === 'overtimeHours' || sortKey === 'no') {
          valA = parseFloat(valA as string) || 0;
          valB = parseFloat(valB as string) || 0;
          return sortAsc ? valA - valB : valB - valA;
        } else {
          return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        }
      });
    }

    displayRows.forEach(({ row, idx }) => {
      const tr = document.createElement('tr');

      // Serial No cell: 1 to XX based on current view/filter
      const tdNo = document.createElement('td');
      tdNo.className = 'col-numeric col-serial-no zawgyi-font';
      tdNo.style.cssText = 'text-align: center; font-weight: 600; color: var(--text-muted);';
      tdNo.textContent = String(idx + 1);
      tr.appendChild(tdNo);

      for (const col of COLUMN_DEFS) {
        if (col.key === 'remarks') {
          tr.appendChild(renderRemarkCell(row.remarks));
        } else if (col.key === 'overtimeHours') {
          const td = document.createElement('td');
          td.className = 'col-numeric zawgyi-font';
          const otVal = parseFloat(row.overtimeHours || '0');
          if (!isNaN(otVal) && otVal > 0) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-ot';
            badge.textContent = `${row.overtimeHours} hrs`;
            td.appendChild(badge);
          } else {
            td.textContent = row.overtimeHours || '0';
            td.style.color = 'var(--text-muted)';
          }
          tr.appendChild(td);
        } else if (col.key === 'absent') {
          const td = document.createElement('td');
          td.className = 'col-numeric zawgyi-font';
          const abVal = parseFloat(row.absent || '0');
          if (!isNaN(abVal) && abVal > 0) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-absent';
            badge.textContent = `${row.absent} hrs`;
            td.appendChild(badge);
          } else {
            td.textContent = row.absent || '0';
          }
          tr.appendChild(td);
        } else {
          const td = document.createElement('td');
          const value = String(row[col.key] ?? '');
          td.textContent = value;
          td.className = 'zawgyi-font';
          if (col.raw) td.classList.add('col-raw-data');
          if (col.numeric) td.classList.add('col-numeric');
          tr.appendChild(td);
        }
      }
      tbody.appendChild(tr);
    });
  };

  renderTbody();
  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

/**
 * Build the Live Preview Section containing the Filter Panel and table showing all rows.
 * Supports filtering by ID No, Group Code, Date, Remarks (by typing or dropdown choices).
 */
export function buildLivePreviewSection(
  rows: AttendanceRow[],
  activeFilter: LiveFilterState,
  onFilterChange: (filter: LiveFilterState) => void,
  rulesConfig: RulesConfig,
  callbacks?: {
    onResetAll?: () => void;
    onDownload?: (btn: HTMLButtonElement) => void;
    onExportVisible?: (rows: AttendanceRow[]) => void;
  }
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'live-preview-container';

  if (rows.length === 0) {
    const emptyText = document.createElement('p');
    emptyText.style.cssText = 'color: var(--text-muted); font-size: 0.88rem; padding: 16px 0;';
    emptyText.setAttribute('data-i18n', 'upload.emptyState');
    emptyText.textContent = t('upload.emptyState');
    container.appendChild(emptyText);
    return container;
  }

  // ── Extract unique options for filter choices ──
  const uniqueIds = Array.from(new Set(rows.map((r) => r.employeeId.trim()))).filter(Boolean).sort();
  const uniqueNames = Array.from(new Set(rows.map((r) => r.name.trim()))).filter(Boolean).sort();
  const uniqueGroups = Array.from(new Set(rows.map((r) => r.groupCode.trim()))).filter(Boolean).sort();
  const uniqueDates = Array.from(new Set(rows.map((r) => r.attendanceDate.trim()))).filter(Boolean).sort();
  const uniqueClasses = Array.from(new Set(rows.map((r) => r.klass.trim()))).filter(Boolean).sort();

  // ── Filter Panel ──
  const panel = document.createElement('div');
  panel.className = 'filter-panel';

  const panelHeader = document.createElement('div');
  panelHeader.className = 'filter-panel-header';

  const panelTitle = document.createElement('div');
  panelTitle.className = 'filter-panel-title';
  panelTitle.innerHTML = `${icons.filter} <span data-i18n="filter.title">${t('filter.title')}</span>`;
  panelHeader.appendChild(panelTitle);

  const filterControlsWrap = document.createElement('div');
  filterControlsWrap.className = 'filter-check-group';

  // Optimized Checkmark Items with 3-language translation
  const createCheckItem = (id: string, i18nKey: string, checked: boolean) => {
    const label = document.createElement('label');
    label.className = 'filter-check-item';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = checked;
    const text = document.createElement('span');
    text.setAttribute('data-i18n', i18nKey);
    text.textContent = t(i18nKey);
    const badge = document.createElement('span');
    badge.className = 'filter-count-badge';
    badge.style.color = 'var(--text-muted)';
    label.appendChild(input);
    label.appendChild(text);
    label.appendChild(badge);
    return { label, input, text, badge, i18nKey };
  };

  const { label: hideResolvedLabel, input: hideResolvedCheckbox, badge: hideResolvedBadge } = createCheckItem(
    'filter-hide-resolved',
    'filter.hideResolved',
    activeFilter.hideResolved !== false
  );
  filterControlsWrap.appendChild(hideResolvedLabel);

  const { label: hideFutureShiftsLabel, input: hideFutureShiftsCheckbox, badge: hideFutureShiftsBadge } = createCheckItem(
    'filter-hide-future',
    'filter.hideFuture',
    activeFilter.hideFutureShifts !== false
  );
  filterControlsWrap.appendChild(hideFutureShiftsLabel);

  const { label: hideAppliedLabel, input: hideAppliedCheckbox, badge: hideAppliedBadge } = createCheckItem(
    'filter-hide-applied',
    'filter.hideApplied',
    activeFilter.hideApplied !== false
  );
  filterControlsWrap.appendChild(hideAppliedLabel);

  const { label: hideNoCheckoutLabel, input: hideNoCheckoutCheckbox, badge: hideNoCheckoutBadge } = createCheckItem(
    'filter-hide-no-checkout',
    'filter.hideNoCheckout',
    activeFilter.hideNoCheckout === true
  );
  filterControlsWrap.appendChild(hideNoCheckoutLabel);

  const filterBadge = document.createElement('div');
  filterBadge.className = 'filter-panel-badge';
  filterControlsWrap.appendChild(filterBadge);

  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.type = 'button';
  fullscreenBtn.className = 'btn btn-secondary btn-sm filter-fullscreen-btn';
  fullscreenBtn.title = 'Full Screen (F11 / ESC to exit)';
  fullscreenBtn.innerHTML = `${icons.maximize} <span class="fullscreen-btn-text" data-i18n="preview.fullscreen">${t('preview.fullscreen') || 'Full Screen'}</span>`;
  fullscreenBtn.addEventListener('click', () => {
    const isFull = document.body.classList.toggle('portal-fullscreen-mode');
    if (isFull) {
      fullscreenBtn.innerHTML = `${icons.minimize} <span class="fullscreen-btn-text" data-i18n="preview.exitFullscreen">${t('preview.exitFullscreen') || 'Exit Full Screen'}</span>`;
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      fullscreenBtn.innerHTML = `${icons.maximize} <span class="fullscreen-btn-text" data-i18n="preview.fullscreen">${t('preview.fullscreen') || 'Full Screen'}</span>`;
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      document.body.classList.remove('portal-fullscreen-mode');
      fullscreenBtn.innerHTML = `${icons.maximize} <span class="fullscreen-btn-text" data-i18n="preview.fullscreen">${t('preview.fullscreen') || 'Full Screen'}</span>`;
    }
  });
  filterControlsWrap.appendChild(fullscreenBtn);

  panelHeader.appendChild(filterControlsWrap);
  panel.appendChild(panelHeader);

  // 5-column clean filter grid (Name, Absent, Overtime removed per user request)
  const grid = document.createElement('div');
  grid.className = 'filter-grid';

  // 1. ID No Filter
  const idGroup = document.createElement('div');
  idGroup.className = 'filter-field';
  const idLabel = document.createElement('label');
  idLabel.className = 'filter-label';
  idLabel.setAttribute('for', 'filter-id-input');
  idLabel.textContent = t('filter.idNo') || 'ID No';
  idGroup.appendChild(idLabel);

  const idInput = document.createElement('input');
  idInput.type = 'text';
  idInput.id = 'filter-id-input';
  idInput.className = 'filter-input';
  idInput.placeholder = 'ID...';
  idInput.setAttribute('list', 'filter-id-datalist');
  idInput.value = activeFilter.idNo;
  idGroup.appendChild(idInput);

  const idDatalist = document.createElement('datalist');
  idDatalist.id = 'filter-id-datalist';
  for (const id of uniqueIds) {
    const opt = document.createElement('option');
    opt.value = id;
    idDatalist.appendChild(opt);
  }
  idGroup.appendChild(idDatalist);
  grid.appendChild(idGroup);

  // 2. Group Code Filter
  const groupField = document.createElement('div');
  groupField.className = 'filter-field';
  const groupLabel = document.createElement('label');
  groupLabel.className = 'filter-label';
  groupLabel.setAttribute('for', 'filter-group-input');
  groupLabel.textContent = t('filter.groupCode') || 'Group';
  groupField.appendChild(groupLabel);

  const groupInput = document.createElement('input');
  groupInput.type = 'text';
  groupInput.id = 'filter-group-input';
  groupInput.className = 'filter-input';
  groupInput.placeholder = 'Group...';
  groupInput.setAttribute('list', 'filter-group-datalist');
  groupInput.value = activeFilter.groupCode;
  groupField.appendChild(groupInput);

  const groupDatalist = document.createElement('datalist');
  groupDatalist.id = 'filter-group-datalist';
  for (const g of uniqueGroups) {
    const opt = document.createElement('option');
    opt.value = g;
    groupDatalist.appendChild(opt);
  }
  groupField.appendChild(groupDatalist);
  grid.appendChild(groupField);

  // 3. Date Filter
  const dateField = document.createElement('div');
  dateField.className = 'filter-field';
  const dateLabel = document.createElement('label');
  dateLabel.className = 'filter-label';
  dateLabel.setAttribute('for', 'filter-date-input');
  dateLabel.textContent = t('filter.date') || 'Date';
  dateField.appendChild(dateLabel);

  const dateInput = document.createElement('input');
  dateInput.type = 'text';
  dateInput.id = 'filter-date-input';
  dateInput.className = 'filter-input';
  dateInput.placeholder = 'Date...';
  dateInput.setAttribute('list', 'filter-date-datalist');
  dateInput.value = activeFilter.date;
  dateField.appendChild(dateInput);

  const dateDatalist = document.createElement('datalist');
  dateDatalist.id = 'filter-date-datalist';
  for (const d of uniqueDates) {
    const opt = document.createElement('option');
    opt.value = d;
    dateDatalist.appendChild(opt);
  }
  dateField.appendChild(dateDatalist);
  grid.appendChild(dateField);

  // 4. Class / Shift Filter
  const classField = document.createElement('div');
  classField.className = 'filter-field';
  const classLabel = document.createElement('label');
  classLabel.className = 'filter-label';
  classLabel.setAttribute('for', 'filter-class-input');
  classLabel.textContent = 'Class';
  classField.appendChild(classLabel);

  const classInput = document.createElement('input');
  classInput.type = 'text';
  classInput.id = 'filter-class-input';
  classInput.className = 'filter-input';
  classInput.placeholder = 'Class...';
  classInput.setAttribute('list', 'filter-class-datalist');
  classInput.value = activeFilter.klass || '';
  classField.appendChild(classInput);

  const classDatalist = document.createElement('datalist');
  classDatalist.id = 'filter-class-datalist';
  for (const k of uniqueClasses) {
    const opt = document.createElement('option');
    opt.value = k;
    classDatalist.appendChild(opt);
  }
  classField.appendChild(classDatalist);
  grid.appendChild(classField);

  // 5. Remarks Filter (Includes ညဆိုင္း)
  const remField = document.createElement('div');
  remField.className = 'filter-field';
  const remLabel = document.createElement('label');
  remLabel.className = 'filter-label';
  remLabel.setAttribute('for', 'filter-remarks-select');
  remLabel.textContent = t('filter.remarks') || 'Remarks';
  remField.appendChild(remLabel);

  const remSelect = document.createElement('select');
  remSelect.id = 'filter-remarks-select';
  remSelect.className = 'filter-select';

  const remChoices: Array<{ value: string; label: string }> = [
    { value: '', label: t('settings.filterAllRemarks') || '— All Remarks —' },
    { value: '__HAS_REMARK__', label: t('filter.withRemarks') || 'With Remarks' },
    { value: '__NO_REMARK__', label: t('filter.noRemarks') || 'No Remarks' },
    { value: rulesConfig.remarkNightShift, label: rulesConfig.remarkNightShift + ' (Night Shift)' },
    { value: rulesConfig.remarkLateSuffix, label: rulesConfig.remarkLateSuffix + ' (Late/Leave Needed)' },
    { value: rulesConfig.remarkLeaveApplied || 'ခွင့်တိုင်ပြီး', label: (rulesConfig.remarkLeaveApplied || 'ခွင့်တိုင်ပြီး') + ' (Leave Applied)' },
    { value: rulesConfig.remarkOtSuffix, label: rulesConfig.remarkOtSuffix + ' (OT Needed)' },
    { value: rulesConfig.remarkOtApplied || 'အိုတီတင်ပီး', label: (rulesConfig.remarkOtApplied || 'အိုတီတင်ပီး') + ' (OT Applied)' },
    { value: rulesConfig.remarkNoCheckout, label: rulesConfig.remarkNoCheckout + ' (No Checkout)' },
    { value: rulesConfig.remarkNoCheckin, label: rulesConfig.remarkNoCheckin + ' (No Checkin)' },
    { value: rulesConfig.remarkNoRecord, label: rulesConfig.remarkNoRecord + ' (No Record/Absent)' },
  ];

  for (const c of remChoices) {
    if (!c.value && c.label !== (t('settings.filterAllRemarks') || '— All Remarks —')) continue;
    const opt = document.createElement('option');
    opt.value = c.value;
    opt.textContent = c.label;
    if (activeFilter.remarks === c.value) opt.selected = true;
    remSelect.appendChild(opt);
  }
  remField.appendChild(remSelect);
  grid.appendChild(remField);

  panel.appendChild(grid);
  // (Filter panel actions: reset & generate/download buttons removed per user request)
  container.appendChild(panel);

  // Summary bar above the table showing total and filtered counts
  const summaryBar = document.createElement('div');
  summaryBar.className = 'live-table-summary-bar';
  
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn btn-secondary btn-sm';
  exportBtn.innerHTML = `📥 <span data-i18n="preview.exportVisible">${t('preview.exportVisible') || 'Export to Excel'}</span>`;
  exportBtn.style.cssText = 'margin-left: auto;';
  exportBtn.addEventListener('click', () => {
    callbacks?.onExportVisible?.(currentFilteredRows);
  });
  summaryBar.appendChild(exportBtn);
  
  container.appendChild(summaryBar);

  // Table wrapper container
  const tableHolder = document.createElement('div');
  tableHolder.style.width = '100%';
  container.appendChild(tableHolder);

  let currentFilteredRows: AttendanceRow[] = rows;
  // ── Filter evaluation ──
  const applyFilters = () => {
    const isHideResolved = hideResolvedCheckbox.checked;
    const isHideApplied = hideAppliedCheckbox.checked;
    const isHideNoCheckout = hideNoCheckoutCheckbox.checked;
    const current: LiveFilterState = {
      idNo: idInput.value.trim(),
      name: '',
      groupCode: groupInput.value.trim(),
      date: dateInput.value.trim(),
      klass: classInput.value.trim(),
      absent: '',
      overtime: '',
      remarks: remSelect.value.trim(),
      hideResolved: isHideResolved,
      hideFutureShifts: hideFutureShiftsCheckbox.checked,
      hideApplied: isHideApplied,
      hideNoCheckout: isHideNoCheckout,
    };

    const hasActiveFilter = Boolean(
      current.idNo ||
      current.groupCode ||
      current.date ||
      current.klass ||
      current.remarks ||
      !isHideResolved ||
      !current.hideFutureShifts ||
      !current.hideApplied ||
      current.hideNoCheckout
    );

    let cApplied = 0;
    let cNoCheckout = 0;
    let cFuture = 0;
    let cResolved = 0;

    const todayStrGlobal = (() => {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}${mm}${dd}`;
    })();

    rows.forEach(r => {
      if (isRemarkGreen(r.remarks)) cApplied++;
      
      const isNoCO = r.remarks.includes('အထြက္တိုင္းကဒ် မရွိပါ') ||
          r.remarks.includes('အထွက်တိုင်းကဒ်မရှိပါ') ||
          r.remarks.includes('အထွက်တိုင်းကတ် မရှိပါ') ||
          r.remarks.includes(REMARK_NO_CHECKOUT);
      if (isNoCO) cNoCheckout++;
      
      const rowDate = normalizeDateDigits(r.attendanceDate);
      const actPunches = r.actualTimeCard.split(',').map((s) => s.trim()).filter((s) => s.length >= 4 && !isNaN(parseInt(s, 10)));
      const isFutureOrNight = rowDate >= todayStrGlobal && actPunches.length === 0 && (r.remarks === '' || r.remarks.includes('ညဆိုင္း') || r.remarks.includes('ညဆိုင်း'));
      if (isFutureOrNight) cFuture++;
      
      if (isRowResolved(r) && !isFutureOrNight) {
         cResolved++;
      }
    });

    hideAppliedBadge.textContent = ` (${cApplied})`;
    hideNoCheckoutBadge.textContent = ` (${cNoCheckout})`;
    hideFutureShiftsBadge.textContent = ` (${cFuture})`;
    hideResolvedBadge.textContent = ` (${cResolved})`;

    Array.from(remSelect.options).forEach((opt) => {
      opt.style.color = '';
      if (isHideApplied && (
        opt.value === (rulesConfig.remarkLeaveApplied || 'ခွင့်တိုင်ပြီး') ||
        opt.value === (rulesConfig.remarkOtApplied || 'အိုတီတင်ပီး')
      )) {
        opt.style.color = 'var(--text-muted)';
      }
      if (isHideNoCheckout && opt.value === rulesConfig.remarkNoCheckout) {
        opt.style.color = 'var(--text-muted)';
      }
    });

    const filtered = rows.filter((r) => {
      if (current.hideApplied && isRemarkGreen(r.remarks)) {
        return false;
      }
      if (current.hideNoCheckout) {
        if (
          r.remarks.includes('အထြက္တိုင္းကဒ် မရွိပါ') ||
          r.remarks.includes('အထွက်တိုင်းကဒ်မရှိပါ') ||
          r.remarks.includes('အထွက်တိုင်းကတ် မရှိပါ') ||
          r.remarks.includes(REMARK_NO_CHECKOUT)
        ) {
          return false;
        }
      }
      const rowDate = normalizeDateDigits(r.attendanceDate);
      const todayStr = (() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}${mm}${dd}`;
      })();
      const actPunches = r.actualTimeCard.split(',').map((s) => s.trim()).filter((s) => s.length >= 4 && !isNaN(parseInt(s, 10)));
      const isFutureOrNight = rowDate >= todayStr && actPunches.length === 0 && (r.remarks === '' || r.remarks.includes('ညဆိုင္း') || r.remarks.includes('ညဆိုင်း'));

      if (current.hideFutureShifts && isFutureOrNight) {
        return false;
      }

      if (isHideResolved && isRowResolved(r)) {
        if (isFutureOrNight && !current.hideFutureShifts) {
          // Keep visible if user unchecked hideFutureShifts
        } else {
          return false;
        }
      }
      if (current.idNo && !r.employeeId.toLowerCase().includes(current.idNo.toLowerCase())) {
        return false;
      }
      if (current.groupCode && !r.groupCode.toLowerCase().includes(current.groupCode.toLowerCase())) {
        return false;
      }
      if (current.date && !r.attendanceDate.includes(current.date)) {
        return false;
      }
      if (current.klass && !r.klass.toLowerCase().includes(current.klass.toLowerCase())) {
        return false;
      }
      if (current.remarks) {
        if (current.remarks === '__HAS_REMARK__') {
          if (!r.remarks || r.remarks.trim() === '') return false;
        } else if (current.remarks === '__NO_REMARK__') {
          if (r.remarks && r.remarks.trim() !== '') return false;
        } else if (!r.remarks.includes(current.remarks)) {
          return false;
        }
      }
      return true;
    });

    const hiddenCount = rows.length - filtered.length;

    // Update dynamic summary bar
    summaryBar.innerHTML = `
      <div class="summary-stat-box">
        <span class="stat-badge stat-total">
          <span class="stat-label">Total Rows</span>: <strong>${rows.length}</strong>
        </span>
        <span class="stat-badge stat-filtered">
          <span class="stat-label">Showing</span>: <strong>${filtered.length}</strong>
        </span>
        ${hiddenCount > 0 ? `
        <span class="stat-badge stat-hidden">
          <span>${hiddenCount} hidden by filters</span>
        </span>` : ''}
      </div>
      <div class="summary-hint-text">
        ${filtered.length === rows.length ? t('preview.showingAll', { count: rows.length }) : t('preview.showingFiltered', { filtered: filtered.length, total: rows.length })}
      </div>
    `;
    currentFilteredRows = filtered;
    summaryBar.appendChild(exportBtn);

    // Update row count badge in filter panel header
    if (!hasActiveFilter && isHideResolved) {
      filterBadge.textContent = `${filtered.length} pending error rows (${hiddenCount} OK hidden)`;
    } else if (!hasActiveFilter) {
      filterBadge.textContent = t('preview.showingAll', { count: rows.length });
    } else {
      filterBadge.textContent = t('preview.showingFiltered', {
        filtered: filtered.length,
        total: rows.length,
      });
    }

    // Render table with filtered rows
    tableHolder.innerHTML = '';
    tableHolder.appendChild(buildPreviewTable(filtered));

    onFilterChange(current);
  };

  hideResolvedCheckbox.addEventListener('change', applyFilters);
  hideFutureShiftsCheckbox.addEventListener('change', applyFilters);
  hideAppliedCheckbox.addEventListener('change', applyFilters);
  hideNoCheckoutCheckbox.addEventListener('change', applyFilters);

  idInput.addEventListener('input', applyFilters);
  idInput.addEventListener('change', applyFilters);
  groupInput.addEventListener('input', applyFilters);
  groupInput.addEventListener('change', applyFilters);
  dateInput.addEventListener('input', applyFilters);
  dateInput.addEventListener('change', applyFilters);
  classInput.addEventListener('input', applyFilters);
  classInput.addEventListener('change', applyFilters);
  remSelect.addEventListener('change', applyFilters);

  // Initial display
  applyFilters();

  return container;
}

// ─── Error / warning panel ────────────────────────────────────────────────────

/**
 * Build an error or warning panel showing a list of messages.
 * @param messages  List of error strings
 * @param type      'error' | 'warning' | 'info'
 * @param titleKey  i18n key for the panel title
 */
export function buildAlertPanel(
  messages: string[],
  type: 'error' | 'warning' | 'info',
  titleKey: string
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = `alert-panel alert-panel-${type}`;

  const iconEl = document.createElement('span');
  iconEl.innerHTML = icons.alertTriangle;
  panel.appendChild(iconEl);

  const body = document.createElement('div');
  body.className = 'alert-panel-body';

  const title = document.createElement('div');
  title.className = 'alert-panel-title';
  title.setAttribute('data-i18n', titleKey);
  title.textContent = t(titleKey);
  body.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'alert-panel-list';
  for (const msg of messages) {
    const li = document.createElement('li');
    li.textContent = msg;
    list.appendChild(li);
  }
  body.appendChild(list);
  panel.appendChild(body);

  return panel;
}

// ─── Help panel ───────────────────────────────────────────────────────────────

/**
 * Build the collapsible help panel with business rules and auth caveat.
 */
export function buildHelpPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'help-panel';

  const toggle = document.createElement('button');
  toggle.className = 'help-panel-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'help-panel-body');

  const toggleLeft = document.createElement('span');
  toggleLeft.className = 'help-panel-toggle-left';
  toggleLeft.innerHTML = icons.info;
  const toggleLabel = document.createElement('span');
  toggleLabel.setAttribute('data-i18n', 'help.heading');
  toggleLabel.textContent = t('help.heading');
  toggleLeft.appendChild(toggleLabel);
  toggle.appendChild(toggleLeft);

  const chevronEl = document.createElement('span');
  chevronEl.innerHTML = icons.chevronDown;
  toggle.appendChild(chevronEl);

  const body = document.createElement('div');
  body.className = 'help-panel-body';
  body.id = 'help-panel-body';

  const helpItems: Array<{ icon: string; key: string }> = [
    { icon: 'info', key: 'help.gracePeriod' },
    { icon: 'info', key: 'help.lateFormula' },
    { icon: 'info', key: 'help.precedence' },
    { icon: 'info', key: 'help.noRecord' },
    { icon: 'info', key: 'help.noCheckout' },
    { icon: 'alertTriangle', key: 'help.zawgyiNote' },
    { icon: 'alertTriangle', key: 'help.authNote' },
  ];

  for (const item of helpItems) {
    const rule = document.createElement('div');
    rule.className = 'help-rule';

    const iconEl = document.createElement('span');
    iconEl.className = 'help-rule-icon';
    iconEl.innerHTML = icons[item.icon] ?? '';
    rule.appendChild(iconEl);

    const text = document.createElement('span');
    text.setAttribute('data-i18n', item.key);
    text.textContent = t(item.key);
    rule.appendChild(text);

    body.appendChild(rule);
  }

  panel.appendChild(toggle);
  panel.appendChild(body);

  toggle.addEventListener('click', () => {
    const isOpen = body.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    chevronEl.innerHTML = isOpen ? icons.chevronUp : icons.chevronDown;
  });

  return panel;
}

// ─── Toast notifications ──────────────────────────────────────────────────────

let toastContainer: HTMLElement | null = null;

function getToastContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconEl = document.createElement('span');
  iconEl.innerHTML = type === 'success' ? icons.checkCircle2 : icons.alertTriangle;
  toast.appendChild(iconEl);

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── Export preview info ──────────────────────────────────────────────────────

export function buildExportPreviewInfo(
  rows: AttendanceRow[],
  selectedGroups: Set<string>,
  mode: ExportMode
): string {
  const { fileCount, rowCount } = exportPreviewSummary(rows, selectedGroups, mode);
  if (fileCount === 0 || rowCount === 0) return t('export.noRowsSelected');
  return t('export.previewInfo', { fileCount, rowCount });
}

// ─── Theme switcher ───────────────────────────────────────────────────────────

/**
 * Build the Light/Dark theme toggle button for the Header.
 */
export function buildThemeSwitcher(
  getTheme: () => Theme,
  onToggle: (theme: Theme) => void
): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'header-action-btn theme-toggle-btn';
  btn.type = 'button';

  const update = () => {
    const cur = getTheme();
    btn.innerHTML = cur === 'dark' ? icons.sun : icons.moon;
    const labelKey = cur === 'dark' ? 'theme.toggleDark' : 'theme.toggleLight';
    btn.title = t(labelKey);
    btn.setAttribute('aria-label', t(labelKey));
  };

  btn.addEventListener('click', () => {
    const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
    onToggle(next);
    update();
  });

  update();
  return btn;
}

// ─── Header Help button ───────────────────────────────────────────────────────

/**
 * Build the "?" Help & Rules button for the Header.
 */
export function buildHeaderHelpButton(onClick: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'header-action-btn header-help-btn';
  btn.type = 'button';
  btn.innerHTML = icons.helpCircle;
  btn.title = t('help.openModal');
  btn.setAttribute('aria-label', t('help.openModal'));
  btn.addEventListener('click', onClick);
  return btn;
}

// ─── Help Modal ───────────────────────────────────────────────────────────────

/**
 * Build the Help & Rules modal popup.
 */
export function buildHelpModal(
  resources?: ResourceLink[],
  onClose?: () => void
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'modal-help-title');

  const card = document.createElement('div');
  card.className = 'modal-card';

  // Header
  const header = document.createElement('div');
  header.className = 'modal-header';

  const title = document.createElement('h3');
  title.className = 'modal-title';
  title.id = 'modal-help-title';
  title.innerHTML = `${icons.helpCircle} <span>${t('help.heading')}</span>`;
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close-btn';
  closeBtn.type = 'button';
  closeBtn.innerHTML = icons.x;
  closeBtn.title = t('help.close');
  closeBtn.setAttribute('aria-label', t('help.close'));
  header.appendChild(closeBtn);
  card.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'modal-body';

  // Rules
  const rulesTitle = document.createElement('div');
  rulesTitle.className = 'modal-section-title';
  rulesTitle.textContent = t('help.heading');
  body.appendChild(rulesTitle);

  const helpItems: Array<{ icon: string; key: string }> = [
    { icon: 'info', key: 'help.gracePeriod' },
    { icon: 'info', key: 'help.lateFormula' },
    { icon: 'info', key: 'help.precedence' },
    { icon: 'info', key: 'help.noRecord' },
    { icon: 'info', key: 'help.noCheckout' },
    { icon: 'alertTriangle', key: 'help.zawgyiNote' },
    { icon: 'alertTriangle', key: 'help.authNote' },
  ];

  for (const item of helpItems) {
    const rule = document.createElement('div');
    rule.className = 'help-rule';

    const iconEl = document.createElement('span');
    iconEl.className = 'help-rule-icon';
    iconEl.innerHTML = icons[item.icon] ?? '';
    rule.appendChild(iconEl);

    const text = document.createElement('span');
    text.setAttribute('data-i18n', item.key);
    text.textContent = t(item.key);
    rule.appendChild(text);

    body.appendChild(rule);
  }

  // Resources section
  if (resources && resources.length > 0) {
    const resTitle = document.createElement('div');
    resTitle.className = 'modal-section-title';
    resTitle.style.marginTop = '14px';
    resTitle.textContent = t('help.resources');
    body.appendChild(resTitle);

    const resBar = document.createElement('div');
    resBar.className = 'resources-bar';
    resBar.style.justifyContent = 'flex-start';

    for (const res of resources) {
      const a = document.createElement('a');
      a.className = 'resource-chip';
      a.href = res.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.innerHTML = `${icons.externalLink} <span>${res.label}</span>`;
      resBar.appendChild(a);
    }
    body.appendChild(resBar);
  }

  card.appendChild(body);
  overlay.appendChild(card);

  const close = () => {
    overlay.remove();
    if (onClose) onClose();
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  return overlay;
}

// ─── Resources bar for Login / Footer ─────────────────────────────────────────

export function buildResourcesBar(resources?: ResourceLink[]): HTMLElement | null {
  if (!resources || resources.length === 0) return null;

  const bar = document.createElement('div');
  bar.className = 'resources-bar';

  for (const res of resources) {
    const a = document.createElement('a');
    a.className = 'resource-chip';
    a.href = res.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = `${icons.externalLink} <span>${res.label}</span>`;
    bar.appendChild(a);
  }

  return bar;
}

// ─── Feedback Header Button ───────────────────────────────────────────────────

export function buildFeedbackButton(onClick: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'header-feedback-btn';
  btn.type = 'button';
  btn.innerHTML = `${icons.messageSquare} <span>${t('nav.feedback')}</span>`;
  btn.title = t('nav.feedback');
  btn.setAttribute('aria-label', t('nav.feedback'));
  btn.addEventListener('click', onClick);
  return btn;
}

// ─── Feedback Modal ───────────────────────────────────────────────────────────

export function buildFeedbackModal(
  resources?: ResourceLink[],
  onClose?: () => void
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'modal-feedback-title');

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.style.maxWidth = '560px';

  // Header
  const header = document.createElement('div');
  header.className = 'modal-header';

  const title = document.createElement('h3');
  title.className = 'modal-title';
  title.id = 'modal-feedback-title';
  title.innerHTML = `${icons.messageSquare} <span>${t('nav.feedback')}</span>`;
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close-btn';
  closeBtn.type = 'button';
  closeBtn.innerHTML = icons.x;
  closeBtn.title = t('help.close');
  closeBtn.setAttribute('aria-label', t('help.close'));
  header.appendChild(closeBtn);
  card.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'modal-body';

  const desc = document.createElement('p');
  desc.style.cssText = 'color: var(--text-secondary); font-size: 0.88rem; line-height: 1.5; margin-bottom: 8px;';
  desc.textContent = 'We appreciate your feedback, issue reports, and feature requests. Fill in your message below or open Typeform directly.';
  body.appendChild(desc);

  // Check if typeform URL is in resources
  const typeformRes = resources?.find((r) =>
    r.url.includes('typeform') || r.label.toLowerCase().includes('feedback')
  );

  if (typeformRes) {
    const tfBox = document.createElement('div');
    tfBox.style.cssText = 'background: var(--bg-inset); border: 1px solid var(--border-hairline); border-radius: var(--radius-md); padding: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px;';

    const tfText = document.createElement('div');
    tfText.innerHTML = `<div style="font-weight:600; font-size:0.88rem; color:var(--text-primary);">${typeformRes.label}</div><div style="font-size:0.78rem; color:var(--text-muted);">Direct online questionnaire (Typeform)</div>`;
    tfBox.appendChild(tfText);

    const tfBtn = document.createElement('a');
    tfBtn.className = 'btn btn-primary btn-sm';
    tfBtn.href = typeformRes.url;
    tfBtn.target = '_blank';
    tfBtn.rel = 'noopener noreferrer';
    tfBtn.innerHTML = `${icons.externalLink} Open Typeform`;
    tfBox.appendChild(tfBtn);

    body.appendChild(tfBox);
  }

  // Quick message input box
  const formBox = document.createElement('div');
  formBox.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

  const msgLabel = document.createElement('label');
  msgLabel.style.cssText = 'font-size: 0.82rem; font-weight: 600; color: var(--text-secondary);';
  msgLabel.textContent = 'Message / Issue description / ပေးပို့လိုသော အကြောင်းအရာ:';
  formBox.appendChild(msgLabel);

  const msgInput = document.createElement('textarea');
  msgInput.className = 'form-input';
  msgInput.rows = 4;
  msgInput.placeholder = 'Type your feedback, question, or bug report here...';
  msgInput.style.cssText = 'resize: vertical; font-family: inherit; font-size: 0.86rem; padding: 10px;';
  formBox.appendChild(msgInput);

  const sendEmailBtn = document.createElement('a');
  sendEmailBtn.className = 'btn btn-secondary btn-sm';
  sendEmailBtn.style.cssText = 'align-self: flex-end; display: inline-flex; align-items: center; gap: 6px;';
  sendEmailBtn.innerHTML = `${icons.messageSquare} Send via Email`;
  sendEmailBtn.href = 'mailto:mpc.erp@pouchen.com.mm?subject=HR-Portal%20Feedback';

  msgInput.addEventListener('input', () => {
    const encoded = encodeURIComponent(msgInput.value.trim());
    sendEmailBtn.href = `mailto:mpc.erp@pouchen.com.mm?subject=HR-Portal%20Feedback&body=${encoded}`;
  });

  formBox.appendChild(sendEmailBtn);
  body.appendChild(formBox);

  // Developer Team credits inside feedback form
  const creditsBox = document.createElement('div');
  creditsBox.className = 'feedback-modal-credits';
  creditsBox.innerHTML = `
    <div>Developed by <a href="mailto:ting.hah@pouchen.com.mm" class="credit-link">ting | Htet Aung Hlaing</a></div>
    <div>@ <a href="mailto:mpc.erp@pouchen.com.mm" class="credit-link">PMA IT PCB Team</a></div>
  `;
  body.appendChild(creditsBox);

  card.appendChild(body);
  overlay.appendChild(card);

  const close = () => {
    overlay.remove();
    if (onClose) onClose();
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  return overlay;
}

// ─── Sidebar Navigation Panel ─────────────────────────────────────────────────

export interface SidebarStepItem {
  id: number;
  icon: string;
  labelKey: string;
  defaultLabel: string;
}

export function buildSidebarPanel(
  activeStep: number,
  isFolded: boolean,
  onStepSelect: (step: number) => void,
  onToggleFold: () => void
): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = `app-sidebar${isFolded ? ' folded' : ''}`;
  sidebar.id = 'app-sidebar';

  // Toggle button at top of sidebar
  const toggleRow = document.createElement('div');
  toggleRow.className = 'sidebar-toggle-row';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'sidebar-fold-btn';
  toggleBtn.title = isFolded ? 'Expand Sidebar' : 'Collapse Sidebar';
  toggleBtn.setAttribute('aria-label', toggleBtn.title);
  toggleBtn.innerHTML = icons.panelLeft;
  toggleBtn.addEventListener('click', onToggleFold);
  toggleRow.appendChild(toggleBtn);

  if (!isFolded) {
    const titleText = document.createElement('span');
    titleText.className = 'sidebar-header-title';
    titleText.textContent = 'Process Steps';
    toggleRow.appendChild(titleText);
  }

  sidebar.appendChild(toggleRow);

  // Navigation steps
  const nav = document.createElement('nav');
  nav.className = 'sidebar-nav';

  const steps: SidebarStepItem[] = [
    { id: 1, icon: icons.uploadCloud, labelKey: 'upload.heading', defaultLabel: 'Upload Files' },
    { id: 2, icon: icons.split, labelKey: 'groups.heading', defaultLabel: 'Group Codes' },
    { id: 3, icon: icons.folderOutput, labelKey: 'export.heading', defaultLabel: 'Export Mode' },
    { id: 4, icon: icons.fileSpreadsheet, labelKey: 'preview.heading', defaultLabel: 'Live Preview' },
  ];

  for (const step of steps) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `sidebar-step-item${(activeStep === step.id || (step.id === 2 && activeStep === 3) || (step.id === 3 && activeStep === 2)) ? ' active' : ''}`;
    item.setAttribute('data-step', String(step.id));
    item.title = `${step.id}. ${t(step.labelKey) || step.defaultLabel}`;

    const badge = document.createElement('span');
    badge.className = 'sidebar-step-badge';
    badge.textContent = String(step.id);
    item.appendChild(badge);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'sidebar-step-icon';
    iconSpan.innerHTML = step.icon;
    item.appendChild(iconSpan);

    if (!isFolded) {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'sidebar-step-label';
      labelSpan.setAttribute('data-i18n', step.labelKey);
      labelSpan.textContent = t(step.labelKey) || step.defaultLabel;
      item.appendChild(labelSpan);
    }

    item.addEventListener('click', () => {
      onStepSelect(step.id);
    });

    nav.appendChild(item);
  }

  sidebar.appendChild(nav);
  return sidebar;
}

// ─── Re-export icons for use in main.ts ──────────────────────────────────────
export { icons };
