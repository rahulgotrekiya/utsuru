/* ═══════════════════════════════════════════════════════════════════════════
   MediaFlow — App Logic
   Navigation, state management, SSE live updates, theme toggle.
   All event listeners are attached via JS (no inline onclick in HTML).
   ═══════════════════════════════════════════════════════════════════════════ */

let currentPage = 'dashboard';
let sseSource = null;
let historySearchTimer = null;

// ── Initialization ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved theme
    const savedTheme = localStorage.getItem('mediaflow-theme') || 'dark';
    applyTheme(savedTheme);

    // Attach all event listeners
    attachEventListeners();

    // Check authentication
    try {
        const { user } = await API.me();
        showApp(user);
    } catch {
        showLogin();
    }
});

// ── Event Listeners (no inline onclick) ─────────────────────────────────────
function attachEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Sidebar navigation
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    // Sidebar overlay (mobile close)
    document.getElementById('sidebar-overlay').addEventListener('click', toggleSidebar);

    // Mobile menu button
    document.getElementById('mobile-menu-btn').addEventListener('click', toggleSidebar);

    // Sidebar collapse button
    document.getElementById('sidebar-collapse-btn').addEventListener('click', toggleSidebarCollapse);

    // Theme toggle
    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Download dialog
    document.getElementById('add-download-dialog').addEventListener('click', closeDialogOnOverlay);
    document.getElementById('tab-movie-btn').addEventListener('click', () => switchDownloadType('movie'));
    document.getElementById('tab-tv-btn').addEventListener('click', () => switchDownloadType('tv'));
    document.getElementById('download-form').addEventListener('submit', submitDownload);
    document.getElementById('cancel-dl-btn').addEventListener('click', closeAddDialog);
    document.getElementById('submit-dl-btn').addEventListener('click', () => {
        document.getElementById('download-form').requestSubmit();
    });

    // Path preview updates
    ['dl-title', 'dl-year', 'dl-season', 'dl-episode'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updatePathPreview);
    });
}

// ── Auth ─────────────────────────────────────────────────────────────────────
function showLogin() {
    document.getElementById('login-screen').style.display = '';
    document.getElementById('app-shell').style.display = 'none';
    stopSSE();
}

function showApp(user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = '';
    const usernameEl = document.getElementById('header-username');
    if (usernameEl) usernameEl.textContent = user?.username || '';
    navigateTo('dashboard');
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
    showLogin();
}

// ── Navigation ──────────────────────────────────────────────────────────────
async function navigateTo(page) {
    currentPage = page;
    stopSSE();

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });

    // Update breadcrumb
    const names = {
        dashboard: 'Dashboard',
        downloads: 'Downloads',
        library: 'Library',
        history: 'History',
        settings: 'Settings'
    };
    document.getElementById('breadcrumb-text').textContent = names[page] || page;

    // Close mobile sidebar
    closeMobileSidebar();

    // Show loading skeleton
    const content = document.getElementById('page-content');
    content.innerHTML = '<div class="flex items-center justify-center" style="padding:4rem;"><div class="skeleton" style="width:200px;height:20px;"></div></div>';

    try {
        switch (page) {
            case 'dashboard': await loadDashboard(); break;
            case 'downloads': await loadDownloads(); break;
            case 'library': await loadLibrary(); break;
            case 'history': await loadHistory(); break;
            case 'settings': await loadSettings(); break;
        }
    } catch (err) {
        content.innerHTML = `<div class="empty-state"><p style="color:var(--destructive);">Error loading page: ${escapeHtml(err.message)}</p></div>`;
    }

    refreshIcons();
}

// ── Page Loaders ────────────────────────────────────────────────────────────
async function loadDashboard() {
    const [stats, chart, recent] = await Promise.all([
        API.getStats(),
        API.getChartData(),
        API.getRecent(),
    ]);
    const content = document.getElementById('page-content');
    content.innerHTML = renderDashboard(stats, chart, recent);

    // Attach event listeners for dynamic elements
    attachDynamicListeners();
    refreshIcons();
}

async function loadDownloads() {
    const { downloads } = await API.getDownloads({ status: '', limit: 50 });
    const active = downloads.filter(d => ['queued', 'downloading', 'paused'].includes(d.status));
    const content = document.getElementById('page-content');
    content.innerHTML = renderDownloads(active);

    attachDynamicListeners();
    refreshIcons();

    // Start SSE for live updates
    startSSE();
}

async function loadHistory() {
    const search = document.getElementById('history-search')?.value || '';
    const status = document.getElementById('history-filter')?.value || '';
    const type = document.getElementById('history-type-filter')?.value || '';

    const { downloads, total } = await API.getDownloads({ search, status, type, limit: 100 });
    const content = document.getElementById('page-content');
    content.innerHTML = renderHistory(downloads, total);

    // Restore filter values
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
    const content = document.getElementById('page-content');
    content.innerHTML = renderLibrary(movies, tv);

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
                        : `${statusDot('neutral')} <span class="text-sm text-muted">Not configured</span>`
                }
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

// ── Dynamic Event Listeners (for innerHTML-rendered content) ────────────────
function attachDynamicListeners() {
    // Use event delegation on the page-content container
    const content = document.getElementById('page-content');

    // Remove old listener to avoid duplicates
    content.removeEventListener('click', handleDynamicClick);
    content.addEventListener('click', handleDynamicClick);

    // Search/filter inputs for history page
    const historySearch = document.getElementById('history-search');
    const historyFilter = document.getElementById('history-filter');
    const historyTypeFilter = document.getElementById('history-type-filter');

    if (historySearch) historySearch.addEventListener('input', debounceHistorySearch);
    if (historyFilter) historyFilter.addEventListener('change', () => loadHistory());
    if (historyTypeFilter) historyTypeFilter.addEventListener('change', () => loadHistory());

    // Settings save buttons
    const saveJellyfinBtn = document.getElementById('save-jellyfin-btn');
    const saveAria2Btn = document.getElementById('save-aria2-btn');
    if (saveJellyfinBtn) saveJellyfinBtn.addEventListener('click', saveJellyfinSettings);
    if (saveAria2Btn) saveAria2Btn.addEventListener('click', saveAria2Settings);

    // Password change form
    const pwForm = document.getElementById('password-change-form');
    if (pwForm) pwForm.addEventListener('submit', changePassword);
}

function handleDynamicClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    switch (action) {
        case 'open-add-dialog':
            openAddDialog();
            break;
        case 'navigate':
            navigateTo(btn.dataset.page);
            break;
        case 'download-pause':
            downloadAction(Number(id), 'pause');
            break;
        case 'download-resume':
            downloadAction(Number(id), 'resume');
            break;
        case 'download-cancel':
            downloadAction(Number(id), 'cancel');
            break;
        case 'delete-download':
            deleteDownload(Number(id));
            break;
        case 'scan-jellyfin':
            scanJellyfin();
            break;
        case 'switch-library-tab':
            switchLibraryTab(btn.dataset.tab);
            break;
        case 'toggle-tree':
            const children = btn.nextElementSibling;
            const chevron = btn.querySelector('.tree-chevron');
            if (children) children.classList.toggle('hidden');
            if (chevron) chevron.classList.toggle('rotated');
            break;
    }
}

// ── SSE Live Updates ────────────────────────────────────────────────────────
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
        setTimeout(() => {
            if (currentPage === 'downloads') startSSE();
        }, 5000);
    };
}

function stopSSE() {
    if (sseSource) { sseSource.close(); sseSource = null; }
}

// ── Download Actions ────────────────────────────────────────────────────────
function openAddDialog() {
    document.getElementById('add-download-dialog').style.display = '';
    document.getElementById('dl-title').value = '';
    document.getElementById('dl-year').value = '';
    document.getElementById('dl-season').value = '';
    document.getElementById('dl-episode').value = '';
    document.getElementById('dl-url').value = '';
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

    let path = '';
    if (type === 'movie') {
        path = `/media/movies/${title}${year ? ` (${year})` : ''}/`;
    } else {
        path = `/media/tv/${title}/Season ${season}/${title} - S${season}E${episode}.mkv`;
    }
    document.getElementById('dl-path-preview').textContent = `📁 ${path}`;
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
        showToast(`Download ${action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'cancelled'}`, 'success');
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

// ── Library ─────────────────────────────────────────────────────────────────
function switchLibraryTab(tab) {
    const tabs = document.querySelectorAll('#library-tabs .tab');
    tabs[0]?.classList.toggle('active', tab === 'movies');
    tabs[1]?.classList.toggle('active', tab === 'tv');
    const moviesEl = document.getElementById('library-movies');
    const tvEl = document.getElementById('library-tv');
    if (moviesEl) moviesEl.style.display = tab === 'movies' ? '' : 'none';
    if (tvEl) tvEl.style.display = tab === 'tv' ? '' : 'none';
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

// ── Settings ────────────────────────────────────────────────────────────────
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

// ── History Search ──────────────────────────────────────────────────────────
function debounceHistorySearch() {
    clearTimeout(historySearchTimer);
    historySearchTimer = setTimeout(loadHistory, 300);
}

// ── Sidebar ─────────────────────────────────────────────────────────────────
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('visible');
}

function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-overlay').classList.remove('visible');
}

function toggleSidebarCollapse() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

// ── Theme Toggle ────────────────────────────────────────────────────────────
function toggleTheme() {
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('mediaflow-theme', next);
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
        btn.innerHTML = theme === 'dark'
            ? '<i data-lucide="sun" style="width:16px;height:16px;"></i>'
            : '<i data-lucide="moon" style="width:16px;height:16px;"></i>';
        refreshIcons();
    }
}

// ── Toasts ──────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ── Lucide Icons Refresh ────────────────────────────────────────────────────
function refreshIcons() {
    if (window.lucide) {
        try { window.lucide.createIcons(); } catch { /* ignore */ }
    }
}

// Inject spin + rotated animations
const _style = document.createElement('style');
_style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .rotated { transform: rotate(90deg) !important; }';
document.head.appendChild(_style);
