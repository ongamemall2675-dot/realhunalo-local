// ================================================================
// CACHE UTILITY - API Response Caching
// ================================================================

/**
 * Simple in-memory cache with TTL (Time To Live)
 * Reduces redundant API calls and improves performance
 */
export class Cache {
    constructor(defaultTTL = 3600000) { // Default 1 hour
        this.cache = new Map();
        this.defaultTTL = defaultTTL;
    }

    /**
     * Generate cache key from parameters
     */
    generateKey(prefix, params) {
        const sortedParams = Object.keys(params)
            .sort()
            .map(key => `${key}:${params[key]}`)
            .join('|');
        return `${prefix}:${sortedParams}`;
    }

    /**
     * Set cache entry with optional TTL
     */
    set(key, value, ttl = this.defaultTTL) {
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, {
            value,
            expiresAt
        });
        console.log(`💾 Cache SET: ${key} (expires in ${(ttl / 1000).toFixed(0)}s)`);
    }

    /**
     * Get cache entry if not expired
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            console.log(`📭 Cache MISS: ${key}`);
            return null;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            console.log(`⏰ Cache EXPIRED: ${key}`);
            this.cache.delete(key);
            return null;
        }

        console.log(`✅ Cache HIT: ${key}`);
        return entry.value;
    }

    /**
     * Check if key exists and is not expired
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Delete specific cache entry
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            console.log(`🗑️ Cache DELETE: ${key}`);
        }
        return deleted;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`🧹 Cache CLEARED: ${size} entries removed`);
    }

    /**
     * Remove all expired entries
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            console.log(`🧹 Cache CLEANUP: ${removed} expired entries removed`);
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const now = Date.now();
        let active = 0;
        let expired = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                expired++;
            } else {
                active++;
            }
        }

        return {
            total: this.cache.size,
            active,
            expired,
            memorySize: this.cache.size
        };
    }
}

// ================================================================
// SPECIALIZED CACHES
// ================================================================

/**
 * Image generation cache
 * TTL: 1 hour (images rarely change for same prompt)
 */
export const imageCache = new Cache(3600000);

/**
 * Motion generation cache
 * TTL: 2 hours (motion videos are expensive to generate)
 */
export const motionCache = new Cache(7200000);

/**
 * TTS cache
 * TTL: 30 minutes (voice settings may change)
 */
export const ttsCache = new Cache(1800000);

/**
 * AI analysis cache
 * TTL: 1 hour (script analysis results are stable)
 */
export const aiCache = new Cache(3600000);

// ================================================================
// CACHE MANAGEMENT
// ================================================================

/**
 * Periodic cleanup (runs every 5 minutes)
 */
setInterval(() => {
    imageCache.cleanup();
    motionCache.cleanup();
    ttsCache.cleanup();
    aiCache.cleanup();
}, 300000);

/**
 * Get all cache statistics
 */
export function getAllCacheStats() {
    return {
        image: imageCache.getStats(),
        motion: motionCache.getStats(),
        tts: ttsCache.getStats(),
        ai: aiCache.getStats()
    };
}

/**
 * Clear all caches
 */
export function clearAllCaches() {
    imageCache.clear();
    motionCache.clear();
    ttsCache.clear();
    aiCache.clear();
}

console.log("✅ Cache System Initialized");
