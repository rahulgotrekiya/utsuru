import sanitizeHtml from 'sanitize-html';
import validator from 'validator';

/**
 * Sanitize a text string — strips all HTML tags and trims whitespace.
 * Used for movie titles, show names, etc to prevent XSS.
 */
export function sanitizeText(input) {
    if (typeof input !== 'string') return '';
    return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}

/**
 * Validate a download URL.
 * - Must be a valid URL
 * - Must use http or https protocol (blocks file://, javascript:, data:, etc)
 * - Must not contain shell metacharacters
 */
export function validateDownloadUrl(url) {
    if (typeof url !== 'string') return { valid: false, error: 'URL must be a string' };

    const trimmed = url.trim();

    if (!trimmed) return { valid: false, error: 'URL is required' };

    // Check for valid URL format with only http/https
    if (!validator.isURL(trimmed, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_valid_protocol: true,
        allow_underscores: true,
    })) {
        return { valid: false, error: 'Invalid URL. Only http:// and https:// URLs are allowed.' };
    }

    // Block suspicious patterns that could be used for injection
    const dangerousPatterns = [
        /[;&|`$(){}]/,           // Shell metacharacters
        /\.\.\//,                 // Path traversal
        /%2e%2e/i,               // Encoded path traversal
        /<script/i,              // Script injection
        /javascript:/i,          // JS protocol
        /data:/i,                // Data protocol
        /vbscript:/i,            // VBScript protocol
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(trimmed)) {
            return { valid: false, error: 'URL contains potentially dangerous characters' };
        }
    }

    return { valid: true, url: trimmed };
}

/**
 * Sanitize a filename — removes any character that could be dangerous
 * in a filesystem path. Allows letters, numbers, spaces, hyphens,
 * underscores, dots, and parentheses.
 */
export function sanitizeFilename(name) {
    if (typeof name !== 'string') return '';
    // Strip HTML first
    let clean = sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} }).trim();
    // Remove any characters except alphanumeric, space, -, _, ., (, )
    clean = clean.replace(/[^a-zA-Z0-9\s\-_.()\[\]']/g, '');
    // Collapse multiple spaces
    clean = clean.replace(/\s+/g, ' ').trim();
    // Prevent empty result
    return clean || 'untitled';
}

/**
 * Validate numeric input (year, season, episode)
 */
export function validateNumber(input, { min = 0, max = 99999, name = 'Value' } = {}) {
    const num = Number(input);
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
        return { valid: false, error: `${name} must be a whole number` };
    }
    if (num < min || num > max) {
        return { valid: false, error: `${name} must be between ${min} and ${max}` };
    }
    return { valid: true, value: num };
}

/**
 * Format string replacing placeholders like {Title}, {Year}, {Season}, {Episode}
 */
export function formatMediaName(template, data) {
    let result = template || '';
    const title = sanitizeFilename(data.title);
    result = result.replace(/\{Title\}/gi, title);
    
    if (data.year) {
        result = result.replace(/\{Year\}/gi, data.year);
    } else {
        // Remove year and surrounding parens/spaces if year is missing
        result = result.replace(/\s*\(\{Year\}\)/gi, '');
        result = result.replace(/\{Year\}/gi, '');
    }
    
    if (data.season !== undefined) {
        result = result.replace(/\{Season\}/gi, String(data.season).padStart(2, '0'));
    }
    if (data.episode !== undefined) {
        result = result.replace(/\{Episode\}/gi, String(data.episode).padStart(2, '0'));
    }
    
    return sanitizeFilename(result).trim();
}

/**
 * Build a safe media file path. Never uses string interpolation into shell commands.
 * Returns { dirPath, dirName, fileNameBase } with sanitized components.
 */
export function buildMediaPath(mediaRoot, download, formats = {}) {
    if (download.type === 'movie') {
        const folderFormat = formats.movie_folder_format || '{Title} ({Year})';
        const fileFormat = formats.movie_file_format || '{Title} ({Year})';
        
        const dirName = formatMediaName(folderFormat, download);
        const fileNameBase = formatMediaName(fileFormat, download);
        const dirPath = `${mediaRoot}/${dirName}`;
        
        return { dirPath, dirName, fileNameBase };
    }

    if (download.type === 'tv') {
        const folderFormat = formats.tv_folder_format || '{Title}';
        const fileFormat = formats.tv_file_format || '{Title} - S{Season}E{Episode}';
        
        const dirName = formatMediaName(folderFormat, download);
        const season = String(download.season || 1).padStart(2, '0');
        const dirPath = `${mediaRoot}/${dirName}/Season ${season}`;
        const fileNameBase = formatMediaName(fileFormat, download);
        
        return { dirPath, dirName, fileNameBase };
    }

    throw new Error('Invalid download type');
}
