/* ═══════════════════════════════════════════════════════════════════════════
   MediaFlow — Component Renderers
   Pure functions that return HTML strings for each UI component.
   Uses data-action attributes for event delegation (no inline onclick).
   ═══════════════════════════════════════════════════════════════════════════ */

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec) {
    if (!bytesPerSec) return '0 B/s';
    return formatBytes(bytesPerSec) + '/s';
}

function formatEta(seconds) {
    if (!seconds || seconds <= 0) return '--';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

function formatDate(dateStr) {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function timeAgo(dateStr) {
    if (!dateStr) return '--';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function statusBadge(status) {
    const map = {
        queued: { cls: 'badge-info', label: 'Queued' },
        downloading: { cls: 'badge-success', label: 'Downloading' },
        paused: { cls: 'badge-warning', label: 'Paused' },
        complete: { cls: 'badge-success', label: 'Complete' },
        error: { cls: 'badge-error', label: 'Error' },
    };
    const s = map[status] || { cls: 'badge-muted', label: status };
    return `<span class="badge ${s.cls}">${s.label}</span>`;
}

function statusDot(status) {
    const map = {
        queued: 'info', downloading: 'success', paused: 'warning', complete: 'success', error: 'error',
    };
    const variant = map[status] || 'neutral';
    const hasAnimation = ['downloading', 'queued'].includes(status);
    return `<span class="status-dot ${variant}">
        ${hasAnimation ? '<span class="pulse"></span>' : ''}
        <span class="dot"></span>
    </span>`;
}

function typeBadge(type) {
    return type === 'movie'
        ? '<span class="badge badge-accent">🎬 Movie</span>'
        : '<span class="badge badge-info">📺 TV</span>';
}

// ── Page Renderers ──────────────────────────────────────────────────────────

function renderDashboard(stats, chart, recent) {
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Dashboard</h1>
                <p class="page-subtitle">Overview of your media downloads</p>
            </div>
            <button class="btn btn-accent" data-action="open-add-dialog">
                <i data-lucide="plus" style="width:16px;height:16px;"></i>
                Add Download
            </button>
        </div>

        <div class="stats-grid">
            <div class="stat-card card-bracketed">
                <span class="card-bracket-bottom left"></span>
                <span class="card-bracket-bottom right"></span>
                <div class="stat-label">Total Downloads</div>
                <div class="stat-value-lg">${stats.totalDownloads || 0}</div>
            </div>
            <div class="stat-card card-bracketed">
                <span class="card-bracket-bottom left"></span>
                <span class="card-bracket-bottom right"></span>
                <div class="stat-label">Data Transferred</div>
                <div class="stat-value-lg">${formatBytes(stats.totalBytes)}</div>
            </div>
            <div class="stat-card card-bracketed">
                <span class="card-bracket-bottom left"></span>
                <span class="card-bracket-bottom right"></span>
                <div class="stat-label">Movies</div>
                <div class="stat-value-lg">${stats.movieCount || 0}</div>
            </div>
            <div class="stat-card card-bracketed">
                <span class="card-bracket-bottom left"></span>
                <span class="card-bracket-bottom right"></span>
                <div class="stat-label">TV Episodes</div>
                <div class="stat-value-lg">${stats.tvCount || 0}</div>
            </div>
            <div class="stat-card card-bracketed">
                <span class="card-bracket-bottom left"></span>
                <span class="card-bracket-bottom right"></span>
                <div class="stat-label">Active Downloads</div>
                <div class="stat-value-lg flex items-center gap-2">
                    ${stats.activeDownloads > 0 ? statusDot('downloading') : ''}
                    ${stats.activeDownloads || 0}
                </div>
            </div>
        </div>

        ${renderChart(chart)}

        <div class="card card-bracketed">
            <span class="card-bracket-bottom left"></span>
            <span class="card-bracket-bottom right"></span>
            <div class="card-header flex items-center justify-between">
                <span class="font-semibold text-sm">Recent Downloads</span>
                <button class="btn btn-secondary btn-sm" data-action="navigate" data-page="history">View All</button>
            </div>
            <div class="card-content" style="padding:0;">
                ${recent.length === 0
                    ? '<div class="empty-state" style="padding:2rem;"><p class="text-muted">No downloads yet</p></div>'
                    : `<div class="table-wrapper" style="border:none;border-radius:0;">
                        <table>
                            <thead><tr><th>Title</th><th>Type</th><th>Size</th><th>Completed</th></tr></thead>
                            <tbody>
                                ${recent.map(d => `
                                    <tr>
                                        <td class="font-semibold">${escapeHtml(d.title)}${d.year ? ` <span class="text-muted">(${d.year})</span>` : ''}${d.season != null ? ` <span class="text-muted">S${String(d.season).padStart(2,'0')}E${String(d.episode).padStart(2,'0')}</span>` : ''}</td>
                                        <td>${typeBadge(d.type)}</td>
                                        <td class="font-mono">${formatBytes(d.filesize)}</td>
                                        <td class="text-muted">${timeAgo(d.completed_at)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`
                }
            </div>
        </div>
    `;
}

function renderChart(data) {
    if (!data || data.length === 0) return '';
    const max = Math.max(...data.map(d => d.total_downloads), 1);

    const bars = data.map((d, i) => {
        const height = Math.max((d.total_downloads / max) * 100, 2);
        const label = i % 5 === 0 ? new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
        return `<div class="chart-bar" style="height:${height}%;" title="${d.date}: ${d.total_downloads} downloads, ${formatBytes(d.total_bytes)}">
            ${label ? `<span class="chart-bar-label">${label}</span>` : ''}
        </div>`;
    }).join('');

    return `
        <div class="chart-container">
            <div class="chart-header">
                <span class="font-semibold text-sm">Download Activity (30 days)</span>
                <span class="text-xs text-muted">${data.reduce((s, d) => s + d.total_downloads, 0)} total</span>
            </div>
            <div class="chart-bar-group" style="padding-bottom:24px;">${bars}</div>
        </div>
    `;
}

function renderDownloads(downloads) {
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Downloads</h1>
                <p class="page-subtitle">Active and queued downloads</p>
            </div>
            <button class="btn btn-accent" data-action="open-add-dialog">
                <i data-lucide="plus" style="width:16px;height:16px;"></i>
                Add Download
            </button>
        </div>

        <div id="active-downloads">
            ${downloads.length === 0
                ? `<div class="card card-bracketed">
                    <span class="card-bracket-bottom left"></span>
                    <span class="card-bracket-bottom right"></span>
                    <div class="empty-state">
                        <i data-lucide="download" style="width:48px;height:48px;opacity:0.3;"></i>
                        <div>
                            <p class="font-semibold" style="margin-bottom:0.25rem;">No active downloads</p>
                            <p class="text-sm text-muted">Click "Add Download" to start</p>
                        </div>
                    </div>
                </div>`
                : downloads.map(d => renderDownloadCard(d)).join('')
            }
        </div>
    `;
}

function renderDownloadCard(d) {
    const progress = Math.round(d.progress || 0);
    const isActive = d.status === 'downloading';
    const isPaused = d.status === 'paused';
    const isQueued = d.status === 'queued';

    return `
        <div class="download-card card-bracketed" id="download-${d.id}">
            <span class="card-bracket-bottom left"></span>
            <span class="card-bracket-bottom right"></span>
            <div class="flex items-center justify-between">
                <div class="download-title">
                    ${statusDot(d.status)}
                    ${escapeHtml(d.title)}
                    ${d.year ? `<span class="text-muted text-sm">(${d.year})</span>` : ''}
                    ${d.season != null ? `<span class="text-muted text-sm">S${String(d.season).padStart(2,'0')}E${String(d.episode).padStart(2,'0')}</span>` : ''}
                    ${typeBadge(d.type)}
                </div>
                ${statusBadge(d.status)}
            </div>
            <div class="download-meta">
                ${d.filename ? `<span>📄 ${escapeHtml(d.filename)}</span>` : ''}
                <span>${timeAgo(d.created_at)}</span>
            </div>
            ${isActive || isPaused || isQueued ? `
                <div class="download-progress">
                    <div class="download-progress-header">
                        <span>${isActive ? 'Downloading...' : isPaused ? 'Paused' : 'Waiting in queue'}</span>
                        <span class="font-semibold">${progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width:${progress}%;${isPaused ? 'background:var(--muted-foreground);' : ''}"></div>
                    </div>
                    <div class="download-stats">
                        <div><div class="stat-label">Speed</div><div class="stat-value">${formatSpeed(d.speed)}</div></div>
                        <div><div class="stat-label">ETA</div><div class="stat-value">${formatEta(d.eta)}</div></div>
                        <div><div class="stat-label">Size</div><div class="stat-value">${formatBytes(d.filesize)}</div></div>
                        <div><div class="stat-label">Downloaded</div><div class="stat-value">${formatBytes((d.filesize || 0) * (progress / 100))}</div></div>
                    </div>
                </div>
                <div class="download-actions">
                    ${isActive ? `<button class="btn btn-secondary btn-sm" data-action="download-pause" data-id="${d.id}">⏸ Pause</button>` : ''}
                    ${isPaused ? `<button class="btn btn-secondary btn-sm" data-action="download-resume" data-id="${d.id}">▶ Resume</button>` : ''}
                    <button class="btn btn-destructive btn-sm" data-action="download-cancel" data-id="${d.id}">✕ Cancel</button>
                </div>
            ` : ''}
            ${d.status === 'error' ? `
                <div class="mt-2 text-sm" style="color:var(--destructive);">⚠ ${escapeHtml(d.error_msg || 'Unknown error')}</div>
            ` : ''}
        </div>
    `;
}

function renderHistory(downloads, total) {
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Download History</h1>
                <p class="page-subtitle">${total} total downloads</p>
            </div>
        </div>

        <div class="search-bar">
            <input class="input search-input" type="text" id="history-search" placeholder="Search by title...">
            <select class="select" style="max-width:150px;" id="history-filter">
                <option value="">All Status</option>
                <option value="complete">Complete</option>
                <option value="downloading">Downloading</option>
                <option value="paused">Paused</option>
                <option value="error">Error</option>
                <option value="queued">Queued</option>
            </select>
            <select class="select" style="max-width:120px;" id="history-type-filter">
                <option value="">All Types</option>
                <option value="movie">Movies</option>
                <option value="tv">TV</option>
            </select>
        </div>

        <div class="table-wrapper" id="history-table-wrapper">
            ${downloads.length === 0
                ? '<div class="empty-state"><p class="text-muted">No downloads found</p></div>'
                : `<table>
                    <thead><tr><th>Status</th><th>Title</th><th>Type</th><th>Filename</th><th>Size</th><th>Date</th><th></th></tr></thead>
                    <tbody>
                        ${downloads.map(d => `
                            <tr>
                                <td>${statusDot(d.status)} ${statusBadge(d.status)}</td>
                                <td class="font-semibold">${escapeHtml(d.title)}${d.year ? ` <span class="text-muted">(${d.year})</span>` : ''}${d.season != null ? ` <span class="text-muted">S${String(d.season).padStart(2,'0')}E${String(d.episode).padStart(2,'0')}</span>` : ''}</td>
                                <td>${typeBadge(d.type)}</td>
                                <td class="text-xs text-muted truncate" style="max-width:180px;" title="${escapeHtml(d.filename)}">${escapeHtml(d.filename) || '--'}</td>
                                <td class="font-mono">${formatBytes(d.filesize)}</td>
                                <td class="text-muted text-xs">${formatDate(d.completed_at || d.created_at)}</td>
                                <td><button class="btn btn-ghost btn-sm" data-action="delete-download" data-id="${d.id}" title="Remove">✕</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`
            }
        </div>
    `;
}

function renderLibrary(movies, tv) {
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Media Library</h1>
                <p class="page-subtitle">Browse your Jellyfin media folders</p>
            </div>
            <button class="btn btn-secondary" data-action="scan-jellyfin" id="scan-btn">
                <i data-lucide="refresh-cw" style="width:16px;height:16px;"></i>
                Scan Jellyfin
            </button>
        </div>

        <div class="tabs" id="library-tabs">
            <button class="tab active" data-action="switch-library-tab" data-tab="movies">🎬 Movies (${movies.items?.length || 0})</button>
            <button class="tab" data-action="switch-library-tab" data-tab="tv">📺 TV Shows (${tv.items?.length || 0})</button>
        </div>

        <div id="library-movies" class="card card-bracketed">
            <span class="card-bracket-bottom left"></span>
            <span class="card-bracket-bottom right"></span>
            <div class="card-content">
                <div class="text-xs text-muted mb-4">${escapeHtml(movies.root)}</div>
                <div class="file-tree" id="movies-tree">
                    ${movies.items?.length === 0
                        ? '<div class="empty-state" style="padding:2rem;"><p class="text-muted">No movies found</p></div>'
                        : renderFileTree(movies.items)
                    }
                </div>
            </div>
        </div>

        <div id="library-tv" class="card card-bracketed" style="display:none;">
            <span class="card-bracket-bottom left"></span>
            <span class="card-bracket-bottom right"></span>
            <div class="card-content">
                <div class="text-xs text-muted mb-4">${escapeHtml(tv.root)}</div>
                <div class="file-tree">
                    ${tv.items?.length === 0
                        ? '<div class="empty-state" style="padding:2rem;"><p class="text-muted">No TV shows found</p></div>'
                        : renderFileTree(tv.items)
                    }
                </div>
            </div>
        </div>
    `;
}

function renderFileTree(items, depth = 0) {
    if (!items || items.length === 0) return '';
    return items.map(item => {
        if (item.type === 'directory') {
            return `
                <div class="file-tree-item" data-action="toggle-tree" style="padding-left:${depth * 1.25}rem;">
                    <span class="tree-chevron" style="transition:transform 0.15s;display:inline-block;font-size:0.625rem;">▶</span>
                    <span style="color:var(--strong-accent);">📁</span>
                    <span class="file-tree-name font-semibold">${escapeHtml(item.name)}</span>
                    <span class="file-tree-size">${item.children?.length || 0} items</span>
                </div>
                <div class="file-tree-children hidden">
                    ${renderFileTree(item.children, depth + 1)}
                </div>
            `;
        }
        return `
            <div class="file-tree-item" style="padding-left:${depth * 1.25}rem;">
                <span style="width:0.75rem;display:inline-block;"></span>
                <span>📄</span>
                <span class="file-tree-name">${escapeHtml(item.name)}</span>
                <span class="file-tree-size font-mono">${formatBytes(item.size)}</span>
            </div>
        `;
    }).join('');
}

function renderSettings() {
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Settings</h1>
                <p class="page-subtitle">Configure MediaFlow</p>
            </div>
        </div>

        <div class="flex-col gap-6" style="display:flex;">
            <div class="card card-bracketed">
                <span class="card-bracket-bottom left"></span>
                <span class="card-bracket-bottom right"></span>
                <div class="card-header"><span class="font-semibold text-sm">Jellyfin Integration</span></div>
                <div class="card-content" id="settings-jellyfin">
                    <div class="skeleton" style="height:120px;"></div>
                </div>
            </div>

            <div class="card card-bracketed">
                <span class="card-bracket-bottom left"></span>
                <span class="card-bracket-bottom right"></span>
                <div class="card-header"><span class="font-semibold text-sm">aria2c Configuration</span></div>
                <div class="card-content" id="settings-aria2">
                    <div class="skeleton" style="height:80px;"></div>
                </div>
            </div>

            <div class="card card-bracketed">
                <span class="card-bracket-bottom left"></span>
                <span class="card-bracket-bottom right"></span>
                <div class="card-header"><span class="font-semibold text-sm">Change Password</span></div>
                <div class="card-content">
                    <form id="password-change-form">
                        <div class="form-group">
                            <label class="label" for="current-password">Current Password</label>
                            <input class="input" type="password" id="current-password" required autocomplete="current-password">
                        </div>
                        <div class="form-group">
                            <label class="label" for="new-password">New Password</label>
                            <input class="input" type="password" id="new-password" required autocomplete="new-password" minlength="6">
                        </div>
                        <div id="password-error" class="text-sm" style="color:var(--destructive);margin-bottom:0.75rem;display:none;"></div>
                        <button type="submit" class="btn btn-primary">Update Password</button>
                    </form>
                </div>
            </div>
        </div>
    `;
}
