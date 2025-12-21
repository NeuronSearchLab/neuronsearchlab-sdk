// src/index.ts

import {logger} from "./logger";

export {configureLogger, logger} from "./logger";
export type {
  LogLevel,
  LoggerConfig,
  StructuredLogEntry,
  LoggerTransport,
} from "./logger";

export type SDKConfig = {
  baseUrl: string; // e.g. https://api.neuronsearchlab.com/v1
  accessToken: string; // Bearer token
  timeoutMs?: number; // default 10_000
  maxRetries?: number; // retry on 429/5xx/timeouts, default 2
  fetchImpl?: typeof fetch; // custom fetch (e.g., undici/node-fetch for older Node)
  collateWindowSeconds?: number; // buffer events for this many seconds before flushing; default 3
  maxBatchSize?: number; // flush immediately once this many events are buffered; default 200
  maxBufferedEvents?: number; // drop oldest events past this limit; default 5000
  maxEventRetries?: number; // max send retries for buffered events after network failure; default 5
  disableArrayBatching?: boolean; // force single-event sends (used after server rejects arrays)
};

export type APIErrorBody = {
  error?: string;
  message?: string;
  code?: string | number;
  details?: unknown;
  [k: string]: unknown;
};

export class SDKHttpError extends Error {
  public status: number;
  public statusText: string;
  public body?: APIErrorBody | string;

  constructor(
    msg: string,
    opts: {status: number; statusText: string; body?: APIErrorBody | string}
  ) {
    super(msg);
    this.name = "SDKHttpError";
    this.status = opts.status;
    this.statusText = opts.statusText;
    this.body = opts.body;
  }
}

export class SDKTimeoutError extends Error {
  constructor(public timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms`);
    this.name = "SDKTimeoutError";
  }
}

// -------- Domain payloads --------
export type TrackEventPayload = {
  eventId: number; // numeric, defined in admin UI
  userId: number | string;
  itemId: number | string; // allow UUIDs or numeric IDs
  [k: string]: unknown;
};

export type ItemUpsertPayload = {
  itemId: number | string; // allow UUIDs or numeric IDs
  name: string;
  description: string;
  metadata: Record<string, any>;
};

export type RecommendationOptions = {
  userId: number | string;
  contextId?: string;
  limit?: number;
};

export type DeleteItemInput = {
  itemId: string | number;
};

export type DeleteItemsResponse = {
  message: string;
  itemId?: string | number;
  itemIds: Array<string | number>;
  deletedCount?: number;
  processing_time_ms?: number;
};

// Updated response type to match API
export type RecommendationsResponse = {
  message?: string;
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
};

// Legacy type for backwards compatibility
export type Recommendation = {
  itemId: number | string;
  score?: number;
  reason?: string;
  [k: string]: unknown;
};

type BufferedEvent<T> = {
  payload: T;
  resolve: (value: any) => void;
  reject: (err: any) => void;
  retries: number;
  enqueueTime: number;
};

export class NeuronSDK {
  private baseUrl: string;
  private accessToken: string;
  private timeoutMs: number;
  private maxRetries: number;
  private fetchImpl: typeof fetch;
  private collateWindowMs: number;
  private maxBatchSize: number;
  private maxBufferedEvents: number;
  private maxEventRetries: number;
  private disableArrayBatching: boolean;
  private eventBuffer: BufferedEvent<any>[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private pendingFlushPromise: Promise<void> | null = null;
  private flushRetryCount = 0;
  private lifecycleListenersRegistered = false;
  private arrayBatchingRejected = false;

  constructor(config: SDKConfig) {
    if (!config.baseUrl || !config.accessToken) {
      throw new Error("baseUrl and accessToken are required");
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, ""); // trim trailing slashes
    this.accessToken = config.accessToken;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.maxRetries = config.maxRetries ?? 2;
    this.fetchImpl = config.fetchImpl ?? (globalThis.fetch as typeof fetch);
    this.collateWindowMs = (config.collateWindowSeconds ?? 3) * 1000;
    this.maxBatchSize = config.maxBatchSize ?? 200;
    this.maxBufferedEvents = config.maxBufferedEvents ?? 5000;
    this.maxEventRetries = config.maxEventRetries ?? 5;
    this.disableArrayBatching = Boolean(config.disableArrayBatching);
    if (!this.fetchImpl) {
      throw new Error(
        "fetch is not available in this environment. Provide config.fetchImpl (e.g., undici or node-fetch)."
      );
    }

    this.registerLifecycleFlush();
  }

  private registerLifecycleFlush() {
    if (this.lifecycleListenersRegistered) return;

    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      const handler = () => {
        void this.flushEvents({useBeacon: true});
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

  public setAccessToken(token: string) {
    this.accessToken = token;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, "");
  }

  public setTimeout(ms: number) {
    this.timeoutMs = ms;
  }

  private getHeaders(extra?: HeadersInit): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
      ...(extra ?? {}),
    };
  }

  // Core request with timeout + retry (429/5xx + timeouts)
  private async request<T>(
    pathOrUrl: string,
    init: RequestInit & {retryOn?: number[]} = {}
  ): Promise<T> {
    const method = init.method ?? "GET";
    const isAbs = /^https?:\/\//i.test(pathOrUrl);
    const url = isAbs
      ? pathOrUrl
      : `${this.baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

    const retryOn = init.retryOn ?? [429, 500, 502, 503, 504];
    let attempt = 0;
    const requestId =
      logger.shouldLog("DEBUG") || logger.isPerformanceLoggingEnabled()
        ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
        : undefined;

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
          requestBody: typeof init.body === "string" ? init.body : undefined,
        });
      }

      try {
        const res = await this.fetchImpl(url, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const durationMs = startTime ? Date.now() - startTime : undefined;

        if (res.ok) {
          const text = await res.text();
          if (logger.shouldLog("DEBUG")) {
            logger.debug("HTTP response received", {
              method,
              url,
              attempt,
              status: res.status,
              requestId,
              durationMs,
            });
          }
          if (text && logger.shouldLog("TRACE")) {
            logger.trace("HTTP response payload", {
              method,
              url,
              requestId,
              responseBody: text,
            });
          }
          if (!text) return undefined as unknown as T;
          try {
            return JSON.parse(text) as T;
          } catch {
            return text as unknown as T; // non-JSON payloads
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
            responseBody: raw,
          });
        }
        let body: APIErrorBody | string | undefined;
        try {
          body = raw ? (JSON.parse(raw) as APIErrorBody) : undefined;
        } catch {
          body = raw;
        }

        if (retryOn.includes(res.status) && attempt < this.maxRetries) {
          attempt++;
          const retryAfter = res.headers.get("retry-after");
          const delay =
            retryAfter && !Number.isNaN(Number(retryAfter))
              ? Number(retryAfter) * 1000
              : this.backoffMs(attempt);
          if (logger.shouldLog("INFO")) {
            logger.info("Retrying request after HTTP status", {
              method,
              url,
              attempt,
              status: res.status,
              delayMs: delay,
              requestId,
            });
          }
          await this.sleep(delay);
          continue;
        }

        const msg = `HTTP ${res.status} ${res.statusText} for ${method} ${url}`;
        throw new SDKHttpError(msg, {
          status: res.status,
          statusText: res.statusText,
          body,
        });
      } catch (err: any) {
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
                requestId,
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
            requestId,
          });
          throw new SDKTimeoutError(this.timeoutMs);
        }

        // transient network errors
        if (attempt < this.maxRetries) {
          attempt++;
          if (logger.shouldLog("WARN")) {
            logger.warn("Retrying request after network error", {
              method,
              url,
              attempt,
              error: err?.message,
              requestId,
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
          requestId,
        });
        throw err;
      }
    }
  }

  private backoffMs(attempt: number) {
    // 300ms, 600ms, 1200ms ... + jitter
    const base = 300 * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 200;
    return base + jitter;
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private scheduleFlush(delayMs?: number) {
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

  private trimBufferIfNeeded(incomingCount = 0) {
    const overflow = this.eventBuffer.length + incomingCount - this.maxBufferedEvents;
    if (overflow > 0) {
      const dropped = this.eventBuffer.splice(0, overflow);
      if (logger.shouldLog("WARN")) {
        logger.warn("Dropping buffered events due to maxBufferedEvents limit", {
          maxBufferedEvents: this.maxBufferedEvents,
          dropped: overflow,
        });
      }
      dropped.forEach((evt) =>
        evt.reject(
          new Error("Event dropped because the buffer exceeded maxBufferedEvents")
        )
      );
    }
  }

  private enqueueEvent<TResponse>(payload: any): Promise<TResponse> {
    return new Promise<TResponse>((resolve, reject) => {
      this.trimBufferIfNeeded(1);

      this.eventBuffer.push({
        payload,
        resolve,
        reject,
        retries: 0,
        enqueueTime: Date.now(),
      });

      if (this.eventBuffer.length >= this.maxBatchSize) {
        void this.flushEvents();
      } else {
        this.scheduleFlush();
      }
    });
  }

  public async flushEvents(options: {useBeacon?: boolean} = {}): Promise<void> {
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
        } catch (err: any) {
          this.eventBuffer = batch.concat(this.eventBuffer);
          this.trimBufferIfNeeded();
          this.flushRetryCount += 1;
          const willRetry = this.flushRetryCount <= this.maxEventRetries;
          if (logger.shouldLog(willRetry ? "WARN" : "ERROR")) {
            logger[willRetry ? "warn" : "error"](
              willRetry
                ? "Failed to send events, scheduling retry"
                : "Dropping events after max retries",
              {
                attempt: this.flushRetryCount,
                maxEventRetries: this.maxEventRetries,
                error: err?.message,
                bufferedCount: this.eventBuffer.length,
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

  private async sendBatch(
    batch: BufferedEvent<any>[],
    options: {useBeacon?: boolean}
  ): Promise<any> {
    const shouldSendArray =
      batch.length > 1 &&
      !this.disableArrayBatching &&
      !this.arrayBatchingRejected;

    if (shouldSendArray) {
      try {
        return await this.postEvents(
          batch.map((entry) => entry.payload),
          options
        );
      } catch (err: any) {
        if (!this.arrayBatchingRejected && err instanceof SDKHttpError) {
          this.arrayBatchingRejected = true;
          if (logger.shouldLog("WARN")) {
            logger.warn("Array payload rejected, falling back to single-event sends", {
              status: err.status,
              statusText: err.statusText,
            });
          }
          return this.sendIndividually(batch, options);
        }
        throw err;
      }
    }

    return this.sendIndividually(batch, options);
  }

  private async sendIndividually(
    batch: BufferedEvent<any>[],
    options: {useBeacon?: boolean}
  ): Promise<any> {
    let lastResponse: any;
    for (const entry of batch) {
      lastResponse = await this.postEvents(entry.payload, options);
    }
    return lastResponse;
  }

  private async postEvents(payload: any, options: {useBeacon?: boolean}) {
    const body = JSON.stringify(payload);
    return this.request("/events", {
      method: "POST",
      headers: this.getHeaders(),
      body,
      keepalive: Boolean(options.useBeacon),
    });
  }

  // ----------------- Public API -----------------

  /**
   * Track an existing event occurrence.
   * This does NOT create event definitions; it records that a pre-defined event happened.
   * POST /events
   */
  public async trackEvent<T = {success: true; id?: number}>(
    data: TrackEventPayload
  ): Promise<T> {
    if (
      !data ||
      typeof data.eventId !== "number" ||
      (typeof data.userId !== "number" && typeof data.userId !== "string") ||
      (typeof data.itemId !== "number" && typeof data.itemId !== "string")
    ) {
      throw new Error(
        "eventId must be a number; userId and itemId must be a string or number"
      );
    }

    const payload = {
      ...data,
      client_ts: new Date().toISOString(),
    };

    return this.enqueueEvent<T>(payload);
  }

  /**
   * @deprecated Use trackEvent(). Kept for backwards compatibility.
   */
  public async createEvent<T = {success: true; id?: number}>(
    data: TrackEventPayload
  ): Promise<T> {
    return this.trackEvent<T>(data);
  }

  /**
   * Create or update an item
   * POST /items
   */
  public async upsertItem<T = {success: true; itemId: number | string}>(
    data: ItemUpsertPayload
  ): Promise<T> {
    return this.request<T>("/items", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete one or more items.
   * DELETE /items
   */
  public async deleteItems<T = DeleteItemsResponse>(
    items: DeleteItemInput | DeleteItemInput[]
  ): Promise<T> {
    const payload = Array.isArray(items) ? items : [items];

    if (
      payload.length === 0 ||
      payload.some((entry) => {
        const id = entry?.itemId;
        const isValidString = typeof id === "string" && id.trim().length > 0;
        const isValidPositiveInteger =
          typeof id === "number" && Number.isInteger(id) && id > 0;
        return !(isValidString || isValidPositiveInteger);
      })
    ) {
      throw new Error(
        "itemId is required and must be a UUID string or positive integer"
      );
    }

    const body = payload.length === 1 ? payload[0] : payload;

    return this.request<T>("/items", {
      method: "DELETE",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
  }

  /**
   * Get recommendations for a user, optionally with a context ID and limit
   * GET /recommendations?user_id=...&context_id=...&limit=...
   */
  public async getRecommendations(
    options: RecommendationOptions
  ): Promise<RecommendationsResponse> {
    const {userId, contextId, limit} = options;
    if (typeof userId !== "number" && typeof userId !== "string") {
      throw new Error("userId must be a string or number");
    }

    const url = new URL(`${this.baseUrl}/recommendations`);
    url.searchParams.set("user_id", String(userId));
    if (contextId) url.searchParams.set("context_id", contextId);
    if (typeof limit === "number") url.searchParams.set("limit", String(limit));

    return this.request<RecommendationsResponse>(url.toString(), {
      method: "GET",
      headers: this.getHeaders(),
    });
  }
}

export default NeuronSDK;
