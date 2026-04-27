/* App Logic — navigation, state, SSE live updates, theme toggle.
   Depends on: api.js, utils.js, components.js */

let currentPage = 'dashboard';
let sseSource = null;
let historySearchTimer = null;

const VALID_PAGES = ['dashboard', 'downloads', 'library', 'history', 'settings'];

const PAGE_META = {
    dashboard: { label: 'Dashboard',  icon: 'layout-dashboard' },
    downloads: { label: 'Downloads',  icon: 'download' },
    library:   { label: 'Library',    icon: 'folder-open' },
    history:   { label: 'History',    icon: 'clock' },
    settings:  { label: 'Settings',   icon: 'settings' },
};


/* Initialization */
document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('utsuru-theme') || 'dark';
    applyTheme(savedTheme);
    attachEventListeners();

    window.addEventListener('popstate', (e) => {
        const page = e.state?.page || pageFromPath();
        if (currentPage !== page) navigateTo(page, false);
    });

    try {
        const { user } = await API.me();
        showApp(user);
    } catch {
        showLogin();
    }
});


/* Event Listeners */
function attachEventListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    /* Sidebar nav */
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    /* Mobile menu nav */
    document.querySelectorAll('.mobile-menu-item[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.dataset.page);
            closeMobileMenu();
        });
    });

    document.getElementById('sidebar-overlay').addEventListener('click', toggleSidebar);
    document.getElementById('mobile-menu-btn').addEventListener('click', toggleMobileMenu);
    document.getElementById('sidebar-collapse-btn').addEventListener('click', toggleSidebarCollapse);

    /* Theme toggle (desktop + mobile) */
    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
    document.getElementById('mobile-theme-btn').addEventListener('click', () => {
        toggleTheme();
        closeMobileMenu();
    });

    /* Logout (desktop + mobile) */
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('mobile-logout-btn').addEventListener('click', () => {
        handleLogout();
        closeMobileMenu();
    });

    /* Download dialog */
    document.getElementById('add-download-dialog').addEventListener('click', closeDialogOnOverlay);
    document.getElementById('tab-movie-btn').addEventListener('click', () => switchDownloadType('movie'));
    document.getElementById('tab-tv-btn').addEventListener('click', () => switchDownloadType('tv'));
    document.getElementById('download-form').addEventListener('submit', submitDownload);
    document.getElementById('cancel-dl-btn').addEventListener('click', closeAddDialog);
    document.getElementById('submit-dl-btn').addEventListener('click', () => {
        document.getElementById('download-form').requestSubmit();
    });

    /* Path preview */
    ['dl-title', 'dl-year', 'dl-season', 'dl-episode'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updatePathPreview);
    });
}


/* Auth */
function showLogin() {
    document.getElementById('login-screen').style.display = '';
    document.getElementById('app-shell').style.display = 'none';
    stopSSE();
    document.title = 'utsuru - Login';
}

function showApp(user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = '';
    const usernameEl = document.getElementById('header-username');
    if (usernameEl) usernameEl.textContent = user?.username || '';
    navigateTo(pageFromPath(), false);
    refreshIcons();
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.textContent = 'Logging in...';
    errorEl.style.display = 'none';

    try {
        const result = await API.login(username, password);
        showApp(result.user);
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = '';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Login';
    }
}

async function handleLogout() {
    try { await API.logout(); } catch { /* ignore */ }
    window.history.replaceState(null, '', '/');
    showLogin();
}


/* Routing */
function pageFromPath() {
    const seg = window.location.pathname.replace(/^\//, '').split('/')[0];
    return VALID_PAGES.includes(seg) ? seg : 'dashboard';
}


/* Navigation */
async function navigateTo(page, pushState = true) {
    if (!VALID_PAGES.includes(page)) page = 'dashboard';
    currentPage = page;
    stopSSE();

    if (pushState) {
        window.history.pushState({ page }, '', `/${page}`);
    }

    const meta = PAGE_META[page] || PAGE_META.dashboard;
    document.title = `${meta.label} - utsuru`;

    /* Update active states */
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });
    updateMobileMenuActive(page);

    /* Breadcrumb */
    const breadcrumbIcon = document.querySelector('.breadcrumb i[data-lucide]');
    if (breadcrumbIcon) breadcrumbIcon.setAttribute('data-lucide', meta.icon);
    const breadcrumbText = document.getElementById('breadcrumb-text');
    if (breadcrumbText) breadcrumbText.textContent = meta.label;

    closeMobileSidebar();

    /* Loading skeleton */
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div style="padding: 1rem; max-width: 1200px; margin: 0 auto;">
            <div class="skeleton" style="height:2rem; width:200px; margin-bottom:1.5rem;"></div>
            <div class="card" style="padding:0; gap:0; margin-bottom:1rem;">
                <div style="padding:1rem; display:flex; gap:1rem;">
                    <div class="skeleton" style="height:80px; flex:1;"></div>
                    <div class="skeleton" style="height:80px; flex:1;"></div>
                    <div class="skeleton" style="height:80px; flex:1;"></div>
                    <div class="skeleton" style="height:80px; flex:1;"></div>
                </div>
            </div>
            <div class="card" style="padding:1rem; gap:0;">
                <div class="skeleton" style="height:200px; width:100%;"></div>
            </div>
        </div>`;

    try {
        switch (page) {
            case 'dashboard': await loadDashboard(); break;
            case 'downloads': await loadDownloads(); break;
            case 'library':   await loadLibrary();   break;
            case 'history':   await loadHistory();   break;
            case 'settings':  await loadSettings();  break;
        }
        content.classList.add('page-fade-in');
        setTimeout(() => content.classList.remove('page-fade-in'), 300);
    } catch (err) {
        content.innerHTML = `<div class="empty-state"><p style="color:var(--destructive);">Error loading page: ${escapeHtml(err.message)}</p></div>`;
    }

    refreshIcons();
}


/* Page Loaders */
async function loadDashboard() {
    const [stats, chart, recent] = await Promise.all([
        API.getStats(), API.getChartData(), API.getRecent(),
    ]);
    document.getElementById('page-content').innerHTML = renderDashboard(stats, chart, recent);
    attachDynamicListeners();
    refreshIcons();
}

async function loadDownloads() {
    const { downloads } = await API.getDownloads({ status: '', limit: 50 });
    const active = downloads.filter(d => ['queued', 'downloading', 'paused'].includes(d.status));
    document.getElementById('page-content').innerHTML = renderDownloads(active);
    attachDynamicListeners();
    refreshIcons();
    startSSE();
}

async function loadHistory() {
    const search = document.getElementById('history-search')?.value || '';
    const status = document.getElementById('history-filter')?.value || '';
    const type = document.getElementById('history-type-filter')?.value || '';

    const { downloads, total } = await API.getDownloads({ search, status, type, limit: 100 });
    document.getElementById('page-content').innerHTML = renderHistory(downloads, total);

    /* Restore filter values */
    const searchEl = document.getElementById('history-search');
    const statusEl = document.getElementById('history-filter');
    const typeEl = document.getElementById('history-type-filter');
    if (searchEl && search) searchEl.value = search;
    if (statusEl && status) statusEl.value = status;
    if (typeEl && type) typeEl.value = type;

    attachDynamicListeners();
    refreshIcons();
}

async function loadLibrary() {
    const [movies, tv] = await Promise.all([API.getMovies(), API.getTv()]);
    document.getElementById('page-content').innerHTML = renderLibrary(movies, tv);
    attachDynamicListeners();
    refreshIcons();
}

async function loadSettings() {
    const content = document.getElementById('page-content');
    content.innerHTML = renderSettings();
    refreshIcons();

    try {
        const settings = await API.getSettings();
        const jellyfinStatus = await API.jellyfinStatus().catch(() => ({ configured: false }));

        document.getElementById('settings-jellyfin').innerHTML = `
            <div class="flex items-center gap-2 mb-4">
                ${jellyfinStatus.connected
                    ? `${statusDot('complete')} <span class="text-success text-sm">Connected to ${escapeHtml(jellyfinStatus.serverName || 'Jellyfin')}</span>`
                    : jellyfinStatus.configured
                        ? `${statusDot('error')} <span class="text-sm" style="color:var(--destructive);">Cannot connect</span>`
                        : `${statusDot('neutral')} <span class="text-sm text-muted">Not configured</span>`}
            </div>
            <div class="form-group">
                <label class="label">Jellyfin URL</label>
                <input class="input" id="set-jellyfin-url" value="${escapeHtml(settings.jellyfin_url || '')}" placeholder="http://localhost:8096">
            </div>
            <div class="form-group">
                <label class="label">API Key</label>
                <input class="input" type="password" id="set-jellyfin-key" value="" placeholder="${settings.jellyfin_api_key || 'Enter API key'}">
                <div class="label-muted">Found in Jellyfin → Dashboard → API Keys</div>
            </div>
            <button class="btn btn-primary btn-sm" id="save-jellyfin-btn">Save</button>
        `;

        document.getElementById('settings-aria2').innerHTML = `
            <div class="form-group">
                <label class="label">aria2c RPC URL</label>
                <input class="input" id="set-aria2-url" value="${escapeHtml(settings.aria2_rpc_url || 'http://localhost:6800/jsonrpc')}" placeholder="http://localhost:6800/jsonrpc">
            </div>
            <button class="btn btn-primary btn-sm" id="save-aria2-btn">Save</button>
        `;

        attachDynamicListeners();
    } catch (err) {
        console.error('Settings load error:', err);
    }
}


/* Dynamic Event Listeners (for innerHTML-rendered content) */
function attachDynamicListeners() {
    const content = document.getElementById('page-content');
    content.removeEventListener('click', handleDynamicClick);
    content.addEventListener('click', handleDynamicClick);

    const historySearch = document.getElementById('history-search');
    const historyFilter = document.getElementById('history-filter');
    const historyTypeFilter = document.getElementById('history-type-filter');
    if (historySearch) historySearch.addEventListener('input', debounceHistorySearch);
    if (historyFilter) historyFilter.addEventListener('change', () => loadHistory());
    if (historyTypeFilter) historyTypeFilter.addEventListener('change', () => loadHistory());

    const saveJellyfinBtn = document.getElementById('save-jellyfin-btn');
    const saveAria2Btn = document.getElementById('save-aria2-btn');
    if (saveJellyfinBtn) saveJellyfinBtn.addEventListener('click', saveJellyfinSettings);
    if (saveAria2Btn) saveAria2Btn.addEventListener('click', saveAria2Settings);

    const pwForm = document.getElementById('password-change-form');
    if (pwForm) pwForm.addEventListener('submit', changePassword);
}

function handleDynamicClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
        case 'open-add-dialog':     openAddDialog(); break;
        case 'navigate':            navigateTo(btn.dataset.page); break;
        case 'download-pause':      downloadAction(Number(id), 'pause'); break;
        case 'download-resume':     downloadAction(Number(id), 'resume'); break;
        case 'download-cancel':     downloadAction(Number(id), 'cancel'); break;
        case 'delete-download':     deleteDownload(Number(id)); break;
        case 'scan-jellyfin':       scanJellyfin(); break;
        case 'switch-library-tab':  switchLibraryTab(btn.dataset.tab); break;
        case 'switch-settings-tab': switchSettingsTab(btn.dataset.tab); break;
        case 'toggle-tree': {
            const children = btn.nextElementSibling;
            const chevron = btn.querySelector('.tree-chevron');
            if (children) children.classList.toggle('hidden');
            if (chevron) chevron.classList.toggle('rotated');
            break;
        }
    }
}


/* SSE Live Updates */
function startSSE() {
    stopSSE();
    sseSource = new EventSource('/api/downloads/active');
    sseSource.onmessage = (event) => {
        try {
            const downloads = JSON.parse(event.data);
            if (currentPage === 'downloads' && Array.isArray(downloads)) {
                const container = document.getElementById('active-downloads');
                if (container && downloads.length > 0) {
                    container.innerHTML = downloads.map(d => renderDownloadCard(d)).join('');
                    refreshIcons();
                }
            }
        } catch { /* ignore parse errors */ }
    };
    sseSource.onerror = () => {
        stopSSE();
        setTimeout(() => { if (currentPage === 'downloads') startSSE(); }, 5000);
    };
}

function stopSSE() {
    if (sseSource) { sseSource.close(); sseSource = null; }
}


/* Download Actions */
function openAddDialog() {
    document.getElementById('add-download-dialog').style.display = '';
    ['dl-title', 'dl-year', 'dl-season', 'dl-episode', 'dl-url'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('dl-error').style.display = 'none';
    switchDownloadType('movie');
    updatePathPreview();
}

function closeAddDialog() {
    document.getElementById('add-download-dialog').style.display = 'none';
}

function closeDialogOnOverlay(e) {
    if (e.target === e.currentTarget) closeAddDialog();
}

function switchDownloadType(type) {
    document.getElementById('dl-type').value = type;
    document.getElementById('movie-fields').style.display = type === 'movie' ? '' : 'none';
    document.getElementById('tv-fields').style.display = type === 'tv' ? '' : 'none';
    document.getElementById('tab-movie-btn').classList.toggle('active', type === 'movie');
    document.getElementById('tab-tv-btn').classList.toggle('active', type === 'tv');
    updatePathPreview();
}

function updatePathPreview() {
    const type = document.getElementById('dl-type').value;
    const title = document.getElementById('dl-title').value || 'Title';
    const year = document.getElementById('dl-year').value;
    const season = (document.getElementById('dl-season').value || '1').padStart(2, '0');
    const episode = (document.getElementById('dl-episode').value || '1').padStart(2, '0');

    const path = type === 'movie'
        ? `/media/movies/${title}${year ? ` (${year})` : ''}/`
        : `/media/tv/${title}/Season ${season}/${title} - S${season}E${episode}.mkv`;

    document.getElementById('dl-path-preview').innerHTML =
        `<span style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="folder" style="width:14px;height:14px;"></i> ${path}</span>`;
    if (window.lucide) window.lucide.createIcons();
}

async function submitDownload(e) {
    e.preventDefault();
    const errorEl = document.getElementById('dl-error');
    errorEl.style.display = 'none';

    const data = {
        type: document.getElementById('dl-type').value,
        title: document.getElementById('dl-title').value,
        url: document.getElementById('dl-url').value,
    };

    if (data.type === 'movie') {
        const year = document.getElementById('dl-year').value;
        if (year) data.year = Number(year);
    } else {
        const season = document.getElementById('dl-season').value;
        const episode = document.getElementById('dl-episode').value;
        if (season) data.season = Number(season);
        if (episode) data.episode = Number(episode);
    }

    try {
        await API.createDownload(data);
        closeAddDialog();
        showToast('Download started!', 'success');
        if (currentPage === 'downloads') await loadDownloads();
        else if (currentPage === 'dashboard') await loadDashboard();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = '';
    }
}

async function downloadAction(id, action) {
    try {
        await API.updateDownload(id, action);
        const msg = action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'cancelled';
        showToast(`Download ${msg}`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteDownload(id) {
    if (!confirm('Remove this download from history?')) return;
    try {
        await API.deleteDownload(id);
        showToast('Removed from history', 'success');
        await loadHistory();
    } catch (err) {
        showToast(err.message, 'error');
    }
}


/* Library */
function switchLibraryTab(tab) {
    const tabs = document.querySelectorAll('#library-tabs .tab');
    tabs[0]?.classList.toggle('active', tab === 'movies');
    tabs[1]?.classList.toggle('active', tab === 'tv');
    const moviesEl = document.getElementById('library-movies');
    const tvEl = document.getElementById('library-tv');
    if (moviesEl) moviesEl.style.display = tab === 'movies' ? '' : 'none';
    if (tvEl) tvEl.style.display = tab === 'tv' ? '' : 'none';
}

function switchSettingsTab(tab) {
    const tabs = document.querySelectorAll('#settings-tabs .tab');
    tabs[0]?.classList.toggle('active', tab === 'account');
    tabs[1]?.classList.toggle('active', tab === 'integrations');
    const accountEl = document.getElementById('settings-account-tab');
    const integrationsEl = document.getElementById('settings-integrations-tab');
    if (accountEl) accountEl.style.display = tab === 'account' ? '' : 'none';
    if (integrationsEl) integrationsEl.style.display = tab === 'integrations' ? '' : 'none';
}

async function scanJellyfin() {
    const btn = document.querySelector('[data-action="scan-jellyfin"]');
    if (!btn) return;
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '⏳ Scanning...';
    try {
        await API.scanJellyfin();
        showToast('Jellyfin library scan triggered!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}


/* Settings */
async function saveJellyfinSettings() {
    const url = document.getElementById('set-jellyfin-url')?.value;
    const key = document.getElementById('set-jellyfin-key')?.value;
    const data = {};
    if (url !== undefined) data.jellyfin_url = url;
    if (key) data.jellyfin_api_key = key;
    try {
        await API.updateSettings(data);
        showToast('Jellyfin settings saved', 'success');
        await loadSettings();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function saveAria2Settings() {
    const url = document.getElementById('set-aria2-url')?.value;
    try {
        await API.updateSettings({ aria2_rpc_url: url });
        showToast('aria2c settings saved', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function changePassword(e) {
    e.preventDefault();
    const errorEl = document.getElementById('password-error');
    if (errorEl) errorEl.style.display = 'none';

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;

    try {
        await API.request('/api/auth/password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
        showToast('Password updated', 'success');
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
    } catch (err) {
        if (errorEl) { errorEl.textContent = err.message; errorEl.style.display = ''; }
    }
}


/* History Search */
function debounceHistorySearch() {
    clearTimeout(historySearchTimer);
    historySearchTimer = setTimeout(loadHistory, 300);
}


/* Mobile Menu */
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const icon = document.getElementById('mobile-menu-icon');
    const isOpen = menu.classList.toggle('open');
    if (icon) {
        icon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
        refreshIcons();
    }
}

function closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const icon = document.getElementById('mobile-menu-icon');
    if (menu) menu.classList.remove('open');
    if (icon) {
        icon.setAttribute('data-lucide', 'menu');
        refreshIcons();
    }
}

function updateMobileMenuActive(page) {
    document.querySelectorAll('.mobile-menu-item[data-page]').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
}


/* Sidebar (desktop) */
function toggleSidebar() {
    if (window.innerWidth <= 768) {
        toggleMobileMenu();
        return;
    }
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('visible');
}

function closeMobileSidebar() {
    closeMobileMenu();
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-overlay').classList.remove('visible');
}

function toggleSidebarCollapse() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}


/* Theme */
function toggleTheme() {
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('utsuru-theme', next);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
    }
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        const icon = theme === 'dark' ? 'sun' : 'moon';
        btn.innerHTML = `<i data-lucide="${icon}" style="width:16px;height:16px;"></i>`;
        refreshIcons();
    }
}
