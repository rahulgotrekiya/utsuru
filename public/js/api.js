/* API Client — all fetch calls to the backend */

const API = {
    async request(url, options = {}) {
        const defaults = {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
        };
        const response = await fetch(url, { ...defaults, ...options });
        if (response.status === 401) {
            showLogin();
            throw new Error('Session expired');
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Request failed');
        return data;
    },

    /* Auth */
    login: (username, password) =>
        API.request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    logout: () =>
        API.request('/api/auth/logout', { method: 'POST' }),
    me: () =>
        API.request('/api/auth/me'),

    /* Stats */
    getStats: () => API.request('/api/stats'),
    getChartData: () => API.request('/api/stats/chart'),
    getRecent: () => API.request('/api/stats/recent'),

    /* Downloads */
    getDownloads: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return API.request(`/api/downloads?${qs}`);
    },
    createDownload: (data) =>
        API.request('/api/downloads', { method: 'POST', body: JSON.stringify(data) }),
    getDownload: (id) =>
        API.request(`/api/downloads/${id}`),
    updateDownload: (id, action) =>
        API.request(`/api/downloads/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
    deleteDownload: (id) =>
        API.request(`/api/downloads/${id}`, { method: 'DELETE' }),

    /* Library */
    getMovies: () => API.request('/api/library/movies'),
    getTv: () => API.request('/api/library/tv'),
    getLibraryStats: () => API.request('/api/library/stats'),

    /* Jellyfin */
    scanJellyfin: () =>
        API.request('/api/jellyfin/scan', { method: 'POST' }),
    jellyfinStatus: () =>
        API.request('/api/jellyfin/status'),

    /* Settings */
    getSettings: () => API.request('/api/settings'),
    updateSettings: (data) =>
        API.request('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
};
