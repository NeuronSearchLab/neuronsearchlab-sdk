type LogLevelName = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
type StructuredLogEntry = {
    level: LogLevelName;
    levelValue: number;
    message: string;
    timestamp: string;
    context?: Record<string, unknown>;
};
type LoggerTransport = (entry: StructuredLogEntry) => void;
type LoggerConfig = {
    /**
     * Global log level. TRACE is the most verbose, FATAL is the most quiet.
     * Defaults to INFO for production-friendly output.
     */
    level?: LogLevelName | number;
    /**
     * When true, request/response bodies will be included in TRACE/DEBUG logs.
     * Remains disabled by default to avoid leaking sensitive data.
     */
    enableNetworkBodyLogging?: boolean;
    /**
     * Enables timing/metric logging around HTTP calls. Disabled by default.
     */
    enablePerformanceLogging?: boolean;
    /**
     * Provide a custom log transport (e.g., ship logs to your own logger).
     * Defaults to console.* for quick observability.
     */
    transport?: LoggerTransport;
    /**
     * Keys (case-sensitive) that should never be emitted. Defaults to common
     * credential keys to guarantee that INFO/WARN/ERROR logs stay safe.
     */
    redactKeys?: string[];
};
declare class SDKLogger {
    private config;
    private levelValue;
    constructor();
    /**
     * Configure the global logger.
     *
     * Development example (verbose logging + payloads):
     * ```ts
     * import {configureLogger} from "@neuronsearchlab/sdk";
     * configureLogger({
     *   level: "TRACE",
     *   enableNetworkBodyLogging: true,
     *   enablePerformanceLogging: true,
     * });
     * ```
     *
     * Production example (safe defaults):
     * ```ts
     * configureLogger({ level: "INFO" });
     * ```
     */
    configure(config?: LoggerConfig): void;
    shouldLog(level: LogLevelName): boolean;
    isPerformanceLoggingEnabled(): boolean;
    canLogNetworkPayloads(level: LogLevelName): boolean;
    trace(message: string, context?: Record<string, unknown>): void;
    debug(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
    fatal(message: string, context?: Record<string, unknown>): void;
    private log;
    private sanitizeContext;
    private toLevelValue;
    private levelValueToName;
}
declare const logger: SDKLogger;
declare const configureLogger: (config: LoggerConfig) => void;

type SDKConfig = {
    baseUrl: string;
    accessToken: string;
    timeoutMs?: number;
    maxRetries?: number;
    fetchImpl?: typeof fetch;
    collateWindowSeconds?: number;
    maxBatchSize?: number;
    maxBufferedEvents?: number;
    maxEventRetries?: number;
    disableArrayBatching?: boolean;
    /**
     * ✅ NEW: request_id propagation
     * If true (default), the SDK will remember the latest request_id returned by
     * /recommendations and automatically attach it to subsequent trackEvent calls
     * (unless you explicitly pass requestId/request_id in the event payload).
     */
    propagateRecommendationRequestId?: boolean;
    /**
     * ✅ NEW: session_id support
     * If provided, SDK uses this session id for all events unless overridden per-event.
     * If not provided, SDK auto-creates a session id (stable for the lifetime of the SDK instance).
     *
     * You can override later via sdk.setSessionId("...") or per-event via payload sessionId/session_id.
     */
    sessionId?: string | null;
    /**
     * If true (default), SDK auto-creates a sessionId when none is provided.
     * Set false if you *never* want the SDK to attach session_id automatically.
     */
    autoSessionId?: boolean;
};
type APIErrorBody = {
    error?: string;
    message?: string;
    code?: string | number;
    details?: unknown;
    [k: string]: unknown;
};
declare class SDKHttpError extends Error {
    status: number;
    statusText: string;
    body?: APIErrorBody | string;
    constructor(msg: string, opts: {
        status: number;
        statusText: string;
        body?: APIErrorBody | string;
    });
}
declare class SDKTimeoutError extends Error {
    timeoutMs: number;
    constructor(timeoutMs: number);
}
type TrackEventPayload = {
    eventId: number;
    userId: number | string;
    itemId: number | string;
    requestId?: string;
    request_id?: string;
    sessionId?: string;
    session_id?: string;
    [k: string]: unknown;
};
type ItemUpsertPayload = {
    itemId: number | string;
    name: string;
    description: string;
    metadata: Record<string, any>;
};
type RecommendationOptions = {
    userId: number | string;
    contextId?: string;
    limit?: number;
};
type AutoRecommendationsOptions = {
    userId: number | string;
    contextId?: string;
    limit?: number;
    cursor?: string;
    windowDays?: number;
    candidateLimit?: number;
    servedCap?: number;
};
type DeleteItemInput = {
    itemId: string | number;
};
type DeleteItemsResponse = {
    message: string;
    itemId?: string | number;
    itemIds: Array<string | number>;
    deletedCount?: number;
    processing_time_ms?: number;
};
type PatchItemInput = {
    itemId: string | number;
    active?: boolean;
    [k: string]: unknown;
};
type PatchItemResponse = {
    message: string;
    itemId: string | number;
    active?: boolean;
    processing_time_ms?: number;
};
type RecommendationsResponse = {
    message?: string;
    request_id?: string;
    embedding_info?: {
        source: string;
        used_default: boolean;
        default_reason?: string | null;
        dimension: number;
        expected_dimension: number;
        averaged_interactions?: number;
    };
    upserted_embedding_row?: {
        tenant_id: string;
        entity_id: string;
        name: string;
        description: string;
        entity_type: string;
        created_at: string;
        last_modified: string;
        embedding: string;
    };
    recommendations: Array<{
        entity_id: string;
        name: string;
        description: string;
        score: number;
        metadata?: Record<string, any>;
        embedding?: number[];
    }>;
    quantity?: number;
    excluded_viewed_items?: {
        value: number | null;
        unit: string;
        interval: string | null;
    } | null;
    processing_time_ms?: number;
    mode?: "auto" | "single" | string;
    section?: {
        section_id: string;
        title: string;
        reason: Record<string, any>;
    } | null;
    next_cursor?: string | null;
    done?: boolean;
};
type Recommendation = {
    itemId: number | string;
    score?: number;
    reason?: string;
    [k: string]: unknown;
};
declare class NeuronSDK {
    private baseUrl;
    private accessToken;
    private timeoutMs;
    private maxRetries;
    private fetchImpl;
    private collateWindowMs;
    private maxBatchSize;
    private maxBufferedEvents;
    private maxEventRetries;
    private disableArrayBatching;
    private eventBuffer;
    private flushTimer;
    private isFlushing;
    private pendingFlushPromise;
    private flushRetryCount;
    private lifecycleListenersRegistered;
    private arrayBatchingRejected;
    private propagateRecommendationRequestId;
    private lastRecommendationRequestId;
    private autoSessionId;
    private sessionId;
    constructor(config: SDKConfig);
    private registerLifecycleFlush;
    setAccessToken(token: string): void;
    setBaseUrl(url: string): void;
    setTimeout(ms: number): void;
    /**
     * ✅ NEW: Let callers manually set/override the current request_id
     * (useful if you want to correlate a whole page session yourself).
     */
    setRequestId(requestId: string | null): void;
    /**
     * ✅ NEW: Read the last request_id captured from /recommendations
     */
    getRequestId(): string | null;
    /**
     * ✅ NEW: Manually set/override the current session id
     * - If set to null/blank, and autoSessionId=true, a new session id will be generated.
     * - If autoSessionId=false, session id will remain null and no session_id is attached unless provided per-event.
     */
    setSessionId(sessionId: string | null): void;
    /**
     * ✅ NEW: Read the current SDK session id (may be null if autoSessionId=false)
     */
    getSessionId(): string | null;
    private getHeaders;
    private request;
    private backoffMs;
    private sleep;
    private scheduleFlush;
    private trimBufferIfNeeded;
    private enqueueEvent;
    flushEvents(options?: {
        useBeacon?: boolean;
    }): Promise<void>;
    private sendBatch;
    private sendIndividually;
    private postEvents;
    /**
     * Track an existing event occurrence.
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
        itemId: number | string;
    }>(data: ItemUpsertPayload): Promise<T>;
    /**
     * ✅ NEW: Patch (partial update) a single item.
     * PATCH /items/{item_id}
     */
    patchItem<T = PatchItemResponse>(input: PatchItemInput): Promise<T>;
    /**
     * Convenience helper: enable/disable item
     */
    setItemActive<T = PatchItemResponse>(itemId: string | number, active: boolean): Promise<T>;
    /**
     * Delete one or more items.
     * DELETE /items
     */
    deleteItems<T = DeleteItemsResponse>(items: DeleteItemInput | DeleteItemInput[]): Promise<T>;
    /**
     * Get recommendations for a user
     * GET /recommendations?user_id=...&context_id=...&quantity=...
     *
     * ✅ Captures request_id for correlation if present.
     */
    getRecommendations(options: RecommendationOptions): Promise<RecommendationsResponse>;
    /**
     * Get the next auto-generated recommendation section.
     * GET /recommendations?mode=auto&user_id=...&cursor=...&quantity=...
     *
     * ✅ Captures request_id for correlation if present.
     */
    getAutoRecommendations(options: AutoRecommendationsOptions): Promise<RecommendationsResponse>;
}

export { type APIErrorBody, type AutoRecommendationsOptions, type DeleteItemInput, type DeleteItemsResponse, type ItemUpsertPayload, type LogLevelName as LogLevel, type LoggerConfig, type LoggerTransport, NeuronSDK, type PatchItemInput, type PatchItemResponse, type Recommendation, type RecommendationOptions, type RecommendationsResponse, type SDKConfig, SDKHttpError, SDKTimeoutError, type StructuredLogEntry, type TrackEventPayload, configureLogger, NeuronSDK as default, logger };
