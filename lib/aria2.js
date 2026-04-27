/**
 * aria2c JSON-RPC Client
 * Communicates with aria2c daemon via HTTP JSON-RPC
 */

const ARIA2_URL = process.env.ARIA2_RPC_URL || 'http://localhost:6800/jsonrpc';
const ARIA2_SECRET = process.env.ARIA2_RPC_SECRET || '';

let rpcId = 0;

async function rpcCall(method, params = []) {
    rpcId++;
    const tokenParams = ARIA2_SECRET ? [`token:${ARIA2_SECRET}`, ...params] : params;

    try {
        const response = await fetch(ARIA2_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: String(rpcId),
                method,
                params: tokenParams,
            }),
            signal: AbortSignal.timeout(10000),
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message || 'aria2c RPC error');
        }
        return data.result;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('aria2c RPC timeout — is aria2c running?');
        }
        throw err;
    }
}

/**
 * Add a download URL to aria2c
 * @param {string} url - Download URL
 * @param {string} dir - Target directory
 * @param {string} [filename] - Optional filename
 * @returns {string} GID (download identifier)
 */
export async function addDownload(url, dir, filename) {
    const options = { dir };
    if (filename) options.out = filename;
    return rpcCall('aria2.addUri', [[url], options]);
}

/**
 * Get status of a download by GID
 */
export async function getStatus(gid) {
    const status = await rpcCall('aria2.tellStatus', [gid]);
    return {
        gid: status.gid,
        status: status.status, // active, waiting, paused, error, complete, removed
        totalLength: Number(status.totalLength || 0),
        completedLength: Number(status.completedLength || 0),
        downloadSpeed: Number(status.downloadSpeed || 0),
        errorCode: status.errorCode,
        errorMessage: status.errorMessage,
        files: (status.files || []).map(f => ({
            path: f.path,
            length: Number(f.length || 0),
            completedLength: Number(f.completedLength || 0),
        })),
    };
}

/**
 * Pause a download
 */
export async function pauseDownload(gid) {
    return rpcCall('aria2.pause', [gid]);
}

/**
 * Resume a paused download
 */
export async function resumeDownload(gid) {
    return rpcCall('aria2.unpause', [gid]);
}

/**
 * Cancel/remove a download
 */
export async function cancelDownload(gid) {
    try {
        return await rpcCall('aria2.remove', [gid]);
    } catch {
        // If the download is already complete or removed, force remove
        return rpcCall('aria2.removeDownloadResult', [gid]);
    }
}

/**
 * Get all active downloads
 */
export async function getActiveDownloads() {
    return rpcCall('aria2.tellActive');
}

/**
 * Get global aria2c stats
 */
export async function getGlobalStats() {
    return rpcCall('aria2.getGlobalStat');
}

/**
 * Check if aria2c is reachable
 */
export async function isAvailable() {
    try {
        await rpcCall('aria2.getVersion');
        return true;
    } catch {
        return false;
    }
}
