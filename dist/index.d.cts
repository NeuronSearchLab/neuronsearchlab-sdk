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
        itemId: number | string;
    }>(data: ItemUpsertPayload): Promise<T>;
    /**
     * Delete one or more items.
     * DELETE /items
     */
    deleteItems<T = DeleteItemsResponse>(items: DeleteItemInput | DeleteItemInput[]): Promise<T>;
    /**
     * Get recommendations for a user, optionally with a context ID and limit
     * GET /recommendations?user_id=...&context_id=...&limit=...
     */
    getRecommendations<T = Recommendation[]>(options: RecommendationOptions): Promise<T>;
}

export { type APIErrorBody, type DeleteItemInput, type DeleteItemsResponse, type ItemUpsertPayload, type LogLevelName as LogLevel, type LoggerConfig, type LoggerTransport, NeuronSDK, type Recommendation, type RecommendationOptions, type SDKConfig, SDKHttpError, SDKTimeoutError, type StructuredLogEntry, type TrackEventPayload, configureLogger, NeuronSDK as default, logger };
