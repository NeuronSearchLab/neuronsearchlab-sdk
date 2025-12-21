"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  NeuronSDK: () => NeuronSDK,
  SDKHttpError: () => SDKHttpError,
  SDKTimeoutError: () => SDKTimeoutError,
  configureLogger: () => configureLogger,
  default: () => index_default,
  logger: () => logger
});
module.exports = __toCommonJS(index_exports);

// src/logger.ts
var LEVEL_VALUES = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60
};
var DEFAULT_CONFIG = {
  level: "INFO",
  enableNetworkBodyLogging: false,
  enablePerformanceLogging: false,
  redactKeys: ["accessToken", "authorization", "Authorization"],
  transport(entry) {
    const method = entry.level === "TRACE" || entry.level === "DEBUG" ? "debug" : entry.level === "INFO" ? "info" : entry.level === "WARN" ? "warn" : "error";
    const prefix = `[NeuronSDK][${entry.level}] ${entry.message}`;
    if (entry.context && Object.keys(entry.context).length > 0) {
      console[method]?.(prefix, entry.context);
    } else {
      console[method]?.(prefix);
    }
  }
};
var NETWORK_BODY_KEYS = /* @__PURE__ */ new Set(["requestBody", "responseBody"]);
var SDKLogger = class {
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
      redactKeys: config.redactKeys ?? this.config.redactKeys
    };
    if (config.level !== void 0) {
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
    return this.config.enableNetworkBodyLogging && this.shouldLog(level) && this.toLevelValue(level) <= this.toLevelValue("DEBUG");
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
    if (!this.shouldLog(level)) return;
    const entry = {
      level,
      levelValue: this.toLevelValue(level),
      message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      context: this.sanitizeContext(level, context)
    };
    this.config.transport(entry);
  }
  sanitizeContext(level, context) {
    if (!context) return void 0;
    const sanitized = {};
    for (const [key, value] of Object.entries(context)) {
      if (this.config.redactKeys.includes(key)) {
        sanitized[key] = "[REDACTED]";
        continue;
      }
      if (NETWORK_BODY_KEYS.has(key) && !(this.canLogNetworkPayloads(level) && typeof value !== "undefined")) {
        continue;
      }
      sanitized[key] = value;
    }
    return Object.keys(sanitized).length > 0 ? sanitized : void 0;
  }
  toLevelValue(level) {
    if (typeof level === "number") {
      return level;
    }
    return LEVEL_VALUES[level];
  }
  levelValueToName(value) {
    const found = Object.entries(LEVEL_VALUES).find(
      ([, v]) => v === value
    );
    return found?.[0] ?? "INFO";
  }
};
var logger = new SDKLogger();
var configureLogger = (config) => logger.configure(config);

// src/index.ts
var SDKHttpError = class extends Error {
  constructor(msg, opts) {
    super(msg);
    this.name = "SDKHttpError";
    this.status = opts.status;
    this.statusText = opts.statusText;
    this.body = opts.body;
  }
};
var SDKTimeoutError = class extends Error {
  constructor(timeoutMs) {
    super(`Request timed out after ${timeoutMs} ms`);
    this.timeoutMs = timeoutMs;
    this.name = "SDKTimeoutError";
  }
};
var NeuronSDK = class {
  constructor(config) {
    this.eventBuffer = [];
    this.flushTimer = null;
    this.isFlushing = false;
    this.pendingFlushPromise = null;
    this.flushRetryCount = 0;
    this.lifecycleListenersRegistered = false;
    this.arrayBatchingRejected = false;
    if (!config.baseUrl || !config.accessToken) {
      throw new Error("baseUrl and accessToken are required");
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.accessToken = config.accessToken;
    this.timeoutMs = config.timeoutMs ?? 1e4;
    this.maxRetries = config.maxRetries ?? 2;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.collateWindowMs = (config.collateWindowSeconds ?? 3) * 1e3;
    this.maxBatchSize = config.maxBatchSize ?? 200;
    this.maxBufferedEvents = config.maxBufferedEvents ?? 5e3;
    this.maxEventRetries = config.maxEventRetries ?? 5;
    this.disableArrayBatching = Boolean(config.disableArrayBatching);
    if (!this.fetchImpl) {
      throw new Error(
        "fetch is not available in this environment. Provide config.fetchImpl (e.g., undici or node-fetch)."
      );
    }
    this.registerLifecycleFlush();
  }
  registerLifecycleFlush() {
    if (this.lifecycleListenersRegistered) return;
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      const handler = () => {
        void this.flushEvents({ useBeacon: true });
      };
      window.addEventListener("beforeunload", handler);
      window.addEventListener("pagehide", handler);
      window.addEventListener("visibilitychange", () => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          handler();
        }
      });
      this.lifecycleListenersRegistered = true;
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
      ...extra ?? {}
    };
  }
  // Core request with timeout + retry (429/5xx + timeouts)
  async request(pathOrUrl, init = {}) {
    const method = init.method ?? "GET";
    const isAbs = /^https?:\/\//i.test(pathOrUrl);
    const url = isAbs ? pathOrUrl : `${this.baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
    const retryOn = init.retryOn ?? [429, 500, 502, 503, 504];
    let attempt = 0;
    const requestId = logger.shouldLog("DEBUG") || logger.isPerformanceLoggingEnabled() ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` : void 0;
    while (true) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const startTime = logger.isPerformanceLoggingEnabled() ? Date.now() : 0;
      if (logger.shouldLog("DEBUG")) {
        logger.debug("HTTP request attempt", {
          method,
          url,
          attempt,
          maxRetries: this.maxRetries,
          retryOn,
          requestId,
          requestBody: typeof init.body === "string" ? init.body : void 0
        });
      }
      try {
        const res = await this.fetchImpl(url, {
          ...init,
          signal: controller.signal
        });
        clearTimeout(timeout);
        const durationMs = startTime ? Date.now() - startTime : void 0;
        if (res.ok) {
          const text = await res.text();
          if (logger.shouldLog("DEBUG")) {
            logger.debug("HTTP response received", {
              method,
              url,
              attempt,
              status: res.status,
              requestId,
              durationMs
            });
          }
          if (text && logger.shouldLog("TRACE")) {
            logger.trace("HTTP response payload", {
              method,
              url,
              requestId,
              responseBody: text
            });
          }
          if (!text) return void 0;
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        }
        const raw = await res.text().catch(() => "");
        if (logger.shouldLog("WARN")) {
          logger.warn("HTTP response not OK", {
            method,
            url,
            attempt,
            status: res.status,
            statusText: res.statusText,
            requestId,
            durationMs,
            responseBody: raw
          });
        }
        let body;
        try {
          body = raw ? JSON.parse(raw) : void 0;
        } catch {
          body = raw;
        }
        if (retryOn.includes(res.status) && attempt < this.maxRetries) {
          attempt++;
          const retryAfter = res.headers.get("retry-after");
          const delay = retryAfter && !Number.isNaN(Number(retryAfter)) ? Number(retryAfter) * 1e3 : this.backoffMs(attempt);
          if (logger.shouldLog("INFO")) {
            logger.info("Retrying request after HTTP status", {
              method,
              url,
              attempt,
              status: res.status,
              delayMs: delay,
              requestId
            });
          }
          await this.sleep(delay);
          continue;
        }
        const msg = `HTTP ${res.status} ${res.statusText} for ${method} ${url}`;
        throw new SDKHttpError(msg, {
          status: res.status,
          statusText: res.statusText,
          body
        });
      } catch (err) {
        clearTimeout(timeout);
        if (err?.name === "AbortError") {
          if (attempt < this.maxRetries) {
            attempt++;
            if (logger.shouldLog("WARN")) {
              logger.warn("Retrying request after timeout", {
                method,
                url,
                attempt,
                timeoutMs: this.timeoutMs,
                requestId
              });
            }
            await this.sleep(this.backoffMs(attempt));
            continue;
          }
          logger.error("Request aborted after max retries", {
            method,
            url,
            attempts: attempt,
            timeoutMs: this.timeoutMs,
            requestId
          });
          throw new SDKTimeoutError(this.timeoutMs);
        }
        if (attempt < this.maxRetries) {
          attempt++;
          if (logger.shouldLog("WARN")) {
            logger.warn("Retrying request after network error", {
              method,
              url,
              attempt,
              error: err?.message,
              requestId
            });
          }
          await this.sleep(this.backoffMs(attempt));
          continue;
        }
        logger.error("Request failed", {
          method,
          url,
          attempts: attempt,
          error: err?.message,
          requestId
        });
        throw err;
      }
    }
  }
  backoffMs(attempt) {
    const base = 300 * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 200;
    return base + jitter;
  }
  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  scheduleFlush(delayMs) {
    if (this.flushTimer) {
      if (typeof delayMs === "number") {
        clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => void this.flushEvents(), delayMs);
      }
      return;
    }
    const waitMs = typeof delayMs === "number" ? delayMs : this.collateWindowMs;
    this.flushTimer = setTimeout(() => void this.flushEvents(), waitMs);
  }
  trimBufferIfNeeded(incomingCount = 0) {
    const overflow = this.eventBuffer.length + incomingCount - this.maxBufferedEvents;
    if (overflow > 0) {
      const dropped = this.eventBuffer.splice(0, overflow);
      if (logger.shouldLog("WARN")) {
        logger.warn("Dropping buffered events due to maxBufferedEvents limit", {
          maxBufferedEvents: this.maxBufferedEvents,
          dropped: overflow
        });
      }
      dropped.forEach(
        (evt) => evt.reject(
          new Error("Event dropped because the buffer exceeded maxBufferedEvents")
        )
      );
    }
  }
  enqueueEvent(payload) {
    return new Promise((resolve, reject) => {
      this.trimBufferIfNeeded(1);
      this.eventBuffer.push({
        payload,
        resolve,
        reject,
        retries: 0,
        enqueueTime: Date.now()
      });
      if (this.eventBuffer.length >= this.maxBatchSize) {
        void this.flushEvents();
      } else {
        this.scheduleFlush();
      }
    });
  }
  async flushEvents(options = {}) {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.isFlushing || this.eventBuffer.length === 0) {
      return this.pendingFlushPromise ?? Promise.resolve();
    }
    this.isFlushing = true;
    const promise = (async () => {
      while (this.eventBuffer.length > 0) {
        const batch = this.eventBuffer.splice(0, this.maxBatchSize);
        try {
          const response = await this.sendBatch(batch, options);
          batch.forEach((entry) => entry.resolve(response));
          this.flushRetryCount = 0;
        } catch (err) {
          this.eventBuffer = batch.concat(this.eventBuffer);
          this.trimBufferIfNeeded();
          this.flushRetryCount += 1;
          const willRetry = this.flushRetryCount <= this.maxEventRetries;
          if (logger.shouldLog(willRetry ? "WARN" : "ERROR")) {
            logger[willRetry ? "warn" : "error"](
              willRetry ? "Failed to send events, scheduling retry" : "Dropping events after max retries",
              {
                attempt: this.flushRetryCount,
                maxEventRetries: this.maxEventRetries,
                error: err?.message,
                bufferedCount: this.eventBuffer.length
              }
            );
          }
          if (willRetry) {
            this.scheduleFlush(this.backoffMs(this.flushRetryCount));
          } else {
            const dropError = new Error(
              "Max retries reached while sending buffered events"
            );
            batch.forEach((entry) => entry.reject(dropError));
          }
          break;
        }
      }
    })();
    this.pendingFlushPromise = promise.finally(() => {
      this.isFlushing = false;
      this.pendingFlushPromise = null;
    });
    return this.pendingFlushPromise;
  }
  async sendBatch(batch, options) {
    const shouldSendArray = batch.length > 1 && !this.disableArrayBatching && !this.arrayBatchingRejected;
    if (shouldSendArray) {
      try {
        return await this.postEvents(
          batch.map((entry) => entry.payload),
          options
        );
      } catch (err) {
        if (!this.arrayBatchingRejected && err instanceof SDKHttpError) {
          this.arrayBatchingRejected = true;
          if (logger.shouldLog("WARN")) {
            logger.warn("Array payload rejected, falling back to single-event sends", {
              status: err.status,
              statusText: err.statusText
            });
          }
          return this.sendIndividually(batch, options);
        }
        throw err;
      }
    }
    return this.sendIndividually(batch, options);
  }
  async sendIndividually(batch, options) {
    let lastResponse;
    for (const entry of batch) {
      lastResponse = await this.postEvents(entry.payload, options);
    }
    return lastResponse;
  }
  async postEvents(payload, options) {
    const body = JSON.stringify(payload);
    return this.request("/events", {
      method: "POST",
      headers: this.getHeaders(),
      body,
      keepalive: Boolean(options.useBeacon)
    });
  }
  // ----------------- Public API -----------------
  /**
   * Track an existing event occurrence.
   * This does NOT create event definitions; it records that a pre-defined event happened.
   * POST /events
   */
  async trackEvent(data) {
    if (!data || typeof data.eventId !== "number" || typeof data.userId !== "number" && typeof data.userId !== "string" || typeof data.itemId !== "number" && typeof data.itemId !== "string") {
      throw new Error(
        "eventId must be a number; userId and itemId must be a string or number"
      );
    }
    const payload = {
      ...data,
      client_ts: (/* @__PURE__ */ new Date()).toISOString()
    };
    return this.enqueueEvent(payload);
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
      body: JSON.stringify(data)
    });
  }
  /**
   * Delete one or more items.
   * DELETE /items
   */
  async deleteItems(items) {
    const payload = Array.isArray(items) ? items : [items];
    if (payload.length === 0 || payload.some((entry) => {
      const id = entry?.itemId;
      const isValidString = typeof id === "string" && id.trim().length > 0;
      const isValidPositiveInteger = typeof id === "number" && Number.isInteger(id) && id > 0;
      return !(isValidString || isValidPositiveInteger);
    })) {
      throw new Error(
        "itemId is required and must be a UUID string or positive integer"
      );
    }
    const body = payload.length === 1 ? payload[0] : payload;
    return this.request("/items", {
      method: "DELETE",
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
  }
  /**
   * Get recommendations for a user, optionally with a context ID and limit
   * GET /recommendations?user_id=...&context_id=...&limit=...
   */
  async getRecommendations(options) {
    const { userId, contextId, limit } = options;
    if (typeof userId !== "number" && typeof userId !== "string") {
      throw new Error("userId must be a string or number");
    }
    const url = new URL(`${this.baseUrl}/recommendations`);
    url.searchParams.set("user_id", String(userId));
    if (contextId) url.searchParams.set("context_id", contextId);
    if (typeof limit === "number") url.searchParams.set("limit", String(limit));
    return this.request(url.toString(), {
      method: "GET",
      headers: this.getHeaders()
    });
  }
};
var index_default = NeuronSDK;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  NeuronSDK,
  SDKHttpError,
  SDKTimeoutError,
  configureLogger,
  logger
});
//# sourceMappingURL=index.cjs.map