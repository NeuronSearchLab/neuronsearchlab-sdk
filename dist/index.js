// src/index.ts
export class SDKHttpError extends Error {
    constructor(msg, opts) {
        super(msg);
        this.name = "SDKHttpError";
        this.status = opts.status;
        this.statusText = opts.statusText;
        this.body = opts.body;
    }
}
export class SDKTimeoutError extends Error {
    constructor(timeoutMs) {
        super(`Request timed out after ${timeoutMs} ms`);
        this.timeoutMs = timeoutMs;
        this.name = "SDKTimeoutError";
    }
}
export class NeuronSDK {
    constructor(config) {
        if (!config.baseUrl || !config.accessToken) {
            throw new Error("baseUrl and accessToken are required");
        }
        this.baseUrl = config.baseUrl.replace(/\/+$/, ""); // trim trailing slashes
        this.accessToken = config.accessToken;
        this.timeoutMs = config.timeoutMs ?? 10000;
        this.maxRetries = config.maxRetries ?? 2;
        this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
        if (!this.fetchImpl) {
            throw new Error("fetch is not available in this environment. Provide config.fetchImpl (e.g., undici or node-fetch).");
        }
    }
    setAccessToken(token) {
        this.accessToken = token;
    }
    setBaseUrl(url) {
        this.baseUrl = url.replace(/\/+$/, "");
    }
    setTimeout(ms) {
        this.timeoutMs = ms;
    }
    getHeaders(extra) {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.accessToken}`,
            ...(extra ?? {}),
        };
    }
    // Core request with timeout + retry (429/5xx + timeouts)
    async request(pathOrUrl, init = {}) {
        const isAbs = /^https?:\/\//i.test(pathOrUrl);
        const url = isAbs
            ? pathOrUrl
            : `${this.baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
        const retryOn = init.retryOn ?? [429, 500, 502, 503, 504];
        let attempt = 0;
        while (true) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
            try {
                const res = await this.fetchImpl(url, {
                    ...init,
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (res.ok) {
                    const text = await res.text();
                    if (!text)
                        return undefined;
                    try {
                        return JSON.parse(text);
                    }
                    catch {
                        return text; // non-JSON payloads
                    }
                }
                const raw = await res.text().catch(() => "");
                let body;
                try {
                    body = raw ? JSON.parse(raw) : undefined;
                }
                catch {
                    body = raw;
                }
                if (retryOn.includes(res.status) && attempt < this.maxRetries) {
                    attempt++;
                    const retryAfter = res.headers.get("retry-after");
                    const delay = retryAfter && !Number.isNaN(Number(retryAfter))
                        ? Number(retryAfter) * 1000
                        : this.backoffMs(attempt);
                    await this.sleep(delay);
                    continue;
                }
                const msg = `HTTP ${res.status} ${res.statusText} for ${init.method ?? "GET"} ${url}`;
                throw new SDKHttpError(msg, {
                    status: res.status,
                    statusText: res.statusText,
                    body,
                });
            }
            catch (err) {
                clearTimeout(timeout);
                if (err?.name === "AbortError") {
                    if (attempt < this.maxRetries) {
                        attempt++;
                        await this.sleep(this.backoffMs(attempt));
                        continue;
                    }
                    throw new SDKTimeoutError(this.timeoutMs);
                }
                // transient network errors
                if (attempt < this.maxRetries) {
                    attempt++;
                    await this.sleep(this.backoffMs(attempt));
                    continue;
                }
                throw err;
            }
        }
    }
    backoffMs(attempt) {
        // 300ms, 600ms, 1200ms ... + jitter
        const base = 300 * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 200;
        return base + jitter;
    }
    sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
    // ----------------- Public API -----------------
    /**
     * Track an existing event occurrence.
     * This does NOT create event definitions; it records that a pre-defined event happened.
     * POST /events
     */
    async trackEvent(data) {
        if (!data ||
            typeof data.eventId !== "number" ||
            typeof data.userId !== "number" ||
            typeof data.itemId !== "number") {
            throw new Error("eventId, userId, and itemId are required numbers");
        }
        return this.request("/events", {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        });
    }
    /**
     * @deprecated Use trackEvent(). Kept for backwards compatibility.
     */
    async createEvent(data) {
        return this.trackEvent(data);
    }
    /**
     * Create or update an item
     * POST /items
     */
    async upsertItem(data) {
        return this.request("/items", {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        });
    }
    /**
     * Get recommendations for a user, optionally with a context ID and limit
     * GET /recommendations?user_id=...&context_id=...&limit=...
     */
    async getRecommendations(options) {
        const { userId, contextId, limit } = options;
        if (typeof userId !== "number")
            throw new Error("userId must be a number");
        const url = new URL(`${this.baseUrl}/recommendations`);
        url.searchParams.set("user_id", String(userId));
        if (contextId)
            url.searchParams.set("context_id", contextId);
        if (typeof limit === "number")
            url.searchParams.set("limit", String(limit));
        return this.request(url.toString(), {
            method: "GET",
            headers: this.getHeaders(),
        });
    }
}
export default NeuronSDK;
