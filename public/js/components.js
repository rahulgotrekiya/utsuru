/* Page renderer functions — return HTML strings.
   Uses data-action attributes for event delegation (no inline onclick).
   Depends on: utils.js (bracket, escapeHtml, formatBytes, etc.) */

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

        <div class="stats-grid" style="margin-bottom:2rem;">
            ${renderStatCard('Total Downloads', stats.totalDownloads || 0)}
            ${renderStatCard('Data Transferred', formatBytes(stats.totalBytes))}
            ${renderStatCard('Movies', stats.movieCount || 0)}
            ${renderStatCard('TV Episodes', stats.tvCount || 0)}
            <div class="card stat-card">
                ${bracket()}
                <div class="stat-label">Active</div>
                <div class="stat-value-lg" style="display:flex;align-items:center;gap:0.5rem;">
                    ${stats.activeDownloads > 0 ? statusDot('downloading') : ''}
                    ${stats.activeDownloads || 0}
                </div>
            </div>
        </div>

        <div class="card" style="padding:0; gap:0; margin-bottom:2rem;">
            ${bracket()}
            <div class="chart-container" style="margin-bottom:0;">
                ${renderChart(chart)}
            </div>
        </div>

        <div class="card" style="padding:0; gap:0;">
            ${bracket()}
            <div class="card-header flex items-center justify-between" style="padding:1rem 1.25rem; border-bottom:1px solid var(--border);">
                <span class="stat-label" style="letter-spacing:0.08em;">Recent Downloads</span>
                <button class="btn btn-secondary btn-sm" data-action="navigate" data-page="history">View All</button>
            </div>
            <div class="card-content" style="padding:0;">
                ${recent.length === 0
                    ? '<div class="empty-state" style="padding:2rem;"><p class="text-muted">No downloads yet</p></div>'
                    : renderRecentTable(recent)}
            </div>
        </div>
    `;
}

function renderStatCard(label, value) {
    return `
        <div class="card stat-card">
            ${bracket()}
            <div class="stat-label">${label}</div>
            <div class="stat-value-lg">${value}</div>
        </div>`;
}

function renderRecentTable(recent) {
    return `
        <div class="table-wrapper" style="border:none;border-radius:0;">
            <table>
                <thead><tr><th>Title</th><th>Type</th><th>Size</th><th>Completed</th></tr></thead>
                <tbody>
                    ${recent.map(d => `
                        <tr class="history-table-row" style="border-bottom:1px solid var(--border); height:3rem;">
                            <td class="font-semibold">${escapeHtml(d.title)}${formatTitleSuffix(d)}</td>
                            <td>${typeBadge(d.type)}</td>
                            <td class="font-mono">${formatBytes(d.filesize)}</td>
                            <td class="text-muted">${timeAgo(d.completed_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
}

function formatTitleSuffix(d) {
    let suffix = '';
    if (d.year) suffix += ` <span class="text-muted">(${d.year})</span>`;
    if (d.season != null) suffix += ` <span class="text-muted">S${String(d.season).padStart(2,'0')}E${String(d.episode).padStart(2,'0')}</span>`;
    return suffix;
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
        <div class="chart-header">
            <span class="stat-label" style="letter-spacing:0.08em;">Download Activity (30 days)</span>
            <span class="text-xs text-muted">${data.reduce((s, d) => s + d.total_downloads, 0)} total</span>
        </div>
        <div class="chart-bar-group" style="padding-bottom:24px;">${bars}</div>
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
                ? `<div class="card">${bracket()}<div class="empty-state">
                    <i data-lucide="download" style="width:48px;height:48px;opacity:0.3;"></i>
                    <div><p class="font-semibold" style="margin-bottom:0.25rem;">No active downloads</p>
                    <p class="text-sm text-muted">Click "Add Download" to start</p></div>
                  </div></div>`
                : downloads.map(d => renderDownloadCard(d)).join('')}
        </div>
    `;
}

function renderDownloadCard(d) {
    const progress = Math.round(d.progress || 0);
    const isActive = d.status === 'downloading';
    const isPaused = d.status === 'paused';
    const isQueued = d.status === 'queued';

    return `
        <div class="download-card" id="download-${d.id}">
            ${bracket()}
            <div class="flex items-center justify-between">
                <div class="download-title">
                    ${statusDot(d.status)}
                    ${escapeHtml(d.title)}
                    ${formatTitleSuffix(d)}
                    ${typeBadge(d.type)}
                </div>
                ${statusBadge(d.status)}
            </div>
            <div class="download-meta">
                ${d.filename ? `<span style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="file" style="width:14px;height:14px;"></i> ${escapeHtml(d.filename)}</span>` : ''}
                <span>${timeAgo(d.created_at)}</span>
            </div>
            ${(isActive || isPaused || isQueued) ? renderDownloadProgress(d, progress, isActive, isPaused) : ''}
            ${d.status === 'error' ? `<div class="mt-2 text-sm" style="color:var(--destructive);display:flex;align-items:center;gap:4px;"><i data-lucide="triangle-alert" style="width:14px;height:14px;"></i> ${escapeHtml(d.error_msg || 'Unknown error')}</div>
            <div class="download-actions">
                <button class="btn btn-secondary btn-sm" data-action="download-retry" data-id="${d.id}"><i data-lucide="refresh-cw" style="width:14px;height:14px;"></i> Retry</button>
                <button class="btn btn-destructive btn-sm" data-action="download-cancel" data-id="${d.id}"><i data-lucide="x" style="width:14px;height:14px;"></i> Cancel</button>
            </div>` : ''}
        </div>
    `;
}

function renderDownloadProgress(d, progress, isActive, isPaused) {
    const label = isActive ? 'Downloading...' : isPaused ? 'Paused' : 'Waiting in queue';
    return `
        <div class="download-progress">
            <div class="download-progress-header">
                <span>${label}</span>
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
        </div>`;
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
            ${bracket()}
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
                            <th style="height:2.5rem; padding:0 0.5rem; font-weight:500; text-transform:uppercase; color:var(--foreground);">Type</th>
                            <th style="height:2.5rem; padding:0 0.5rem; font-weight:500; text-transform:uppercase; color:var(--foreground); text-align:center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${downloads.length === 0
                            ? '<tr><td colspan="3" style="padding:3rem 0.5rem; text-align:center; color:var(--muted-foreground);">No destinations match your filters.</td></tr>'
                            : downloads.map(d => `
                                <tr class="history-table-row" style="border-bottom:1px solid var(--border); transition:background-color 0.15s ease; height:3rem; cursor:pointer;">
                                    <td style="padding:0.5rem; font-weight:500; color:var(--strong-accent);">
                                        ${escapeHtml(d.title)}${formatTitleSuffix(d)}
                                    </td>
                                    <td style="padding:0.5rem; text-transform:capitalize; color:var(--muted-foreground);">${d.type}</td>
                                    <td style="padding:0.5rem; text-align:center;">${statusDot(d.status)}</td>
                                </tr>
                            `).join('')}
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
            ${renderTab('movies', `<i data-lucide="clapperboard" style="width:16px;height:16px;"></i> Movies (${movies.items?.length || 0})`, true)}
            ${renderTab('tv', `<i data-lucide="tv" style="width:16px;height:16px;"></i> TV Shows (${tv.items?.length || 0})`, false)}
        </div>

        <div id="library-movies" class="card">
            ${bracket()}
            <div class="card-content">
                <div class="text-xs text-muted mb-4">${escapeHtml(movies.root)}</div>
                <div class="file-tree" id="movies-tree">
                    ${movies.items?.length === 0
                        ? '<div class="empty-state" style="padding:2rem;"><p class="text-muted">No movies found</p></div>'
                        : renderFileTree(movies.items)}
                </div>
            </div>
        </div>

        <div id="library-tv" class="card" style="display:none;">
            ${bracket()}
            <div class="card-content">
                <div class="text-xs text-muted mb-4">${escapeHtml(tv.root)}</div>
                <div class="file-tree">
                    ${tv.items?.length === 0
                        ? '<div class="empty-state" style="padding:2rem;"><p class="text-muted">No TV shows found</p></div>'
                        : renderFileTree(tv.items)}
                </div>
            </div>
        </div>
    `;
}

function renderTab(dataTab, labelHtml, isActive) {
    return `
        <button class="tab${isActive ? ' active' : ''}" data-action="switch-library-tab" data-tab="${dataTab}">
            <span class="tab-text" style="display:flex;align-items:center;gap:0.375rem;">${labelHtml}</span>
            <span class="bracket-piece tab-bl"></span><span class="bracket-piece tab-tr"></span>
            <span class="bracket-piece tab-r"></span><span class="bracket-piece tab-br"></span>
        </button>`;
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
                <div class="file-tree-children hidden">${renderFileTree(item.children, depth + 1)}</div>`;
        }
        return `
            <div class="file-tree-item" style="padding-left:${depth * 1.25}rem;">
                <span style="width:0.75rem;display:inline-block;"></span>
                <span style="display:inline-flex;align-items:center;"><i data-lucide="file" style="width:16px;height:16px;color:var(--muted-foreground)"></i></span>
                <span class="file-tree-name">${escapeHtml(item.name)}</span>
                <span class="file-tree-size font-mono">${formatBytes(item.size)}</span>
            </div>`;
    }).join('');
}

function renderSettingsSection(icon, title, subtitle) {
    return `
        <div style="border-bottom: 1px solid var(--border); padding: 1.5rem; background: var(--card-header);">
            <h3 class="font-semibold text-lg flex items-center gap-2">
                <i data-lucide="${icon}" style="width:18px;height:18px;"></i>
                ${title}
            </h3>
            <p class="text-sm text-muted" style="margin-top:0.375rem;">${subtitle}</p>
        </div>`;
}

function renderSettings() {
    return `
        <div class="tabs-list" id="settings-tabs" style="margin-bottom: 1.5rem;">
            <button class="tab active" data-action="switch-settings-tab" data-tab="account">
                <span class="tab-text">Account</span>
                <span class="bracket-piece tab-bl"></span><span class="bracket-piece tab-tr"></span>
                <span class="bracket-piece tab-r"></span><span class="bracket-piece tab-br"></span>
            </button>
            <button class="tab" data-action="switch-settings-tab" data-tab="integrations">
                <span class="tab-text">Integrations</span>
                <span class="bracket-piece tab-bl"></span><span class="bracket-piece tab-tr"></span>
                <span class="bracket-piece tab-r"></span><span class="bracket-piece tab-br"></span>
            </button>
            <button class="tab" data-action="switch-settings-tab" data-tab="automation">
                <span class="tab-text">Automation & Naming</span>
                <span class="bracket-piece tab-bl"></span><span class="bracket-piece tab-tr"></span>
                <span class="bracket-piece tab-r"></span><span class="bracket-piece tab-br"></span>
            </button>
        </div>

        <div id="settings-account-tab">
            <div class="card" style="padding:0; gap:0; margin-bottom:2rem;">
                ${bracket()}
                ${renderSettingsSection('user', 'Account Information', 'Your account details')}
                <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                    <div class="form-group">
                        <label class="label">Username</label>
                        <input class="input" value="admin" disabled style="max-width: 28rem;">
                    </div>
                </div>
            </div>

            <div class="card" style="padding:0; gap:0;">
                ${bracket()}
                ${renderSettingsSection('key-round', 'Change Password', 'Update your password to keep your account secure')}
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
            <div class="card" style="padding:0; gap:0; margin-bottom:2rem;">
                ${bracket()}
                ${renderSettingsSection('boxes', 'Jellyfin Integration', 'Connect to your media server')}
                <div style="padding: 1.5rem;" id="settings-jellyfin">
                    <div class="skeleton" style="height:120px;"></div>
                </div>
            </div>

            <div class="card" style="padding:0; gap:0;">
                ${bracket()}
                ${renderSettingsSection('download-cloud', 'aria2c Configuration', 'Configure your download daemon')}
                <div style="padding: 1.5rem;" id="settings-aria2">
                    <div class="skeleton" style="height:80px;"></div>
                </div>
            </div>
        </div>

        <div id="settings-automation-tab" style="display:none;">
            <div class="card" style="padding:0; gap:0;">
                ${bracket()}
                ${renderSettingsSection('wand-2', 'Automation & Naming', 'Configure naming conventions and search providers')}
                <div style="padding: 1.5rem;" id="settings-automation">
                    <div class="skeleton" style="height:250px;"></div>
                </div>
            </div>
        </div>
    `;
}
