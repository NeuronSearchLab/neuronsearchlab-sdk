export type SDKConfig = {
    baseUrl: string;
    accessToken: string;
    timeoutMs?: number;
    maxRetries?: number;
    fetchImpl?: typeof fetch;
};
export type APIErrorBody = {
    error?: string;
    message?: string;
    code?: string | number;
    details?: unknown;
    [k: string]: unknown;
};
export declare class SDKHttpError extends Error {
    status: number;
    statusText: string;
    body?: APIErrorBody | string;
    constructor(msg: string, opts: {
        status: number;
        statusText: string;
        body?: APIErrorBody | string;
    });
}
export declare class SDKTimeoutError extends Error {
    timeoutMs: number;
    constructor(timeoutMs: number);
}
export type TrackEventPayload = {
    eventId: number;
    userId: number;
    itemId: number;
    metadata: Record<string, any>;
};
export type ItemUpsertPayload = {
    itemId: number;
    name: string;
    description: string;
    metadata: Record<string, any>;
};
export type RecommendationOptions = {
    userId: number;
    contextId?: string;
    limit?: number;
};
export type Recommendation = {
    itemId: number | string;
    score?: number;
    reason?: string;
    [k: string]: unknown;
};
export declare class NeuronSDK {
    private baseUrl;
    private accessToken;
    private timeoutMs;
    private maxRetries;
    private fetchImpl;
    constructor(config: SDKConfig);
    setAccessToken(token: string): void;
    setBaseUrl(url: string): void;
    setTimeout(ms: number): void;
    private getHeaders;
    private request;
    private backoffMs;
    private sleep;
    /**
     * Track an existing event occurrence.
     * This does NOT create event definitions; it records that a pre-defined event happened.
     * POST /events
     */
    trackEvent<T = {
        success: true;
        id?: number;
    }>(data: TrackEventPayload): Promise<T>;
    /**
     * @deprecated Use trackEvent(). Kept for backwards compatibility.
     */
    createEvent<T = {
        success: true;
        id?: number;
    }>(data: TrackEventPayload): Promise<T>;
    /**
     * Create or update an item
     * POST /items
     */
    upsertItem<T = {
        success: true;
        itemId: number;
    }>(data: ItemUpsertPayload): Promise<T>;
    /**
     * Get recommendations for a user, optionally with a context ID and limit
     * GET /recommendations?user_id=...&context_id=...&limit=...
     */
    getRecommendations<T = Recommendation[]>(options: RecommendationOptions): Promise<T>;
}
export default NeuronSDK;
