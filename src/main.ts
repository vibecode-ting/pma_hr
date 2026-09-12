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
import { applyRemarks } from './rules';
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
  graceMinutes: 10,
  remarkLateSuffix: 'ခွင့်တိုင်ရန်။',
  remarkNoRecord: 'တိုင်းကာဒ်မရှိပါ။',
  remarkNoCheckout: 'အထွက်တိုင်းကာဒ်မရှိပါ။',
};
let rulesConfig: RulesConfig = { ...defaultRulesConfig };
let allRows: AttendanceRow[] = [];
let uploadedFiles: File[] = [];
let selectedGroups: Set<string> = new Set();
let exportMode: ExportMode = 'combined';
let parseErrors: string[] = [];
let parseWarnings: string[] = [];
let activeFilter: LiveFilterState = { idNo: '', groupCode: '', date: '', remarks: '' };

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

async function loadConfig(): Promise<AppConfig> {
  const resp = await fetch('./config.json');
  if (!resp.ok) throw new Error(`config.json fetch failed: ${resp.status}`);
  return resp.json() as Promise<AppConfig>;
}

async function loadRulesConfig(): Promise<void> {
  try {
    const resp = await fetch('./rules.json');
    if (resp.ok) {
      const data = await resp.json() as Partial<RulesConfig>;
      defaultRulesConfig = {
        graceMinutes: typeof data.graceMinutes === 'number' ? data.graceMinutes : 10,
        remarkLateSuffix: data.remarkLateSuffix ?? data.remarkLate ?? 'ခွင့်တိုင်ရန်။',
        remarkNoRecord: data.remarkNoRecord ?? 'တိုင်းကာဒ်မရှိပါ။',
        remarkNoCheckout: data.remarkNoCheckout ?? 'အထွက်တိုင်းကာဒ်မရှိပါ။',
      };
      rulesConfig = { ...defaultRulesConfig };
    }
  } catch { /* use defaults */ }
}

// ─── Login page ───────────────────────────────────────────────────────────────

function renderLogin(container: HTMLElement): void {
  container.innerHTML = '';
  container.appendChild(createStarfield());

  const page = document.createElement('div');
  page.className = 'page-wrapper login-page';

  // ── Floating Top Controls: Theme & Language Switchers ──
  const topControls = document.createElement('div');
  topControls.className = 'login-top-controls';

  topControls.appendChild(buildThemeSwitcher(getTheme, (th) => setTheme(th)));

  const divider = document.createElement('div');
  divider.className = 'login-ctrl-divider';
  topControls.appendChild(divider);

  topControls.appendChild(buildLangSwitcher(getLocale, (l) => { setLocale(l); applyAll(); }));
  page.appendChild(topControls);

  // ── Two-Column Login Container ──
  const splitCard = document.createElement('div');
  splitCard.className = 'login-split-card';

  // ── Left Column: Hero Pane with background image, glassy overlay, and logo ──
  const heroPane = document.createElement('div');
  heroPane.className = 'login-hero-pane';

  const heroBg = document.createElement('div');
  heroBg.className = 'login-hero-bg';
  heroPane.appendChild(heroBg);

  const heroOverlay = document.createElement('div');
  heroOverlay.className = 'login-hero-overlay';

  const logoContainer = document.createElement('div');
  logoContainer.className = 'login-logo-container';
  const brandLogo = document.createElement('img');
  brandLogo.src = './pouchen_logo.png';
  brandLogo.alt = 'Pouchen Logo';
  brandLogo.className = 'login-brand-logo';
  logoContainer.appendChild(brandLogo);
  heroOverlay.appendChild(logoContainer);

  const heroText = document.createElement('div');
  heroText.className = 'login-hero-text';

  const companyEl = document.createElement('div');
  companyEl.className = 'login-company-name';
  companyEl.setAttribute('data-i18n', 'app.company');
  companyEl.textContent = t('app.company');
  heroText.appendChild(companyEl);

  const heroBrand = document.createElement('div');
  heroBrand.className = 'login-hero-brand';
  heroBrand.setAttribute('data-i18n', 'app.shortTitle');
  heroBrand.textContent = t('app.shortTitle');
  heroText.appendChild(heroBrand);

  const portalTitle = document.createElement('h1');
  portalTitle.className = 'login-portal-title';
  portalTitle.setAttribute('data-i18n', 'app.title');
  portalTitle.textContent = t('app.title');
  heroText.appendChild(portalTitle);

  const subtitle = document.createElement('div');
  subtitle.className = 'login-subtitle text-secondary';
  subtitle.setAttribute('data-i18n', 'login.subtitle');
  subtitle.textContent = t('login.subtitle');
  heroText.appendChild(subtitle);

  heroOverlay.appendChild(heroText);
  heroPane.appendChild(heroOverlay);
  splitCard.appendChild(heroPane);

  // ── Right Column: Form Pane ──
  const formPane = document.createElement('div');
  formPane.className = 'login-form-pane';

  const formInner = document.createElement('div');
  formInner.className = 'login-form-inner';

  const formHeader = document.createElement('div');
  formHeader.className = 'login-form-header';

  const formTitle = document.createElement('h2');
  formTitle.className = 'login-form-title';
  formTitle.setAttribute('data-i18n', 'login.submit');
  formTitle.textContent = t('login.submit');
  formHeader.appendChild(formTitle);

  const formSub = document.createElement('p');
  formSub.className = 'login-form-sub';
  formSub.setAttribute('data-i18n', 'login.subtitle');
  formSub.textContent = t('login.subtitle');
  formHeader.appendChild(formSub);

  formInner.appendChild(formHeader);

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
  formInner.appendChild(userGroup);

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
  formInner.appendChild(passGroup);

  const errorEl = document.createElement('div');
  errorEl.className = 'form-error hidden';
  errorEl.id = 'login-error';
  errorEl.innerHTML = icons.alertTriangle;
  const errorText = document.createElement('span');
  errorText.setAttribute('data-i18n', 'login.error');
  errorText.textContent = t('login.error');
  errorEl.appendChild(errorText);
  formInner.appendChild(errorEl);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit'; submitBtn.id = 'login-submit';
  submitBtn.className = 'btn btn-primary btn-full';
  submitBtn.style.marginTop = '8px';
  submitBtn.setAttribute('data-i18n', 'login.submit');
  submitBtn.textContent = t('login.submit');
  formInner.appendChild(submitBtn);

  formPane.appendChild(formInner);
  splitCard.appendChild(formPane);

  page.appendChild(splitCard);

  // ── Footer: Copyright + Developer credits ──
  const footer = document.createElement('footer');
  footer.className = 'login-footer';

  const footerLine1 = document.createElement('div');
  footerLine1.className = 'login-footer-line';
  footerLine1.textContent = '© Pouchen Myanmar Adidas B150 — Internal Use Only';
  
  const footerLine2 = document.createElement('div');
  footerLine2.className = 'login-footer-line';
  footerLine2.innerHTML = `© Developed by <a href="mailto:ting.hah@pouchen.com.mm" class="credit-link">ting | Htet Aung Hlaing</a> | <a href="mailto:mpc.erp@pouchen.com.mm" class="credit-link">MM PCB IT Team</a>`;

  footer.appendChild(footerLine1);
  footer.appendChild(footerLine2);

  page.appendChild(footer);
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
  logoutBtn.addEventListener('click', () => { clearSession(); renderLogin(container); });
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
          rulesContent.style.maxHeight = '800px';
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

    const field = (
      key: 'graceMinutes' | 'remarkLateSuffix' | 'remarkNoRecord' | 'remarkNoCheckout',
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
      inp.value = String(rulesConfig[key]);
      if (type === 'number') {
        inp.min = '0';
        inp.max = '120';
      }
      inputs[key] = inp;

      const updateVal = () => {
        const v = inp.value.trim();
        if (key === 'graceMinutes') {
          rulesConfig.graceMinutes = Math.max(0, parseInt(v, 10) || 0);
        } else {
          rulesConfig[key] = v;
        }
        if (allRows.length > 0) {
          applyRemarks(allRows, undefined, rulesConfig);
          updateExportPreview();
        }
      };

      inp.addEventListener('input', updateVal);
      inp.addEventListener('change', updateVal);

      g.appendChild(lbl);
      g.appendChild(inp);
      return g;
    };

    panel.appendChild(field('graceMinutes', 'rule-grace', 'Grace Period (minutes)', 'number'));
    panel.appendChild(field('remarkLateSuffix', 'rule-late', 'Late Check-in Remark (Myanmar / Unicode)'));
    panel.appendChild(field('remarkNoRecord', 'rule-norecord', 'No Record Remark (Myanmar / Unicode)'));
    panel.appendChild(field('remarkNoCheckout', 'rule-nocheckout', 'No Check-out Remark (Myanmar / Unicode)'));

    const actionsRow = document.createElement('div');
    actionsRow.className = 'rules-actions-row';

    const resetRulesBtn = document.createElement('button');
    resetRulesBtn.type = 'button';
    resetRulesBtn.className = 'btn btn-secondary btn-sm';
    resetRulesBtn.innerHTML = `${icons.rotateCcw} <span>Reset to defaults</span>`;
    resetRulesBtn.addEventListener('click', () => {
      rulesConfig = { ...defaultRulesConfig };
      if (inputs.graceMinutes) inputs.graceMinutes.value = String(rulesConfig.graceMinutes);
      if (inputs.remarkLateSuffix) inputs.remarkLateSuffix.value = rulesConfig.remarkLateSuffix;
      if (inputs.remarkNoRecord) inputs.remarkNoRecord.value = rulesConfig.remarkNoRecord;
      if (inputs.remarkNoCheckout) inputs.remarkNoCheckout.value = rulesConfig.remarkNoCheckout;
      if (allRows.length > 0) {
        applyRemarks(allRows, undefined, rulesConfig);
        updateExportPreview();
      }
      showToast('Rules reset to defaults ✅', 'success');
    });
    actionsRow.appendChild(resetRulesBtn);

    panel.appendChild(actionsRow);

    const note = document.createElement('p');
    note.className = 'rules-note';
    note.textContent = 'Myanmar text must be Unicode (Noto Sans Myanmar). Defaults loaded from rules.json.';
    panel.appendChild(note);

    return panel;
  }

  // ── TAB 2: Preview ──
  function buildPreviewSection(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'preview-wrap';
    
    // Create callbacks to handle actions from the filter panel
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

    const previewCard = sectionCard('👁', 'preview.heading');
    previewCard.style.width = '100%';
    previewCard.style.maxWidth = '100%';
    
    const visibleRows = getVisibleRows();
    previewCard.appendChild(
      buildLivePreviewSection(visibleRows, activeFilter, (f) => { activeFilter = f; }, callbacks)
    );
    wrap.appendChild(previewCard);

    return wrap;
  }

  // ── Content render ──
  function renderContent(): void {
    contentPanel.innerHTML = '';

    if (parseErrors.length > 0) contentPanel.appendChild(buildAlertPanel(parseErrors, 'error', 'error.parseTitle'));
    if (parseWarnings.length > 0) contentPanel.appendChild(buildAlertPanel(parseWarnings, 'warning', 'error.warnTitle'));

    const stepWrap = document.createElement('div');
    stepWrap.className = 'step-process-container';

    if (activeTab === 1) stepWrap.appendChild(buildUploadSection());
    else if (activeTab === 2) stepWrap.appendChild(buildPreviewSection());

    contentPanel.appendChild(stepWrap);
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
    allRows = rows;
    const groups = getGroups();
    selectedGroups = new Set(groups.map((g) => g.code));
    rerender();
  }

  function resetAll(): void {
    uploadedFiles = []; allRows = []; selectedGroups = new Set();
    exportMode = 'combined'; parseErrors = []; parseWarnings = [];
    activeFilter = { idNo: '', groupCode: '', date: '', remarks: '' };
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
