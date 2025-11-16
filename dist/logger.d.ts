export type LogLevelName = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
export type StructuredLogEntry = {
    level: LogLevelName;
    levelValue: number;
    message: string;
    timestamp: string;
    context?: Record<string, unknown>;
};
export type LoggerTransport = (entry: StructuredLogEntry) => void;
export type LoggerConfig = {
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
export declare class SDKLogger {
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
export declare const logger: SDKLogger;
export declare const configureLogger: (config: LoggerConfig) => void;
export type { LogLevelName as LogLevel };
