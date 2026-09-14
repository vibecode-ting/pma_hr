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
  REMARK_NO_CHECKOUT,
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
  remarkNoCheckout: REMARK_NO_CHECKOUT,
  remarkOtSuffix: 'hour အိုတီ တင်ရန်',
  shifts: JSON.parse(JSON.stringify(DEFAULT_SHIFTS)),
};
let rulesConfig: RulesConfig = JSON.parse(JSON.stringify(defaultRulesConfig));
let allRows: AttendanceRow[] = [];
let uploadedFiles: File[] = [];
let selectedGroups: Set<string> = new Set();
let exportMode: ExportMode = 'per-group';
let parseErrors: string[] = [];
let parseWarnings: string[] = [];
let activeFilter: LiveFilterState = { idNo: '', name: '', groupCode: '', date: '', klass: '', remarks: '', absent: '', overtime: '' };

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
  appTitle: 'Pouchen Myanmar Adidas B150 | HR-Portal',
  accounts: [
    { username: 'demo', password: 'demo123', displayName: 'Demo User' },
    { username: 'ingyin', password: 'Abc777', displayName: 'HR-Admin Ingyin' },
    { username: 'nweni', password: 'Abc666', displayName: 'HR-Admin Nwe Ni' },
    { username: 'it', password: 'admin', displayName: 'IT-PCB' }
  ],
  resources: [
    { label: 'APP Source Code', url: 'https://examplesourcecode.com' },
    { label: 'Feedback the app', url: 'https://typeform.com' },
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
    const resp2 = await fetch('./config.example.json');
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
        remarkNoCheckout: data.remarkNoCheckout !== undefined ? data.remarkNoCheckout : REMARK_NO_CHECKOUT,
        remarkOtSuffix: data.remarkOtSuffix ?? 'hour အိုတီ တင်ရန်',
        shifts: Array.isArray(data.shifts) && data.shifts.length > 0 ? data.shifts : JSON.parse(JSON.stringify(DEFAULT_SHIFTS)),
      };
      rulesConfig = JSON.parse(JSON.stringify(defaultRulesConfig));
    }
  } catch { /* use defaults */ }
}

// ─── Login page ───────────────────────────────────────────────────────────────

function renderLogin(container: HTMLElement): void {
  container.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'page-wrapper login-split-page';

  // ── Left Hero Panel: Unblurred Background Image & Corporate Branding ──
  const leftPanel = document.createElement('div');
  leftPanel.className = 'login-left-panel';

  const heroImage = document.createElement('div');
  heroImage.className = 'login-hero-image';
  leftPanel.appendChild(heroImage);

  const heroScrim = document.createElement('div');
  heroScrim.className = 'login-hero-scrim';
  leftPanel.appendChild(heroScrim);

  const heroContent = document.createElement('div');
  heroContent.className = 'login-hero-content';

  const heroBadge = document.createElement('div');
  heroBadge.className = 'login-hero-badge';
  const heroLogo = document.createElement('img');
  heroLogo.src = './pouchen_logo.png';
  heroLogo.alt = 'Pouchen Logo';
  heroLogo.className = 'login-hero-logo';
  heroBadge.appendChild(heroLogo);

  const heroCompany = document.createElement('span');
  heroCompany.setAttribute('data-i18n', 'app.company');
  heroCompany.textContent = t('app.company');
  heroBadge.appendChild(heroCompany);
  heroContent.appendChild(heroBadge);

  const heroHeadline = document.createElement('h1');
  heroHeadline.className = 'login-hero-headline';
  heroHeadline.setAttribute('data-i18n', 'app.title');
  heroHeadline.textContent = t('app.title');
  heroContent.appendChild(heroHeadline);

  leftPanel.appendChild(heroContent);
  page.appendChild(leftPanel);

  // ── Right Form Panel: Modern Login Controls & Form ──
  const rightPanel = document.createElement('div');
  rightPanel.className = 'login-right-panel';

  // Panel Top: Brand on mobile + Theme & Language Switchers
  const panelTop = document.createElement('div');
  panelTop.className = 'login-panel-top';

  const mobileBrand = document.createElement('div');
  mobileBrand.className = 'login-panel-brand-mobile';
  const mobileLogo = document.createElement('img');
  mobileLogo.src = './pouchen_logo.png';
  mobileLogo.alt = 'Pouchen Logo';
  mobileBrand.appendChild(mobileLogo);
  const mobileTitle = document.createElement('span');
  mobileTitle.setAttribute('data-i18n', 'app.shortTitle');
  mobileTitle.textContent = t('app.shortTitle');
  mobileBrand.appendChild(mobileTitle);
  panelTop.appendChild(mobileBrand);

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

  // Center Form Container
  const formContainer = document.createElement('div');
  formContainer.className = 'login-form-container';

  const formHeader = document.createElement('div');
  formHeader.className = 'login-form-header';

  const formTag = document.createElement('div');
  formTag.className = 'login-form-tag';
  formTag.setAttribute('data-i18n', 'app.shortTitle');
  formTag.textContent = t('app.shortTitle');
  formHeader.appendChild(formTag);

  const formTitle = document.createElement('h2');
  formTitle.className = 'login-form-title';
  formTitle.setAttribute('data-i18n', 'login.submit');
  formTitle.textContent = t('login.submit');
  formHeader.appendChild(formTitle);

  const formDesc = document.createElement('p');
  formDesc.className = 'login-form-desc';
  formDesc.textContent = 'Enter your credentials to access the attendance system';
  formHeader.appendChild(formDesc);

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

  // ── Header Right: Live Ticking System Clock ──
  const headerRight = document.createElement('div');
  headerRight.className = 'app-header-right';

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

  // Profile card
  const profileCard = document.createElement('div');
  profileCard.className = 'sidebar-profile';
  profileCard.innerHTML = `
    <div class="sidebar-profile-avatar">${icons.user}</div>
    <div class="sidebar-profile-info">
      <div class="sidebar-profile-name">${session.displayName}</div>
      <div class="sidebar-profile-role">HR Staff</div>
    </div>
  `;
  sidebar.appendChild(profileCard);

  const sidebarDivider = () => {
    const d = document.createElement('div');
    d.className = 'sidebar-section-divider';
    return d;
  };

  sidebar.appendChild(sidebarDivider());

  // Theme switcher in sidebar
  const themeRow = document.createElement('div');
  themeRow.className = 'sidebar-control-row';
  const themeLabel = document.createElement('span');
  themeLabel.className = 'sidebar-control-label';
  themeLabel.textContent = 'Theme';
  themeRow.appendChild(themeLabel);
  themeRow.appendChild(buildThemeSwitcher(getTheme, (th) => setTheme(th)));
  sidebar.appendChild(themeRow);

  // Language switcher in sidebar (dropdown when expanded, click-cycle EN >> MY >> ZH when folded)
  const langRow = document.createElement('div');
  langRow.className = 'sidebar-control-row';
  const langLabel = document.createElement('span');
  langLabel.className = 'sidebar-control-label';
  langLabel.textContent = 'Language';
  langRow.appendChild(langLabel);
  langRow.appendChild(buildSidebarLangSwitcher(getLocale, (l) => { setLocale(l); applyAll(); }));
  sidebar.appendChild(langRow);

  sidebar.appendChild(sidebarDivider());

  // Help button
  const helpBtn = document.createElement('button');
  helpBtn.className = 'sidebar-action-btn';
  helpBtn.innerHTML = `${icons.helpCircle} <span>Help & Rules</span>`;
  helpBtn.addEventListener('click', () => {
    document.body.appendChild(buildHelpModal(appConfig?.resources));
  });
  sidebar.appendChild(helpBtn);



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

  // ── Tab bar ──
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
      btn.addEventListener('click', () => {
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

      // Rules Configuration (Optional button with folded animation)
      const rulesWrap = document.createElement('div');
      rulesWrap.className = 'rules-accordion';

      const rulesToggle = document.createElement('button');
      rulesToggle.className = 'btn btn-secondary';
      rulesToggle.style.cssText = 'width:auto;display:inline-flex;margin-top:var(--space-2);';
      rulesToggle.innerHTML = `${icons.settings} <span data-i18n="nav.rulesConfig">${t('nav.rulesConfig') || 'Rules Configuration'}</span> ${icons.chevronDown}`;
      rulesWrap.appendChild(rulesToggle);

      const rulesContent = document.createElement('div');
      rulesContent.style.cssText = 'overflow:hidden;max-height:0;transition:max-height 0.3s ease;margin-top:var(--space-3);';
      
      const rulesCard = sectionCard('⚙', 'nav.rulesConfig');
      rulesCard.appendChild(buildRulesConfigPanel());
      rulesContent.appendChild(rulesCard);
      rulesWrap.appendChild(rulesContent);

      let rulesOpen = false;
      rulesToggle.addEventListener('click', () => {
        rulesOpen = !rulesOpen;
        if (rulesOpen) {
          rulesContent.style.maxHeight = '3000px';
          rulesToggle.innerHTML = `${icons.settings} <span data-i18n="nav.rulesConfig">${t('nav.rulesConfig') || 'Rules Configuration'}</span> ${icons.chevronUp}`;
        } else {
          rulesContent.style.maxHeight = '0';
          rulesToggle.innerHTML = `${icons.settings} <span data-i18n="nav.rulesConfig">${t('nav.rulesConfig') || 'Rules Configuration'}</span> ${icons.chevronDown}`;
        }
      });

      wrap.appendChild(rulesWrap);
    }

    return wrap;
  }

  function buildRulesConfigPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'rules-config-panel';

    const inputs: Record<string, HTMLInputElement> = {};

    const reapplyRulesAndRefresh = () => {
      if (allRows.length > 0) {
        applyRemarks(allRows, undefined, rulesConfig);
        updateExportPreview();
      }
    };

    const field = (
      key: 'graceMinutes' | 'earlyOutGraceMinutes' | 'otThresholdMinutes' | 'remarkLateSuffix' | 'remarkNoRecord' | 'remarkNoCheckout' | 'remarkOtSuffix',
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
          rulesConfig[key] = v;
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
    grid.appendChild(field('graceMinutes', 'rule-grace', 'Check-in Grace (Minutes)', 'number'));
    grid.appendChild(field('earlyOutGraceMinutes', 'rule-early-grace', 'Early Out Grace (Minutes)', 'number'));
    grid.appendChild(field('otThresholdMinutes', 'rule-ot-threshold', 'OT Threshold (Minutes past end)', 'number'));
    grid.appendChild(field('remarkLateSuffix', 'rule-late', 'Late Check-in Suffix'));
    grid.appendChild(field('remarkNoRecord', 'rule-norecord', 'No Punch / Absent Remark'));
    grid.appendChild(field('remarkNoCheckout', 'rule-nocheckout', 'Missing Checkout Remark (Past Dates)'));
    grid.appendChild(field('remarkOtSuffix', 'rule-ot-suffix', 'Overtime Remark Suffix (အိုတီတင်ရန်)'));
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
    shiftHeader.appendChild(addShiftBtn);
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
      if (inputs.remarkNoCheckout) inputs.remarkNoCheckout.value = rulesConfig.remarkNoCheckout;
      if (inputs.remarkOtSuffix) inputs.remarkOtSuffix.value = rulesConfig.remarkOtSuffix;
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

  // ── TAB 2: Preview ──
  function buildPreviewSection(): HTMLElement {
    const callbacks = {
      onResetAll: resetAll,
      onDownload: async (btn: HTMLButtonElement) => {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span><span data-i18n="export.generating">${t('export.generating')}</span>`;
        try {
          await exportSelection(allRows, selectedGroups, exportMode, (msg) => showToast(msg, 'info'));
          showToast(t('export.generate') + ' ✅', 'success');
        } catch (e) { showToast(String(e), 'error'); }
        btn.disabled = false;
        btn.innerHTML = `${icons.download} <span data-i18n="export.generate">${t('export.generate')}</span>`;
      }
    };

    const visibleRows = getVisibleRows();
    return buildLivePreviewSection(visibleRows, activeFilter, (f) => { activeFilter = f; }, callbacks);
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
    if (info) info.textContent = buildExportPreviewInfo(allRows, selectedGroups, exportMode);
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
    activeFilter = { idNo: '', name: '', groupCode: '', date: '', klass: '', remarks: '', absent: '', overtime: '' };
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
