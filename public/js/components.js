/* ═══════════════════════════════════════════════════════════════════════════
   Utsuru — Component Renderers
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
        ? '<span class="badge badge-accent" style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="clapperboard" style="width:12px;height:12px;"></i> Movie</span>'
        : '<span class="badge badge-info" style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="tv" style="width:12px;height:12px;"></i> TV</span>';
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
            <div class="stat-card ">
                <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
                <div class="stat-label">Total Downloads</div>
                <div class="stat-value-lg">${stats.totalDownloads || 0}</div>
            </div>
            <div class="stat-card ">
                <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
                <div class="stat-label">Data Transferred</div>
                <div class="stat-value-lg">${formatBytes(stats.totalBytes)}</div>
            </div>
            <div class="stat-card ">
                <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
                <div class="stat-label">Movies</div>
                <div class="stat-value-lg">${stats.movieCount || 0}</div>
            </div>
            <div class="stat-card ">
                <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
                <div class="stat-label">TV Episodes</div>
                <div class="stat-value-lg">${stats.tvCount || 0}</div>
            </div>
            <div class="stat-card ">
                <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
                <div class="stat-label">Active Downloads</div>
                <div class="stat-value-lg flex items-center gap-2">
                    ${stats.activeDownloads > 0 ? statusDot('downloading') : ''}
                    ${stats.activeDownloads || 0}
                </div>
            </div>
        </div>

        ${renderChart(chart)}

        <div class="card ">
            <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
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
                ? `<div class="card ">
                    <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
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
        <div class="download-card " id="download-${d.id}">
            <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
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
                ${d.filename ? `<span style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="file" style="width:14px;height:14px;"></i> ${escapeHtml(d.filename)}</span>` : ''}
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
                    ${isActive ? `<button class="btn btn-secondary btn-sm" data-action="download-pause" data-id="${d.id}"><i data-lucide="pause" style="width:14px;height:14px;"></i> Pause</button>` : ''}
                    ${isPaused ? `<button class="btn btn-secondary btn-sm" data-action="download-resume" data-id="${d.id}"><i data-lucide="play" style="width:14px;height:14px;"></i> Resume</button>` : ''}
                    <button class="btn btn-destructive btn-sm" data-action="download-cancel" data-id="${d.id}"><i data-lucide="x" style="width:14px;height:14px;"></i> Cancel</button>
                </div>
            ` : ''}
            ${d.status === 'error' ? `
                <div class="mt-2 text-sm" style="color:var(--destructive);display:flex;align-items:center;gap:4px;"><i data-lucide="triangle-alert" style="width:14px;height:14px;"></i> ${escapeHtml(d.error_msg || 'Unknown error')}</div>
            ` : ''}
        </div>
    `;
}

function renderHistory(downloads, total) {
    return `
        <div class="page-header">
            <div>
                <h1 class="page-title">History</h1>
                <p class="page-subtitle">All download activity</p>
            </div>
        </div>

        <div class="card" style="padding:0; gap:0;">
            <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
            
            <div class="card-header" style="flex-direction:row; align-items:center; padding: 1rem; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; background: var(--card-header); border-bottom: none;">
                <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; position:relative;">
                    <input class="input" type="text" id="history-search" placeholder="Search..." style="max-width:200px; padding-left:2.25rem; border-radius:0; height:2.25rem;">
                    <i data-lucide="search" style="position:absolute; left:0.75rem; top:50%; transform:translateY(-50%); width:14px; height:14px; color:var(--muted-foreground);"></i>
                    <select class="select" style="max-width:150px; height:2.25rem; font-size:0.875rem; border-radius:0;" id="history-type-filter">
                        <option value="">All types</option>
                        <option value="movie">Movies</option>
                        <option value="tv">TV</option>
                    </select>
                    <select class="select" style="max-width:150px; height:2.25rem; font-size:0.875rem; border-radius:0;" id="history-filter">
                        <option value="">All status</option>
                        <option value="complete">Complete</option>
                        <option value="downloading">Downloading</option>
                        <option value="paused">Paused</option>
                        <option value="error">Error</option>
                        <option value="queued">Queued</option>
                    </select>
                </div>
            </div>

            <div style="overflow-x:auto;">
                <table style="width:100%; text-align:left; border-collapse:collapse; border-top:1px solid var(--border); font-size:0.875rem;">
                    <thead style="background:var(--card-header);">
                        <tr style="border-bottom:1px solid var(--border);">
                            <th style="height:2.5rem; padding:0 0.5rem; font-weight:500; text-transform:uppercase; color:var(--foreground); width:25%;">Name</th>
                            <th style="height:2.5rem; padding:0 0.5rem; font-weight:500; text-transform:uppercase; color:var(--foreground); text-align:left;">Type</th>
                            <th style="height:2.5rem; padding:0 0.5rem; font-weight:500; text-transform:uppercase; color:var(--foreground); text-align:center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${downloads.length === 0
                            ? '<tr><td colspan="3" style="padding:3rem 0.5rem; text-align:center; color:var(--muted-foreground);">No destinations match your filters.</td></tr>'
                            : downloads.map(d => `
                                <tr style="border-bottom:1px solid var(--border); transition:background-color 0.15s ease; height:3rem; cursor:pointer;" onmouseover="this.style.backgroundColor='rgba(255,255,255,0.03)'" onmouseout="this.style.backgroundColor='transparent'">
                                    <td style="padding:0.5rem; font-weight:500; color:var(--strong-accent);">
                                        ${escapeHtml(d.title)}${d.year ? ` <span style="color:var(--muted-foreground);">(${d.year})</span>` : ''}${d.season != null ? ` <span style="color:var(--muted-foreground);">S${String(d.season).padStart(2,'0')}E${String(d.episode).padStart(2,'0')}</span>` : ''}
                                    </td>
                                    <td style="padding:0.5rem; text-transform:capitalize; color:var(--muted-foreground);">
                                        ${d.type === 'movie' ? 'movie' : 'tv'}
                                    </td>
                                    <td style="padding:0.5rem; text-align:center;">
                                        ${statusDot(d.status)}
                                    </td>
                                </tr>
                            `).join('')
                        }
                    </tbody>
                </table>
            </div>

            <div class="card-footer" style="padding: 0.5rem 1rem; justify-content:flex-end; border-top:1px solid var(--border); background:var(--card-header);">
                <span style="font-size:0.875rem; color:var(--muted-foreground);">
                    <span style="color:var(--strong-accent);">${downloads.length}</span> downloads
                </span>
            </div>
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

        <div class="tabs-list" id="library-tabs">
            <button class="tab active" data-action="switch-library-tab" data-tab="movies">
                <span class="tab-text" style="display:flex;align-items:center;gap:0.375rem;"><i data-lucide="clapperboard" style="width:16px;height:16px;"></i> Movies (${movies.items?.length || 0})</span>
                <span class="bracket-piece tab-bl"></span><span class="bracket-piece tab-tr"></span><span class="bracket-piece tab-r"></span><span class="bracket-piece tab-br"></span>
            </button>
            <button class="tab" data-action="switch-library-tab" data-tab="tv">
                <span class="tab-text" style="display:flex;align-items:center;gap:0.375rem;"><i data-lucide="tv" style="width:16px;height:16px;"></i> TV Shows (${tv.items?.length || 0})</span>
                <span class="bracket-piece tab-bl"></span><span class="bracket-piece tab-tr"></span><span class="bracket-piece tab-r"></span><span class="bracket-piece tab-br"></span>
            </button>
        </div>

        <div id="library-movies" class="card ">
            <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
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

        <div id="library-tv" class="card " style="display:none;">
            <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
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
                    <span class="tree-chevron" style="transition:transform 0.15s;display:inline-flex;align-items:center;"><i data-lucide="chevron-right" style="width:12px;height:12px;"></i></span>
                    <span style="color:var(--strong-accent);display:inline-flex;align-items:center;"><i data-lucide="folder" style="width:16px;height:16px;"></i></span>
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
                <span style="display:inline-flex;align-items:center;"><i data-lucide="file" style="width:16px;height:16px;color:var(--muted-foreground)"></i></span>
                <span class="file-tree-name">${escapeHtml(item.name)}</span>
                <span class="file-tree-size font-mono">${formatBytes(item.size)}</span>
            </div>
        `;
    }).join('');
}

function renderSettings() {
    return `
        <div class="tabs-list" id="settings-tabs" style="margin-bottom: 1.5rem;">
            <button class="tab active" data-action="switch-settings-tab" data-tab="account">
                <span class="tab-text">Account</span>
                <span class="bracket-piece tab-bl"></span><span class="bracket-piece tab-tr"></span><span class="bracket-piece tab-r"></span><span class="bracket-piece tab-br"></span>
            </button>
            <button class="tab" data-action="switch-settings-tab" data-tab="integrations">
                <span class="tab-text">Integrations</span>
                <span class="bracket-piece tab-bl"></span><span class="bracket-piece tab-tr"></span><span class="bracket-piece tab-r"></span><span class="bracket-piece tab-br"></span>
            </button>
        </div>

        <div id="settings-account-tab">
            <div class="card" style="padding:0; gap:0;">
                <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
                <div style="border-bottom: 1px solid var(--border); padding: 1.5rem; background: var(--card-header);">
                    <h3 class="font-semibold text-lg flex items-center gap-2">
                        <i data-lucide="user" style="width:18px;height:18px;"></i>
                        Account Information
                    </h3>
                    <p class="text-sm text-muted" style="margin-top:0.375rem;">Your account details</p>
                </div>
                <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                    <div class="form-group">
                        <label class="label">Username</label>
                        <input class="input" value="admin" disabled style="max-width: 28rem;">
                    </div>
                </div>

                <div style="border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 1.5rem; background: var(--card-header);">
                    <h3 class="font-semibold text-lg flex items-center gap-2">
                        <i data-lucide="key-round" style="width:18px;height:18px;"></i>
                        Change Password
                    </h3>
                    <p class="text-sm text-muted" style="margin-top:0.375rem;">Update your password to keep your account secure</p>
                </div>
                <div style="padding: 1.5rem;">
                    <form id="password-change-form" style="display:flex; flex-direction:column; gap:1rem;">
                        <div class="form-group">
                            <label class="label" for="current-password">Current Password</label>
                            <input class="input" type="password" id="current-password" required autocomplete="current-password" style="max-width: 28rem;">
                        </div>
                        <div class="form-group">
                            <label class="label" for="new-password">New Password</label>
                            <input class="input" type="password" id="new-password" required autocomplete="new-password" minlength="6" style="max-width: 28rem;">
                            <p class="text-xs text-muted" style="margin-top:0.5rem;">Must be at least 6 characters long</p>
                        </div>
                        <div id="password-error" class="text-sm" style="color:var(--destructive);display:none;"></div>
                        <button type="submit" class="btn btn-primary" style="align-self:flex-start;">
                            <i data-lucide="key-round" style="width:16px;height:16px;"></i>
                            Change Password
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <div id="settings-integrations-tab" style="display:none;">
            <div class="card" style="padding:0; gap:0;">
                <div class="card-bracket"><span class="cb-tl-h"></span><span class="cb-tl-v"></span><span class="cb-tr-h"></span><span class="cb-tr-v"></span><span class="cb-bl-h"></span><span class="cb-bl-v"></span><span class="cb-br-h"></span><span class="cb-br-v"></span></div>
                
                <div style="border-bottom: 1px solid var(--border); padding: 1.5rem; background: var(--card-header);">
                    <h3 class="font-semibold text-lg flex items-center gap-2">
                        <i data-lucide="boxes" style="width:18px;height:18px;"></i>
                        Jellyfin Integration
                    </h3>
                    <p class="text-sm text-muted" style="margin-top:0.375rem;">Connect to your media server</p>
                </div>
                <div style="padding: 1.5rem;" id="settings-jellyfin">
                    <div class="skeleton" style="height:120px;"></div>
                </div>

                <div style="border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 1.5rem; background: var(--card-header);">
                    <h3 class="font-semibold text-lg flex items-center gap-2">
                        <i data-lucide="download-cloud" style="width:18px;height:18px;"></i>
                        aria2c Configuration
                    </h3>
                    <p class="text-sm text-muted" style="margin-top:0.375rem;">Configure your download daemon</p>
                </div>
                <div style="padding: 1.5rem;" id="settings-aria2">
                    <div class="skeleton" style="height:80px;"></div>
                </div>
            </div>
        </div>
    `;
}

