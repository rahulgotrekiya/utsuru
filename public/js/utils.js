/* Shared utility functions, formatters, and reusable UI helpers */

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
    return `${Math.floor(hours / 24)}d ago`;
}

/* Reusable UI element generators */

function bracket() {
    return '<div class="card-bracket">'
        + '<span class="cb-tl-h"></span><span class="cb-tl-v"></span>'
        + '<span class="cb-tr-h"></span><span class="cb-tr-v"></span>'
        + '<span class="cb-bl-h"></span><span class="cb-bl-v"></span>'
        + '<span class="cb-br-h"></span><span class="cb-br-v"></span>'
        + '</div>';
}

function statusBadge(status) {
    const map = {
        queued:      { cls: 'badge-info',    label: 'Queued' },
        downloading: { cls: 'badge-success', label: 'Downloading' },
        paused:      { cls: 'badge-warning', label: 'Paused' },
        complete:    { cls: 'badge-success', label: 'Complete' },
        error:       { cls: 'badge-error',   label: 'Error' },
    };
    const s = map[status] || { cls: 'badge-muted', label: status };
    return `<span class="badge ${s.cls}">${s.label}</span>`;
}

function statusDot(status) {
    const map = {
        queued: 'info', downloading: 'success', paused: 'warning',
        complete: 'success', error: 'error',
    };
    const variant = map[status] || 'neutral';
    const pulse = ['downloading', 'queued'].includes(status) ? '<span class="pulse"></span>' : '';
    return `<span class="status-dot ${variant}">${pulse}<span class="dot"></span></span>`;
}

function typeBadge(type) {
    const icon = type === 'movie' ? 'clapperboard' : 'tv';
    const cls = type === 'movie' ? 'badge-accent' : 'badge-info';
    const label = type === 'movie' ? 'Movie' : 'TV';
    return `<span class="badge ${cls}" style="display:inline-flex;align-items:center;gap:4px;">`
        + `<i data-lucide="${icon}" style="width:12px;height:12px;"></i> ${label}</span>`;
}

/* Toast notifications */
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

/* Custom Select (replaces native <select> with styled version) */
function initCustomSelects() {
    document.querySelectorAll('select.select').forEach(select => {
        if (select.dataset.customized) return;
        select.dataset.customized = 'true';
        select.style.display = 'none';

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.width = select.style.width || select.style.maxWidth || '100%';
        wrapper.style.maxWidth = select.style.maxWidth;

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        trigger.style.height = select.style.height;
        trigger.innerHTML = `<span style="text-transform:capitalize;">${select.options[select.selectedIndex]?.text || ''}</span>`
            + ' <i data-lucide="chevron-down" style="width:14px;height:14px;color:var(--muted-foreground);"></i>';

        const dropdown = document.createElement('div');
        dropdown.className = 'custom-select-dropdown';

        Array.from(select.options).forEach(opt => {
            const item = document.createElement('div');
            item.className = 'custom-select-item';
            if (opt.value === select.value) item.classList.add('selected');
            item.textContent = opt.text;
            item.dataset.value = opt.value;

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                select.value = opt.value;
                trigger.querySelector('span').textContent = opt.text;
                Array.from(dropdown.children).forEach(c => c.classList.remove('selected'));
                item.classList.add('selected');
                dropdown.style.display = 'none';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            });
            dropdown.appendChild(item);
        });

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'block';
            document.querySelectorAll('.custom-select-dropdown').forEach(d => d.style.display = 'none');
            dropdown.style.display = isVisible ? 'none' : 'block';
        });

        wrapper.appendChild(trigger);
        wrapper.appendChild(dropdown);
        select.parentNode.insertBefore(wrapper, select.nextSibling);
    });

    if (!window.__customSelectListener) {
        window.__customSelectListener = true;
        window.addEventListener('click', () => {
            document.querySelectorAll('.custom-select-dropdown').forEach(d => d.style.display = 'none');
        });
    }
}

/* Lucide Icons Refresh */
function refreshIcons() {
    initCustomSelects();
    if (window.lucide) {
        try { window.lucide.createIcons(); } catch { /* ignore */ }
    }
}
