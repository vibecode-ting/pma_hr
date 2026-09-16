/**
 * main.ts — App entry point.
 *
 * Layout:
 *  - Header: logo + app title (gold both themes) + minimal
 *  - Sidebar: profile, theme, language, help, feedback, logout
 *  - Sub-header tabs: [1. Upload] [2. Config] [3. Live & Export]
 */

import './styles/global.css';
import { initLocale, setLocale, getLocale, applyAll, t } from './i18n';
import type { AppConfig, AttendanceRow, ExportMode, SessionData, Theme, LiveFilterState, RulesConfig } from './types';
import { parseAllFiles } from './parse';
import {
  applyRemarks,
  DEFAULT_SHIFTS,
  GRACE_MINUTES,
  EARLY_OUT_GRACE_MINUTES,
  OT_THRESHOLD_MINUTES,
  REMARK_LATE_SUFFIX,
  REMARK_NO_RECORD,
  REMARK_LEAVE_APPLIED,
  REMARK_NO_CHECKOUT,
  REMARK_NO_CHECKIN,
  REMARK_OT_SUFFIX,
  REMARK_OT_APPLIED,
  REMARK_NIGHT_SHIFT,
  isRowResolved,
  isRemarkGreen,
  isRemarkRed,
} from './rules';
import { exportSelection } from './export';
import {
  createStarfield,
  buildLangSwitcher,
  buildSidebarLangSwitcher,
  buildThemeSwitcher,
  buildHeaderHelpButton,
  buildHelpModal,
  buildFeedbackButton,
  buildFeedbackModal,
  buildResourcesBar,
  buildFileChips,
  buildGroupChecklist,
  buildExportModeCards,
  buildLivePreviewSection,
  buildAlertPanel,
  buildExportPreviewInfo,
  showToast,
  icons,
} from './ui';
import type { GroupInfo } from './ui';

let appConfig: AppConfig | null = null;
let defaultRulesConfig: RulesConfig = {
  graceMinutes: GRACE_MINUTES,
  earlyOutGraceMinutes: EARLY_OUT_GRACE_MINUTES,
  otThresholdMinutes: OT_THRESHOLD_MINUTES,
  remarkLateSuffix: REMARK_LATE_SUFFIX,
  remarkNoRecord: REMARK_NO_RECORD,
  remarkLeaveApplied: REMARK_LEAVE_APPLIED,
  remarkNoCheckout: REMARK_NO_CHECKOUT,
  remarkNoCheckin: REMARK_NO_CHECKIN,
  remarkOtSuffix: REMARK_OT_SUFFIX,
  remarkOtApplied: REMARK_OT_APPLIED,
  remarkNightShift: REMARK_NIGHT_SHIFT,
  shifts: JSON.parse(JSON.stringify(DEFAULT_SHIFTS)),
};
let rulesConfig: RulesConfig = JSON.parse(JSON.stringify(defaultRulesConfig));
let allRows: AttendanceRow[] = [];
let uploadedFiles: File[] = [];
let selectedGroups: Set<string> = new Set();
let exportMode: ExportMode = 'per-group';
let parseErrors: string[] = [];
let parseWarnings: string[] = [];
let activeFilter: LiveFilterState = { idNo: '', name: '', groupCode: '', date: '', klass: '', remarks: '', absent: '', overtime: '', hideResolved: true, hideFutureShifts: true, hideApplied: true };

const SESSION_KEY = 'hr_portal_session';
const THEME_STORAGE_KEY = 'hr_portal_theme';

// ─── Theme helpers ────────────────────────────────────────────────────────────

function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function getSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch { return null; }
}

function setSession(data: SessionData): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── Config fetch ─────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AppConfig = {
  version: '1.0.0',
  appTitle: 'Pouchen Myanmar Adidas B150 | HR-Portal',
  accounts: [],
  resources: [
    { label: 'ting.hah@pouchen.com.mm', url: 'mailto:ting.hah@pouchen.com.mm' },
    { label: 'mpc.erp@pouchen.com.mm', url: 'mailto:mpc.erp@pouchen.com.mm' }
  ]
};

async function loadConfig(): Promise<AppConfig> {
  try {
    const resp = await fetch('./config.json');
    if (resp.ok) return await resp.json() as AppConfig;
  } catch (e) {
    console.warn('Could not load ./config.json:', e);
  }

  try {
    const resp2 = await fetch('/config.json');
    if (resp2.ok) return await resp2.json() as AppConfig;
  } catch {
    /* fallback to DEFAULT_CONFIG */
  }

  return DEFAULT_CONFIG;
}

async function loadRulesConfig(): Promise<void> {
  try {
    const resp = await fetch('./rules.json');
    if (resp.ok) {
      const data = await resp.json() as Partial<RulesConfig>;
      defaultRulesConfig = {
        graceMinutes: typeof data.graceMinutes === 'number' ? data.graceMinutes : GRACE_MINUTES,
        earlyOutGraceMinutes: typeof data.earlyOutGraceMinutes === 'number' ? data.earlyOutGraceMinutes : EARLY_OUT_GRACE_MINUTES,
        otThresholdMinutes: typeof data.otThresholdMinutes === 'number' ? data.otThresholdMinutes : OT_THRESHOLD_MINUTES,
        remarkLateSuffix: data.remarkLateSuffix ?? data.remarkLate ?? REMARK_LATE_SUFFIX,
        remarkNoRecord: data.remarkNoRecord ?? REMARK_NO_RECORD,
        remarkLeaveApplied: data.remarkLeaveApplied ?? REMARK_LEAVE_APPLIED,
        remarkNoCheckout: data.remarkNoCheckout !== undefined ? data.remarkNoCheckout : REMARK_NO_CHECKOUT,
        remarkNoCheckin: data.remarkNoCheckin !== undefined ? data.remarkNoCheckin : REMARK_NO_CHECKIN,
        remarkOtSuffix: data.remarkOtSuffix ?? REMARK_OT_SUFFIX,
        remarkOtApplied: data.remarkOtApplied ?? REMARK_OT_APPLIED,
        remarkNightShift: data.remarkNightShift ?? REMARK_NIGHT_SHIFT,
        shifts: Array.isArray(data.shifts) && data.shifts.length > 0 ? data.shifts : JSON.parse(JSON.stringify(DEFAULT_SHIFTS)),
      };
      rulesConfig = JSON.parse(JSON.stringify(defaultRulesConfig));
    }
  } catch { /* use defaults */ }

  const saved = localStorage.getItem('hr_portal_rules_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      rulesConfig = { ...rulesConfig, ...parsed };
    } catch { /* ignore */ }
  }
}

// ─── Login page ───────────────────────────────────────────────────────────────

function renderLogin(container: HTMLElement): void {
  container.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'page-wrapper login-split-page';

  // ── Left Hero Panel: Full Unobscured Background Image & Logo Wall ──
  const leftPanel = document.createElement('div');
  leftPanel.className = 'login-left-panel';

  const heroImage = document.createElement('div');
  heroImage.className = 'login-hero-image';
  heroImage.style.backgroundImage = 'url("./login-bg.jpeg")';
  leftPanel.appendChild(heroImage);

  const heroScrim = document.createElement('div');
  heroScrim.className = 'login-hero-scrim';
  leftPanel.appendChild(heroScrim);

  page.appendChild(leftPanel);

  // ── Right Form Panel: Controls, Glass Card & Form ──
  const rightPanel = document.createElement('div');
  rightPanel.className = 'login-right-panel';

  // Panel Top: Theme & Language Switchers
  const panelTop = document.createElement('div');
  panelTop.className = 'login-panel-top';

  const topControls = document.createElement('div');
  topControls.className = 'login-top-controls';
  topControls.style.position = 'static';
  topControls.appendChild(buildThemeSwitcher(getTheme, (th) => setTheme(th)));
  const divider = document.createElement('div');
  divider.className = 'login-ctrl-divider';
  topControls.appendChild(divider);
  topControls.appendChild(buildLangSwitcher(getLocale, (l) => { setLocale(l); applyAll(); }));
  panelTop.appendChild(topControls);

  rightPanel.appendChild(panelTop);

  // Center Form Container with Glass & Shadows
  const formContainer = document.createElement('div');
  formContainer.className = 'login-form-container login-glass-card';

  // Form Header: Logo (left, circle) & Brand Title (right)
  const formHeader = document.createElement('div');
  formHeader.className = 'login-form-header';
  formHeader.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:24px;text-align:left;';

  const rightLogo = document.createElement('img');
  rightLogo.src = './pouchen_logo.png';
  rightLogo.alt = 'Pouchen Logo';
  rightLogo.className = 'login-right-logo';
  // Circle shape styling
  rightLogo.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:50%;flex-shrink:0;border:2px solid var(--accent-gold, #D4AF37);background:white;margin:0;padding:4px;';
  formHeader.appendChild(rightLogo);

  const brandWrap = document.createElement('div');
  brandWrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;';

  const brandBadge = document.createElement('div');
  brandBadge.className = 'login-right-brand-badge';
  brandBadge.style.margin = '0 0 6px 0';
  brandBadge.innerHTML = `<span class="badge-dot"></span><span>ADIDAS B150 HR-PORTAL</span>`;
  brandWrap.appendChild(brandBadge);

  const brandTitle = document.createElement('h1');
  brandTitle.className = 'login-right-brand-title';
  brandTitle.style.margin = '0 0 2px 0';
  brandTitle.style.fontSize = '1.25rem'; // slightly smaller to fit better inside the box
  brandTitle.textContent = 'Pouchen | B150 HR-Portal';
  brandWrap.appendChild(brandTitle);

  const brandSub = document.createElement('p');
  brandSub.className = 'login-right-brand-sub';
  brandSub.style.margin = '0';
  brandSub.textContent = 'Attendance & Shift Automation System';
  brandWrap.appendChild(brandSub);

  formHeader.appendChild(brandWrap);

  formContainer.appendChild(formHeader);

  // Form Fields
  const userGroup = document.createElement('div');
  userGroup.className = 'form-group';
  const userLabel = document.createElement('label');
  userLabel.className = 'form-label';
  userLabel.setAttribute('for', 'login-username');
  userLabel.innerHTML = icons.user;
  const userLabelText = document.createElement('span');
  userLabelText.setAttribute('data-i18n', 'login.username');
  userLabelText.textContent = t('login.username');
  userLabel.appendChild(userLabelText);
  userGroup.appendChild(userLabel);
  const userInput = document.createElement('input');
  userInput.type = 'text'; userInput.id = 'login-username'; userInput.className = 'form-input';
  userInput.autocomplete = 'username';
  userInput.setAttribute('data-i18n-placeholder', 'login.username');
  userInput.placeholder = t('login.username');
  userGroup.appendChild(userInput);
  formContainer.appendChild(userGroup);

  const passGroup = document.createElement('div');
  passGroup.className = 'form-group';
  const passLabel = document.createElement('label');
  passLabel.className = 'form-label';
  passLabel.setAttribute('for', 'login-password');
  passLabel.innerHTML = icons.lock;
  const passLabelText = document.createElement('span');
  passLabelText.setAttribute('data-i18n', 'login.password');
  passLabelText.textContent = t('login.password');
  passLabel.appendChild(passLabelText);
  passGroup.appendChild(passLabel);
  const passInput = document.createElement('input');
  passInput.type = 'password'; passInput.id = 'login-password'; passInput.className = 'form-input';
  passInput.autocomplete = 'current-password';
  passInput.setAttribute('data-i18n-placeholder', 'login.password');
  passInput.placeholder = t('login.password');
  passGroup.appendChild(passInput);
  formContainer.appendChild(passGroup);

  const errorEl = document.createElement('div');
  errorEl.className = 'form-error hidden';
  errorEl.id = 'login-error';
  errorEl.innerHTML = icons.alertTriangle;
  const errorText = document.createElement('span');
  errorText.setAttribute('data-i18n', 'login.error');
  errorText.textContent = t('login.error');
  errorEl.appendChild(errorText);
  formContainer.appendChild(errorEl);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit'; submitBtn.id = 'login-submit';
  submitBtn.className = 'btn btn-primary btn-full login-btn';
  submitBtn.setAttribute('data-i18n', 'login.submit');
  submitBtn.textContent = t('login.submit');
  formContainer.appendChild(submitBtn);

  rightPanel.appendChild(formContainer);

  // Panel Footer
  const panelFooter = document.createElement('footer');
  panelFooter.className = 'login-panel-footer';

  const footerLine1 = document.createElement('div');
  footerLine1.className = 'login-footer-line';
  footerLine1.textContent = '© Pouchen Myanmar Adidas B150 — Internal Use Only';
  
  const footerLine2 = document.createElement('div');
  footerLine2.className = 'login-footer-line';
  footerLine2.innerHTML = `© Developed by <a href="mailto:ting.hah@pouchen.com.mm" class="credit-link">ting | Htet Aung Hlaing</a> | <a href="mailto:mpc.erp@pouchen.com.mm" class="credit-link">MM PCB IT Team</a>`;

  panelFooter.appendChild(footerLine1);
  panelFooter.appendChild(footerLine2);
  rightPanel.appendChild(panelFooter);

  page.appendChild(rightPanel);
  container.appendChild(page);

  const doLogin = async () => {
    const username = userInput.value.trim();
    const password = passInput.value;
    if (!username || !password) return;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span>`;
    const checkingText = document.createElement('span');
    checkingText.setAttribute('data-i18n', 'login.checking');
    checkingText.textContent = t('login.checking');
    submitBtn.appendChild(checkingText);
    errorEl.classList.add('hidden');
    await new Promise((r) => setTimeout(r, 300));
    const accounts = appConfig?.accounts ?? [];
    const match = accounts.find((a) => a.username === username && a.password === password);
    if (match) {
      setSession({ username: match.username, displayName: match.displayName });
      renderApp(container);
    } else {
      submitBtn.disabled = false;
      submitBtn.setAttribute('data-i18n', 'login.submit');
      submitBtn.textContent = t('login.submit');
      errorEl.classList.remove('hidden');
      passInput.value = '';
      passInput.focus();
    }
  };

  submitBtn.addEventListener('click', doLogin);
  passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') passInput.focus(); });
}

// ─── Main app ─────────────────────────────────────────────────────────────────

function renderApp(container: HTMLElement): void {
  const session = getSession();
  if (!session) { renderLogin(container); return; }

  container.innerHTML = '';
  container.appendChild(createStarfield());

  // ── Helper: run export (used by header download button) ──
  async function doExport(btn: HTMLButtonElement): Promise<void> {
    if (allRows.length === 0) { showToast('No data to export — please upload files first.', 'error'); return; }
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span><span>${t('export.generating')}</span>`;
    try {
      const exportRows = activeFilter.hideResolved !== false
        ? allRows.filter((r) => !isRowResolved(r))
        : allRows;
      await exportSelection(exportRows, selectedGroups, exportMode, (msg) => showToast(msg, 'info'));
      showToast(t('export.generate') + ' ✅', 'success');
    } catch (e) { showToast(String(e), 'error'); }
    btn.disabled = false;
    btn.innerHTML = `${icons.download} <span data-i18n="export.generate">${t('export.generate')}</span>`;
  }

  // ── Helper: Build Live View & General Settings Panel ──
  function buildLiveViewSettingsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-4);';

    // 1. Live View & Filtering Card
    const liveCard = document.createElement('div');
    liveCard.className = 'settings-group-card';
    liveCard.innerHTML = `
      <div class="settings-group-title">
        <span>📊</span> <span>Live View & Filter Defaults</span>
      </div>
    `;

    // Row: Default Hide Resolved Rows
    const rowResolved = document.createElement('div');
    rowResolved.className = 'settings-row';
    rowResolved.innerHTML = `
      <div class="settings-row-info">
        <span class="settings-row-label">Hide OK / Resolved Rows by Default</span>
        <span class="settings-row-desc">Automatically hide rows with no errors or remarks in Live View</span>
      </div>
    `;
    const toggleResolved = document.createElement('input');
    toggleResolved.type = 'checkbox';
    toggleResolved.checked = activeFilter.hideResolved !== false;
    toggleResolved.style.transform = 'scale(1.25)';
    toggleResolved.addEventListener('change', () => {
      activeFilter.hideResolved = toggleResolved.checked;
      localStorage.setItem('hr_pref_hide_resolved', String(toggleResolved.checked));
      if (activeTab === 2) renderContent();
      showToast('Live View filter preference saved', 'info');
    });
    rowResolved.appendChild(toggleResolved);
    liveCard.appendChild(rowResolved);

    // Row: Default Hide Future / No Punch Shifts
    const rowFuture = document.createElement('div');
    rowFuture.className = 'settings-row';
    rowFuture.innerHTML = `
      <div class="settings-row-info">
        <span class="settings-row-label">Hide Future Scheduled Shifts</span>
        <span class="settings-row-desc">Hide scheduled shifts where work time has not arrived and no punches exist</span>
      </div>
    `;
    const toggleFuture = document.createElement('input');
    toggleFuture.type = 'checkbox';
    toggleFuture.checked = activeFilter.hideFutureShifts !== false;
    toggleFuture.style.transform = 'scale(1.25)';
    toggleFuture.addEventListener('change', () => {
      activeFilter.hideFutureShifts = toggleFuture.checked;
      localStorage.setItem('hr_pref_hide_future', String(toggleFuture.checked));
      if (activeTab === 2) renderContent();
      showToast('Live View filter preference saved', 'info');
    });
    rowFuture.appendChild(toggleFuture);
    liveCard.appendChild(rowFuture);

    // Row: Default Hide Applied Leave & OT
    const rowApplied = document.createElement('div');
    rowApplied.className = 'settings-row';
    rowApplied.innerHTML = `
      <div class="settings-row-info">
        <span class="settings-row-label">Hide Leave & OT Applied Rows</span>
        <span class="settings-row-desc">Filter out rows marked as ခြင့္တိုင္ၿပီး (Leave Applied) or အိုတီတင္ပီး (OT Applied)</span>
      </div>
    `;
    const toggleApplied = document.createElement('input');
    toggleApplied.type = 'checkbox';
    toggleApplied.checked = activeFilter.hideApplied !== false;
    toggleApplied.style.transform = 'scale(1.25)';
    toggleApplied.addEventListener('change', () => {
      activeFilter.hideApplied = toggleApplied.checked;
      localStorage.setItem('hr_pref_hide_applied', String(toggleApplied.checked));
      if (activeTab === 2) renderContent();
      showToast('Live View filter preference saved', 'info');
    });
    rowApplied.appendChild(toggleApplied);
    liveCard.appendChild(rowApplied);

    panel.appendChild(liveCard);

    // 2. Export & Report Settings Card (Non-rules)
    const exportCard = document.createElement('div');
    exportCard.className = 'settings-group-card';
    exportCard.innerHTML = `
      <div class="settings-group-title">
        <span>💾</span> <span>Report Export Options (Non-Rule)</span>
      </div>
    `;

    // Row: Default Export Mode
    const rowExpMode = document.createElement('div');
    rowExpMode.className = 'settings-row';
    rowExpMode.innerHTML = `
      <div class="settings-row-info">
        <span class="settings-row-label">Default Export Generation Mode</span>
        <span class="settings-row-desc">Choose how attendance workbooks are split when clicking Generate & Download</span>
      </div>
    `;
    const selectExpMode = document.createElement('select');
    selectExpMode.className = 'filter-select';
    selectExpMode.style.maxWidth = '220px';
    selectExpMode.innerHTML = `
      <option value="per-group">Separate by Group Code</option>
      <option value="combined">Single Combined Workbook</option>
      <option value="per-source-file">One per Source File</option>
    `;
    selectExpMode.value = exportMode;
    selectExpMode.addEventListener('change', () => {
      exportMode = selectExpMode.value as ExportMode;
      localStorage.setItem('hr_pref_export_mode', exportMode);
      updateExportPreview();
      showToast('Export mode default updated', 'info');
    });
    rowExpMode.appendChild(selectExpMode);
    exportCard.appendChild(rowExpMode);

    panel.appendChild(exportCard);

    // 3. System & Interface Settings
    const uiCard = document.createElement('div');
    uiCard.className = 'settings-group-card';
    uiCard.innerHTML = `
      <div class="settings-group-title">
        <span>🖥️</span> <span>Application & Interface Preferences</span>
      </div>
    `;

    // Row: Live Clock in Header
    const rowClock = document.createElement('div');
    rowClock.className = 'settings-row';
    rowClock.innerHTML = `
      <div class="settings-row-info">
        <span class="settings-row-label">Header Live Clock</span>
        <span class="settings-row-desc">Show real-time digital clock and calendar in the top header</span>
      </div>
    `;
    const toggleClock = document.createElement('input');
    toggleClock.type = 'checkbox';
    toggleClock.checked = localStorage.getItem('hr_pref_show_clock') !== 'false';
    toggleClock.style.transform = 'scale(1.25)';
    toggleClock.addEventListener('change', () => {
      localStorage.setItem('hr_pref_show_clock', String(toggleClock.checked));
      const clockEl = document.getElementById('app-live-clock');
      if (clockEl) clockEl.style.display = toggleClock.checked ? 'inline-flex' : 'none';
      showToast('Clock display preference updated', 'info');
    });
    rowClock.appendChild(toggleClock);
    uiCard.appendChild(rowClock);

    // Row: Reset UI Preferences
    const rowReset = document.createElement('div');
    rowReset.className = 'settings-row';
    rowReset.innerHTML = `
      <div class="settings-row-info">
        <span class="settings-row-label">Reset Preferences</span>
        <span class="settings-row-desc">Restore Live View filters and export settings to defaults</span>
      </div>
    `;
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn-secondary btn-sm';
    resetBtn.textContent = 'Reset Preferences';
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem('hr_pref_hide_resolved');
      localStorage.removeItem('hr_pref_hide_future');
      localStorage.removeItem('hr_pref_hide_applied');
      localStorage.removeItem('hr_pref_export_mode');
      localStorage.removeItem('hr_pref_show_clock');
      activeFilter.hideResolved = true;
      activeFilter.hideFutureShifts = true;
      activeFilter.hideApplied = true;
      exportMode = 'per-group';
      toggleResolved.checked = true;
      toggleFuture.checked = true;
      toggleApplied.checked = true;
      toggleClock.checked = true;
      selectExpMode.value = 'per-group';
      const clockEl = document.getElementById('app-live-clock');
      if (clockEl) clockEl.style.display = 'inline-flex';
      if (activeTab === 2) renderContent();
      showToast('All Live View & UI settings reset to defaults ✅', 'success');
    });
    rowReset.appendChild(resetBtn);
    uiCard.appendChild(rowReset);

    panel.appendChild(uiCard);
    return panel;
  }

  // ── Helper: open settings modal with solid background (no transparency) ──
  function openSettingsModal(initialTab: 'rules' | 'liveview' = 'rules'): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;';

    const modal = document.createElement('div');
    modal.className = 'modal-card';
    modal.style.cssText = 'background:var(--bg-panel, #12161F);color:var(--text-primary, #F5F1E6);border:1px solid var(--border-hairline, #2A2F3D);border-radius:var(--radius-xl, 16px);max-width:920px;width:100%;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.7);position:relative;';

    // Header with Tabs
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border-hairline);background:var(--bg-panel-raised);flex-wrap:wrap;gap:12px;';

    const tabsWrap = document.createElement('div');
    tabsWrap.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const btnRules = document.createElement('button');
    btnRules.type = 'button';
    btnRules.className = `settings-tab-btn ${initialTab === 'rules' ? 'active' : ''}`;
    btnRules.innerHTML = `<span>⚙️</span> <span>${t('nav.rulesConfig') || 'Rules Configuration'}</span>`;

    const btnLiveView = document.createElement('button');
    btnLiveView.type = 'button';
    btnLiveView.className = `settings-tab-btn ${initialTab === 'liveview' ? 'active' : ''}`;
    btnLiveView.innerHTML = `<span>📊</span> <span>${t('nav.settings') || 'Live View & Preferences'}</span>`;

    tabsWrap.appendChild(btnRules);
    tabsWrap.appendChild(btnLiveView);
    header.appendChild(tabsWrap);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close-btn';
    closeBtn.innerHTML = `${icons.x || '✕'} <span style="margin-left:4px;font-size:0.85rem;">Close</span>`;
    closeBtn.addEventListener('click', () => overlay.remove());
    header.appendChild(closeBtn);

    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.cssText = 'padding:20px;overflow-y:auto;flex:1;background:var(--bg-panel, #12161F);';
    modal.appendChild(body);

    function showTab(tab: 'rules' | 'liveview'): void {
      body.innerHTML = '';
      if (tab === 'rules') {
        btnRules.classList.add('active');
        btnLiveView.classList.remove('active');
        body.appendChild(buildRulesConfigPanel());
      } else {
        btnLiveView.classList.add('active');
        btnRules.classList.remove('active');
        body.appendChild(buildLiveViewSettingsPanel());
      }
    }

    btnRules.addEventListener('click', () => showTab('rules'));
    btnLiveView.addEventListener('click', () => showTab('liveview'));

    showTab(initialTab);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // ── Helper: open rules config modal ──
  function openRulesConfigModal(): void {
    openSettingsModal('rules');
  }

  const pageWrapper = document.createElement('div');
  pageWrapper.className = 'page-wrapper app-shell';
  container.appendChild(pageWrapper);

  // ── Header ──
  const header = document.createElement('header');
  header.className = 'app-header';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'app-header-left';

  const logo = document.createElement('span');
  logo.className = 'app-header-logo';
  logo.setAttribute('data-i18n', 'app.shortTitle');
  logo.textContent = t('app.shortTitle');
  headerLeft.appendChild(logo);

  const divider = document.createElement('div');
  divider.className = 'app-header-divider';
  headerLeft.appendChild(divider);

  const appTitleEl = document.createElement('span');
  appTitleEl.className = 'app-header-title';
  appTitleEl.setAttribute('data-i18n', 'app.title');
  appTitleEl.textContent = t('app.title');
  headerLeft.appendChild(appTitleEl);

  header.appendChild(headerLeft);

  // ── Header Right: Live Clock & Impact Download Button ──
  const headerRight = document.createElement('div');
  headerRight.className = 'app-header-right';

  const versionBadge = document.createElement('span');
  versionBadge.className = 'app-version-badge';
  versionBadge.textContent = `v${appConfig?.version || '1.0.0'}`;
  headerRight.appendChild(versionBadge);

  const clockEl = document.createElement('div');
  clockEl.className = 'app-live-clock';
  clockEl.id = 'app-live-clock';

  const updateClock = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' });
    clockEl.innerHTML = `<span class="clock-icon">${icons.calendar || '🕒'}</span> <span class="clock-time">${timeStr}</span> <span class="clock-date">${dateStr}</span>`;
  };
  updateClock();
  const clockInterval = setInterval(updateClock, 1000);
  headerRight.appendChild(clockEl);

  // Glowing circle/pill impact Generate & Download button in top right header
  const headerDownloadBtn = document.createElement('button');
  headerDownloadBtn.type = 'button';
  headerDownloadBtn.className = 'header-download-btn';
  headerDownloadBtn.id = 'header-download-btn';
  headerDownloadBtn.title = 'Generate & Download Attendance Report';
  headerDownloadBtn.innerHTML = `${icons.download} <span data-i18n="export.generate">${t('export.generate')}</span>`;
  headerDownloadBtn.addEventListener('click', () => {
    doExport(headerDownloadBtn);
  });
  headerRight.appendChild(headerDownloadBtn);

  header.appendChild(headerRight);
  pageWrapper.appendChild(header);

  // ── Body: sidebar + content ──
  const body = document.createElement('div');
  body.className = 'app-body';
  pageWrapper.appendChild(body);

  // ── Sidebar ──
  const sidebar = document.createElement('aside');
  sidebar.className = 'app-sidebar';
  sidebar.id = 'app-sidebar';

  const SIDEBAR_COLLAPSED_KEY = 'hr_portal_sidebar_collapsed';
  let isSidebarCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';

  const collapseRow = document.createElement('div');
  collapseRow.className = 'sidebar-collapse-row';
  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'sidebar-collapse-btn';
  collapseBtn.type = 'button';
  collapseBtn.title = isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
  collapseBtn.setAttribute('aria-label', collapseBtn.title);
  collapseBtn.innerHTML = icons.panelLeft;
  collapseBtn.addEventListener('click', () => {
    isSidebarCollapsed = !isSidebarCollapsed;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
    sidebar.classList.toggle('collapsed', isSidebarCollapsed);
    collapseBtn.title = isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
  });
  collapseRow.appendChild(collapseBtn);
  sidebar.appendChild(collapseRow);

  if (isSidebarCollapsed) {
    sidebar.classList.add('collapsed');
  }

  // Profile card with i18n
  const profileCard = document.createElement('div');
  profileCard.className = 'sidebar-profile';
  profileCard.innerHTML = `
    <div class="sidebar-profile-avatar">${icons.user}</div>
    <div class="sidebar-profile-info">
      <div class="sidebar-profile-name">${session.displayName}</div>
      <div class="sidebar-profile-role" data-i18n="nav.role">${t('nav.role') || 'HR Staff'}</div>
    </div>
  `;
  sidebar.appendChild(profileCard);

  const sidebarDivider = () => {
    const d = document.createElement('div');
    d.className = 'sidebar-section-divider';
    return d;
  };

  sidebar.appendChild(sidebarDivider());

  // Theme switcher in sidebar with i18n
  const themeRow = document.createElement('div');
  themeRow.className = 'sidebar-control-row';
  const themeLabel = document.createElement('span');
  themeLabel.className = 'sidebar-control-label';
  themeLabel.setAttribute('data-i18n', 'nav.theme');
  themeLabel.textContent = t('nav.theme') || 'Theme';
  themeRow.appendChild(themeLabel);
  themeRow.appendChild(buildThemeSwitcher(getTheme, (th) => setTheme(th)));
  sidebar.appendChild(themeRow);

  // Language switcher in sidebar with i18n
  const langRow = document.createElement('div');
  langRow.className = 'sidebar-control-row';
  const langLabel = document.createElement('span');
  langLabel.className = 'sidebar-control-label';
  langLabel.setAttribute('data-i18n', 'nav.language');
  langLabel.textContent = t('nav.language') || 'Language';
  langRow.appendChild(langLabel);
  langRow.appendChild(buildSidebarLangSwitcher(getLocale, (l) => { setLocale(l); applyAll(); }));
  sidebar.appendChild(langRow);

  sidebar.appendChild(sidebarDivider());

  // Help button
  const helpBtn = document.createElement('button');
  helpBtn.className = 'sidebar-action-btn';
  helpBtn.innerHTML = `${icons.helpCircle} <span data-i18n="nav.help">${t('nav.help') || 'Help & Rules'}</span>`;
  helpBtn.addEventListener('click', () => {
    document.body.appendChild(buildHelpModal(appConfig?.resources));
  });
  sidebar.appendChild(helpBtn);

  // Rules Configuration button in sidebar (between Help and Logout)
  const rulesConfigBtn = document.createElement('button');
  rulesConfigBtn.className = 'sidebar-action-btn';
  rulesConfigBtn.innerHTML = `${icons.settings || '⚙'} <span data-i18n="nav.settings">${t('nav.settings') || 'Settings'}</span>`;
  rulesConfigBtn.addEventListener('click', () => {
    openRulesConfigModal();
  });
  sidebar.appendChild(rulesConfigBtn);

  sidebar.appendChild(sidebarDivider());

  // Logout button
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'sidebar-action-btn sidebar-logout-btn';
  logoutBtn.innerHTML = `${icons.logOut} <span>${t('nav.logout')}</span>`;
  logoutBtn.addEventListener('click', () => {
    clearInterval(clockInterval);
    clearSession();
    renderLogin(container);
  });
  sidebar.appendChild(logoutBtn);

  body.appendChild(sidebar);

  // ── Content area ──
  const contentWrap = document.createElement('div');
  contentWrap.className = 'app-content-wrap';
  body.appendChild(contentWrap);

  // Auto-fold the sidebar when clicking on the right side / content area
  contentWrap.addEventListener('click', () => {
    if (!isSidebarCollapsed) {
      isSidebarCollapsed = true;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
      sidebar.classList.add('collapsed');
      collapseBtn.title = 'Expand sidebar';
    }
  });

  // ── Tab bar (2 tabs: 1. Upload Files, 2. Live Preview & Export) ──
  let activeTab: 1 | 2 = 1;

  const tabBar = document.createElement('div');
  tabBar.className = 'app-tab-bar';

  const tabs: { id: 1 | 2; labelKey: string; icon: string }[] = [
    { id: 1, labelKey: 'upload.heading', icon: icons.uploadCloud },
    { id: 2, labelKey: 'preview.heading', icon: icons.fileSpreadsheet },
  ];

  function renderTabs(): void {
    tabBar.innerHTML = '';
    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.className = `app-tab-btn${activeTab === tab.id ? ' active' : ''}`;
      btn.type = 'button';
      btn.innerHTML = `<span class="app-tab-icon">${tab.icon}</span><span class="app-tab-label" data-i18n="${tab.labelKey}">${t(tab.labelKey) || tab.labelKey}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        activeTab = tab.id;
        renderTabs();
        renderContent();
      });
      tabBar.appendChild(btn);
    }
  }

  contentWrap.appendChild(tabBar);

  // ── Content panel ──
  const contentPanel = document.createElement('main');
  contentPanel.className = 'app-content-panel';
  contentWrap.appendChild(contentPanel);

  // ── Section builder helpers ──
  function sectionCard(badge: string, titleKey: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'section-card';
    const hdr = document.createElement('div');
    hdr.className = 'section-header';
    const badgeEl = document.createElement('span');
    badgeEl.className = 'section-badge';
    badgeEl.textContent = badge;
    const titleEl = document.createElement('h2');
    titleEl.className = 'section-title';
    titleEl.setAttribute('data-i18n', titleKey);
    titleEl.textContent = t(titleKey);
    hdr.appendChild(badgeEl);
    hdr.appendChild(titleEl);
    card.appendChild(hdr);
    return card;
  }

  // ── TAB 1: Upload Files (Includes Groups, Export Mode, Rules) ──
  function buildUploadSection(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-5);';

    // 1: Upload files
    const uploadCard = sectionCard('1', 'upload.heading');

    const zone = document.createElement('div');
    zone.className = 'upload-zone';
    zone.id = 'upload-zone';
    zone.setAttribute('role', 'button');
    zone.setAttribute('tabindex', '0');
    zone.setAttribute('aria-label', t('upload.dropHint'));

    const zoneIcon = document.createElement('div');
    zoneIcon.className = 'upload-zone-icon';
    zoneIcon.innerHTML = icons.uploadCloud;
    zone.appendChild(zoneIcon);

    const hint = document.createElement('div');
    hint.className = 'upload-zone-hint';
    hint.setAttribute('data-i18n', 'upload.dropHint');
    hint.textContent = t('upload.dropHint');
    zone.appendChild(hint);

    const sub = document.createElement('div');
    sub.className = 'upload-zone-sub';
    sub.setAttribute('data-i18n', 'upload.dropHintSub');
    sub.textContent = t('upload.dropHintSub');
    zone.appendChild(sub);

    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.multiple = true; fileInput.accept = '.xls,.xlsx';
    fileInput.className = 'sr-only'; fileInput.id = 'file-input';
    fileInput.setAttribute('aria-label', t('upload.dropHint'));
    uploadCard.appendChild(fileInput);

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer?.files ?? []).filter(
        (f) => f.name.endsWith('.xls') || f.name.endsWith('.xlsx')
      );
      if (files.length) addFiles(files);
    });
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files ?? []);
      if (files.length) { addFiles(files); fileInput.value = ''; }
    });

    uploadCard.appendChild(zone);
    uploadCard.appendChild(buildFileChips(uploadedFiles, (file) => {
      uploadedFiles = uploadedFiles.filter((f) => f !== file);
      processFiles();
    }));

    if (allRows.length > 0) {
      const summary = document.createElement('div');
      summary.className = 'parse-summary';
      const rowStat = document.createElement('div');
      rowStat.className = 'parse-summary-stat';
      rowStat.innerHTML = `<span class="parse-summary-number">${allRows.length}</span> <span data-i18n="upload.totalRows">${t('upload.totalRows')}</span>`;
      summary.appendChild(rowStat);
      const fileStat = document.createElement('div');
      fileStat.className = 'parse-summary-stat';
      fileStat.innerHTML = `<span data-i18n="upload.parsedFrom">${t('upload.parsedFrom')}</span> <span class="parse-summary-number">${uploadedFiles.length}</span> <span data-i18n="upload.files">${t('upload.files')}</span>`;
      summary.appendChild(fileStat);
      uploadCard.appendChild(summary);
    }

    wrap.appendChild(uploadCard);

    // If files are uploaded, auto-show the next steps
    if (uploadedFiles.length > 0) {
      // Step 2: Group Code and Export Mode (horizontal layout, equal boxes)
      const step2Row = document.createElement('div');
      step2Row.style.cssText = 'display:flex;gap:var(--space-5);align-items:stretch;';
      
      const groupCard = sectionCard('2', 'groups.heading');
      groupCard.style.flex = '1';
      groupCard.appendChild(
        buildGroupChecklist(getGroups(), selectedGroups, (newSet) => {
          selectedGroups = newSet;
          updateExportPreview();
        })
      );
      step2Row.appendChild(groupCard);

      const modeCard = sectionCard('2', 'export.heading');
      modeCard.style.flex = '1';
      modeCard.appendChild(
        buildExportModeCards(exportMode, (mode) => {
          exportMode = mode;
          updateExportPreview();
        })
      );
      step2Row.appendChild(modeCard);

      wrap.appendChild(step2Row);

      // Pre-configure in Configs tab banner
      const configBanner = document.createElement('div');
      configBanner.className = 'upload-configs-banner';
      configBanner.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:var(--bg-elevated);border:1px solid var(--border-hairline);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);margin-top:var(--space-3);';
      configBanner.innerHTML = `
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <span style="color:var(--accent-gold);display:inline-flex;">${icons.settings}</span>
          <div>
            <div style="font-weight:600;font-size:0.88rem;">Pre-configure Shifts & Remarks</div>
            <div style="color:var(--text-muted);font-size:0.75rem;">Adjust shift schedules, lunch breaks, and remark rules in the Configs tab</div>
          </div>
        </div>
      `;
      const gotoConfigBtn = document.createElement('button');
      gotoConfigBtn.type = 'button';
      gotoConfigBtn.className = 'btn btn-secondary btn-sm';
      gotoConfigBtn.innerHTML = `Open Configs &rarr;`;
      gotoConfigBtn.addEventListener('click', () => {
        openSettingsModal('rules');
      });
      configBanner.appendChild(gotoConfigBtn);
      wrap.appendChild(configBanner);
    }

    return wrap;
  }

  function buildRulesConfigPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'rules-config-panel';

    const inputs: Record<string, HTMLInputElement> = {};

    const reapplyRulesAndRefresh = () => {
      localStorage.setItem('hr_portal_rules_config', JSON.stringify(rulesConfig));
      if (allRows.length > 0) {
        applyRemarks(allRows, undefined, rulesConfig);
        updateExportPreview();
        if (activeTab === 2) {
          renderContent();
        }
      }
    };

    const field = (
      key: 'graceMinutes' | 'earlyOutGraceMinutes' | 'otThresholdMinutes' | 'remarkLateSuffix' | 'remarkNoRecord' | 'remarkLeaveApplied' | 'remarkNoCheckout' | 'remarkNoCheckin' | 'remarkNightShift' | 'remarkOtSuffix' | 'remarkOtApplied',
      id: string,
      labelText: string,
      type: 'text' | 'number' = 'text'
    ): HTMLElement => {
      const g = document.createElement('div');
      g.className = 'form-group';
      const lbl = document.createElement('label');
      lbl.className = 'form-label';
      lbl.setAttribute('for', id);
      lbl.textContent = labelText;

      const inp = document.createElement('input');
      inp.type = type;
      inp.id = id;
      inp.className = 'form-input rules-input';
      inp.value = String(rulesConfig[key] ?? '');
      if (type === 'number') {
        inp.min = '0';
        inp.max = '120';
      }
      inputs[key] = inp;

      const updateVal = () => {
        const v = inp.value.trim();
        if (key === 'graceMinutes') {
          rulesConfig.graceMinutes = Math.max(0, parseInt(v, 10) || 0);
        } else if (key === 'earlyOutGraceMinutes') {
          rulesConfig.earlyOutGraceMinutes = Math.max(0, parseInt(v, 10) || 0);
        } else if (key === 'otThresholdMinutes') {
          rulesConfig.otThresholdMinutes = Math.max(0, parseInt(v, 10) || 0);
        } else {
          (rulesConfig as any)[key] = v;
        }
        reapplyRulesAndRefresh();
      };

      inp.addEventListener('input', updateVal);
      inp.addEventListener('change', updateVal);

      g.appendChild(lbl);
      g.appendChild(inp);
      return g;
    };

    // General thresholds & remarks grid
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:var(--space-3);margin-bottom:var(--space-4);';
    grid.appendChild(field('graceMinutes', 'rule-grace', t('settings.rulesGrace') || 'Check-in Grace (Minutes)', 'number'));
    grid.appendChild(field('earlyOutGraceMinutes', 'rule-early-grace', t('settings.rulesEarlyGrace') || 'Early Out Grace (Minutes)', 'number'));
    grid.appendChild(field('otThresholdMinutes', 'rule-ot-threshold', t('settings.rulesOtThreshold') || 'OT Threshold (Minutes past end)', 'number'));
    grid.appendChild(field('remarkLateSuffix', 'rule-late', t('settings.rulesLateLabel') || 'Leave Needed Suffix (ခွင့်တိုင်ရန်)'));
    grid.appendChild(field('remarkLeaveApplied', 'rule-leave-applied', t('settings.rulesLeaveApplied') || 'Leave Done Suffix (ခွင့်တိုင်ပြီး)'));
    grid.appendChild(field('remarkOtSuffix', 'rule-ot-suffix', t('settings.rulesOtSuffix') || 'OT Needed Suffix (အိုတီတင်ရန်)'));
    grid.appendChild(field('remarkOtApplied', 'rule-ot-applied', t('settings.rulesOtApplied') || 'OT Done Suffix (အိုတီတင်ပြီး)'));
    grid.appendChild(field('remarkNoRecord', 'rule-no-record', t('settings.rulesNoRecord') || 'No Record Remark'));
    grid.appendChild(field('remarkNoCheckout', 'rule-no-checkout', t('settings.rulesNoCheckout') || 'No Checkout Remark'));
    grid.appendChild(field('remarkNoCheckin', 'rule-no-checkin', t('settings.rulesNoCheckin') || 'No Checkin Remark'));
    grid.appendChild(field('remarkNightShift', 'rule-night-shift', t('settings.rulesNightShift') || 'Night Shift Remark'));
    panel.appendChild(grid);

    // Shift Schedule Section
    const shiftSec = document.createElement('div');
    shiftSec.className = 'shift-config-container';

    const shiftHeader = document.createElement('div');
    shiftHeader.className = 'shift-config-header';

    const shiftTitle = document.createElement('div');
    shiftTitle.className = 'shift-config-title';
    shiftTitle.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;">${icons.calendar || '📅'} <span>Shift Schedules (Matched by Excel "Class" Column)</span></span>`;
    shiftHeader.appendChild(shiftTitle);

    const shiftActions = document.createElement('div');
    shiftActions.style.cssText = 'display:flex;align-items:center;gap:var(--space-2);margin-left:auto;';

    const addShiftBtn = document.createElement('button');
    addShiftBtn.type = 'button';
    addShiftBtn.className = 'btn btn-secondary btn-sm';
    addShiftBtn.innerHTML = `+ Add Shift`;
    addShiftBtn.addEventListener('click', () => {
      const newShiftNo = prompt('Enter Shift No / Class (e.g. 99):');
      if (!newShiftNo) return;
      rulesConfig.shifts.push({
        shiftNo: newShiftNo.trim(),
        shiftName: 'Custom Shift',
        startTime: '07:00',
        lunchTime: '11:30~12:30',
        endTime: '16:00',
      });
      rebuildShiftTable();
      reapplyRulesAndRefresh();
      showToast(`Shift ${newShiftNo} added`, 'success');
    });
    shiftActions.appendChild(addShiftBtn);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn-secondary btn-sm';
    resetBtn.innerHTML = `${icons.rotateCcw} <span>Reset Defaults</span>`;
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all shift schedules and remark rules to factory defaults?')) {
        localStorage.removeItem('hr_portal_rules_config');
        rulesConfig = JSON.parse(JSON.stringify(defaultRulesConfig));
        reapplyRulesAndRefresh();
        renderContent();
        showToast('Reset to default configurations', 'info');
      }
    });
    shiftActions.appendChild(resetBtn);

    shiftHeader.appendChild(shiftActions);
    shiftSec.appendChild(shiftHeader);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'shift-table-wrap';

    const table = document.createElement('table');
    table.className = 'shift-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Class (Shift No)</th>
          <th>Shift Name</th>
          <th>Start Time</th>
          <th>Lunch Time</th>
          <th>Get Off Work</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody')!;

    const rebuildShiftTable = () => {
      tbody.innerHTML = '';
      rulesConfig.shifts.forEach((s, idx) => {
        const tr = document.createElement('tr');

        // Shift no
        const tdNo = document.createElement('td');
        const inpNo = document.createElement('input');
        inpNo.className = 'shift-input';
        inpNo.value = s.shiftNo;
        inpNo.style.maxWidth = '65px';
        inpNo.addEventListener('change', () => {
          s.shiftNo = inpNo.value.trim();
          reapplyRulesAndRefresh();
        });
        tdNo.appendChild(inpNo);
        tr.appendChild(tdNo);

        // Shift name
        const tdName = document.createElement('td');
        const inpName = document.createElement('input');
        inpName.className = 'shift-input';
        inpName.value = s.shiftName;
        inpName.style.maxWidth = '190px';
        inpName.addEventListener('change', () => {
          s.shiftName = inpName.value.trim();
        });
        tdName.appendChild(inpName);
        tr.appendChild(tdName);

        // Start time
        const tdStart = document.createElement('td');
        const inpStart = document.createElement('input');
        inpStart.className = 'shift-input';
        inpStart.value = s.startTime;
        inpStart.style.maxWidth = '75px';
        inpStart.placeholder = '07:00';
        inpStart.addEventListener('change', () => {
          s.startTime = inpStart.value.trim();
          reapplyRulesAndRefresh();
        });
        tdStart.appendChild(inpStart);
        tr.appendChild(tdStart);

        // Lunch time
        const tdLunch = document.createElement('td');
        const inpLunch = document.createElement('input');
        inpLunch.className = 'shift-input';
        inpLunch.value = s.lunchTime;
        inpLunch.style.maxWidth = '115px';
        inpLunch.placeholder = '11:30~12:30';
        inpLunch.addEventListener('change', () => {
          s.lunchTime = inpLunch.value.trim();
          reapplyRulesAndRefresh();
        });
        tdLunch.appendChild(inpLunch);
        tr.appendChild(tdLunch);

        // End time
        const tdEnd = document.createElement('td');
        const inpEnd = document.createElement('input');
        inpEnd.className = 'shift-input';
        inpEnd.value = s.endTime;
        inpEnd.style.maxWidth = '75px';
        inpEnd.placeholder = '16:00';
        inpEnd.addEventListener('change', () => {
          s.endTime = inpEnd.value.trim();
          reapplyRulesAndRefresh();
        });
        tdEnd.appendChild(inpEnd);
        tr.appendChild(tdEnd);

        // Action: Delete
        const tdAct = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-secondary btn-sm';
        delBtn.style.padding = '2px 8px';
        delBtn.innerHTML = '✕';
        delBtn.title = 'Delete Shift';
        delBtn.addEventListener('click', () => {
          rulesConfig.shifts.splice(idx, 1);
          rebuildShiftTable();
          reapplyRulesAndRefresh();
        });
        tdAct.appendChild(delBtn);
        tr.appendChild(tdAct);

        tbody.appendChild(tr);
      });
    };

    rebuildShiftTable();
    tableWrap.appendChild(table);
    shiftSec.appendChild(tableWrap);
    panel.appendChild(shiftSec);

    // Actions row: Reset to defaults
    const actionsRow = document.createElement('div');
    actionsRow.className = 'rules-actions-row';
    actionsRow.style.marginTop = 'var(--space-4)';

    const resetRulesBtn = document.createElement('button');
    resetRulesBtn.type = 'button';
    resetRulesBtn.className = 'btn btn-secondary btn-sm';
    resetRulesBtn.innerHTML = `${icons.rotateCcw} <span>Reset all rules & shifts to defaults</span>`;
    resetRulesBtn.addEventListener('click', () => {
      rulesConfig = JSON.parse(JSON.stringify(defaultRulesConfig));
      if (inputs.graceMinutes) inputs.graceMinutes.value = String(rulesConfig.graceMinutes);
      if (inputs.earlyOutGraceMinutes) inputs.earlyOutGraceMinutes.value = String(rulesConfig.earlyOutGraceMinutes);
      if (inputs.otThresholdMinutes) inputs.otThresholdMinutes.value = String(rulesConfig.otThresholdMinutes);
      if (inputs.remarkLateSuffix) inputs.remarkLateSuffix.value = rulesConfig.remarkLateSuffix;
      if (inputs.remarkNoRecord) inputs.remarkNoRecord.value = rulesConfig.remarkNoRecord;
      if (inputs.remarkLeaveApplied) inputs.remarkLeaveApplied.value = rulesConfig.remarkLeaveApplied ?? 'ခွင့်တိုင်ပြီး';
      if (inputs.remarkOtSuffix) inputs.remarkOtSuffix.value = rulesConfig.remarkOtSuffix;
      if (inputs.remarkOtApplied) inputs.remarkOtApplied.value = rulesConfig.remarkOtApplied ?? 'အိုတီတင်ပီး';
      if (inputs.remarkNoCheckout) inputs.remarkNoCheckout.value = rulesConfig.remarkNoCheckout;
      if (inputs.remarkNoCheckin) inputs.remarkNoCheckin.value = rulesConfig.remarkNoCheckin;
      if (inputs.remarkNightShift) inputs.remarkNightShift.value = rulesConfig.remarkNightShift;
      rebuildShiftTable();
      reapplyRulesAndRefresh();
      showToast('All rules and shifts reset to defaults ✅', 'success');
    });
    actionsRow.appendChild(resetRulesBtn);

    panel.appendChild(actionsRow);

    const note = document.createElement('p');
    note.className = 'rules-note';
    note.textContent = 'Shift schedule matches the "Class" column in uploaded Excel files. Defaults loaded from rules.json.';
    panel.appendChild(note);

    return panel;
  }

  // ── TAB 2: Configs (Pre-prepare shift rules & remarks anytime) ──
  function buildConfigsSection(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-5);';

    const card = sectionCard('⚙', 'nav.rulesConfig');

    const cardTop = document.createElement('div');
    cardTop.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin:-8px 0 var(--space-4) 0;flex-wrap:wrap;gap:var(--space-2);';

    const subDesc = document.createElement('p');
    subDesc.style.cssText = 'color:var(--text-muted);font-size:0.85rem;margin:0;';
    subDesc.textContent = 'Pre-configure shift working hours, lunch break deductions, grace periods, and Myanmar remark rules before or after uploading.';
    cardTop.appendChild(subDesc);

    card.appendChild(cardTop);
    card.appendChild(buildRulesConfigPanel());
    wrap.appendChild(card);
    return wrap;
  }

  // ── TAB 3: Preview ──
  function buildPreviewSection(): HTMLElement {
    const callbacks = {
      onResetAll: resetAll,
      onDownload: async (btn: HTMLButtonElement) => {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span><span data-i18n="export.generating">${t('export.generating')}</span>`;
        try {
          const exportRows = activeFilter.hideResolved !== false
            ? allRows.filter((r) => !isRowResolved(r))
            : allRows;
          await exportSelection(exportRows, selectedGroups, exportMode, (msg) => showToast(msg, 'info'));
          showToast(t('export.generate') + ' ✅', 'success');
        } catch (e) { showToast(String(e), 'error'); }
        btn.disabled = false;
        btn.innerHTML = `${icons.download} <span data-i18n="export.generate">${t('export.generate')}</span>`;
      }
    };

    const visibleRows = getVisibleRows();
    return buildLivePreviewSection(visibleRows, activeFilter, (f) => { activeFilter = f; }, rulesConfig, callbacks);
  }

  // ── Content render ──
  function renderContent(): void {
    contentPanel.innerHTML = '';

    if (parseErrors.length > 0) contentPanel.appendChild(buildAlertPanel(parseErrors, 'error', 'error.parseTitle'));
    if (parseWarnings.length > 0) contentPanel.appendChild(buildAlertPanel(parseWarnings, 'warning', 'error.warnTitle'));

    if (activeTab === 1) {
      contentPanel.classList.remove('live-view-fullscreen');
      const stepWrap = document.createElement('div');
      stepWrap.className = 'step-process-container';
      stepWrap.appendChild(buildUploadSection());
      contentPanel.appendChild(stepWrap);
    } else if (activeTab === 2) {
      contentPanel.classList.add('live-view-fullscreen');
      contentPanel.appendChild(buildPreviewSection());
    }

    applyAll();
  }

  function rerender(): void {
    renderTabs();
    renderContent();
  }

  function updateExportPreview(): void {
    const info = document.getElementById('export-preview-info');
    const exportRows = activeFilter.hideResolved !== false
      ? allRows.filter((r) => !isRowResolved(r))
      : allRows;
    if (info) info.textContent = buildExportPreviewInfo(exportRows, selectedGroups, exportMode);
  }

  function getGroups(): GroupInfo[] {
    const map = new Map<string, GroupInfo>();
    for (const row of allRows) {
      const ex = map.get(row.groupCode);
      if (ex) { ex.count++; }
      else { map.set(row.groupCode, { code: row.groupCode, name: row.groupName, count: 1 }); }
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  function getVisibleRows(): AttendanceRow[] {
    if (exportMode === 'per-source-file') return allRows;
    return allRows.filter((r) => selectedGroups.has(r.groupCode));
  }

  async function addFiles(files: File[]): Promise<void> {
    const newFiles = files.filter((f) => !uploadedFiles.some((e) => e.name === f.name));
    if (newFiles.length === 0) return;
    uploadedFiles = [...uploadedFiles, ...newFiles];
    await processFiles();
  }

  async function processFiles(): Promise<void> {
    parseErrors = []; parseWarnings = []; allRows = [];
    if (uploadedFiles.length === 0) { selectedGroups = new Set(); rerender(); return; }
    const { rows, errors } = await parseAllFiles(uploadedFiles);
    parseErrors = errors;
    const warnings: string[] = [];
    applyRemarks(rows, (msg) => warnings.push(msg), rulesConfig);
    parseWarnings = warnings;
    allRows = rows.filter((r) => {
      const absentNum = parseFloat(r.absent);
      const otNum = parseFloat(r.overtimeHours);
      return (
        (!isNaN(absentNum) && absentNum > 0) ||
        (!isNaN(otNum) && otNum > 0) ||
        (r.remarks && r.remarks.trim() !== '')
      );
    });
    const groups = getGroups();
    selectedGroups = new Set(groups.map((g) => g.code));
    rerender();
  }

  function resetAll(): void {
    uploadedFiles = []; allRows = []; selectedGroups = new Set();
    exportMode = 'per-group'; parseErrors = []; parseWarnings = [];
    activeFilter = { idNo: '', name: '', groupCode: '', date: '', klass: '', remarks: '', absent: '', overtime: '', hideResolved: true };
    rerender();
  }

  rerender();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;

  setTheme(getTheme());
  initLocale();

  await loadRulesConfig();

  try {
    appConfig = await loadConfig();
    if (appConfig.appTitle) document.title = appConfig.appTitle;
  } catch (e) {
    console.error('Failed to load config.json:', e);
    root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0B0E14;color:#E5555F;font-family:var(--font-ui);text-align:center;padding:40px;">
        <div>
          <h1 style="font-size:1.5rem;margin-bottom:12px;">Configuration Error</h1>
          <p style="color:#A9AFC0;">Could not load <code>config.json</code>. Make sure it exists in the same directory as this page.</p>
          <p style="color:#6B7080;font-size:0.85rem;margin-top:8px;">See <code>config.example.json</code> for the expected format.</p>
        </div>
      </div>
    `;
    return;
  }

  const session = getSession();
  if (session) renderApp(root);
  else renderLogin(root);
}

bootstrap();
