const LEVEL_VALUES = {
    TRACE: 10,
    DEBUG: 20,
    INFO: 30,
    WARN: 40,
    ERROR: 50,
    FATAL: 60,
};
const DEFAULT_CONFIG = {
    level: "INFO",
    enableNetworkBodyLogging: false,
    enablePerformanceLogging: false,
    redactKeys: ["accessToken", "authorization", "Authorization"],
    transport(entry) {
        const method = entry.level === "TRACE" || entry.level === "DEBUG"
            ? "debug"
            : entry.level === "INFO"
                ? "info"
                : entry.level === "WARN"
                    ? "warn"
                    : "error";
        const prefix = `[NeuronSDK][${entry.level}] ${entry.message}`;
        if (entry.context && Object.keys(entry.context).length > 0) {
            console[method]?.(prefix, entry.context);
        }
        else {
            console[method]?.(prefix);
        }
    },
};
const NETWORK_BODY_KEYS = new Set(["requestBody", "responseBody"]);
export class SDKLogger {
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
        this.levelValue = this.toLevelValue(this.config.level);
    }
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
    configure(config = {}) {
        this.config = {
            ...this.config,
            ...config,
            transport: config.transport ?? this.config.transport,
            redactKeys: config.redactKeys ?? this.config.redactKeys,
        };
        if (config.level !== undefined) {
            this.levelValue = this.toLevelValue(config.level);
            this.config.level = this.levelValueToName(this.levelValue);
        }
    }
    shouldLog(level) {
        return this.toLevelValue(level) >= this.levelValue;
    }
    isPerformanceLoggingEnabled() {
        return this.config.enablePerformanceLogging && this.shouldLog("DEBUG");
    }
    canLogNetworkPayloads(level) {
        return (this.config.enableNetworkBodyLogging &&
            this.shouldLog(level) &&
            this.toLevelValue(level) <= this.toLevelValue("DEBUG"));
    }
    trace(message, context) {
        this.log("TRACE", message, context);
    }
    debug(message, context) {
        this.log("DEBUG", message, context);
    }
    info(message, context) {
        this.log("INFO", message, context);
    }
    warn(message, context) {
        this.log("WARN", message, context);
    }
    error(message, context) {
        this.log("ERROR", message, context);
    }
    fatal(message, context) {
        this.log("FATAL", message, context);
    }
    log(level, message, context) {
        if (!this.shouldLog(level))
            return;
        const entry = {
            level,
            levelValue: this.toLevelValue(level),
            message,
            timestamp: new Date().toISOString(),
            context: this.sanitizeContext(level, context),
        };
        this.config.transport(entry);
    }
    sanitizeContext(level, context) {
        if (!context)
            return undefined;
        const sanitized = {};
        for (const [key, value] of Object.entries(context)) {
            if (this.config.redactKeys.includes(key)) {
                sanitized[key] = "[REDACTED]";
                continue;
            }
            if (NETWORK_BODY_KEYS.has(key) &&
                !(this.canLogNetworkPayloads(level) && typeof value !== "undefined")) {
                continue;
            }
            sanitized[key] = value;
        }
        return Object.keys(sanitized).length > 0 ? sanitized : undefined;
    }
    toLevelValue(level) {
        if (typeof level === "number") {
            return level;
        }
        return LEVEL_VALUES[level];
    }
    levelValueToName(value) {
        const found = Object.entries(LEVEL_VALUES).find(([, v]) => v === value);
        return found?.[0] ?? "INFO";
    }
}
export const logger = new SDKLogger();
export const configureLogger = (config) => logger.configure(config);
