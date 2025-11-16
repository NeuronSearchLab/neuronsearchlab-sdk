// src/index.ts

import {logger} from "./logger";

export {configureLogger, logger} from "./logger";
export type {LogLevel, LoggerConfig, StructuredLogEntry, LoggerTransport} from "./logger";

export type SDKConfig = {
  baseUrl: string; // e.g. https://api.neuronsearchlab.com/v1
  accessToken: string; // Bearer token
  timeoutMs?: number; // default 10_000
  maxRetries?: number; // retry on 429/5xx/timeouts, default 2
  fetchImpl?: typeof fetch; // custom fetch (e.g., undici/node-fetch for older Node)
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

// -------- Domain payloads (numeric IDs, as you specified) --------
export type TrackEventPayload = {
  eventId: number; // numeric, defined in admin UI
  userId: number | string;
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
  userId: number | string;
  contextId?: string;
  limit?: number;
};

// Example response shape; feel free to replace/extend with your real types
export type Recommendation = {
  itemId: number | string;
  score?: number;
  reason?: string;
  [k: string]: unknown;
};

export class NeuronSDK {
  private baseUrl: string;
  private accessToken: string;
  private timeoutMs: number;
  private maxRetries: number;
  private fetchImpl: typeof fetch;

  constructor(config: SDKConfig) {
    if (!config.baseUrl || !config.accessToken) {
      throw new Error("baseUrl and accessToken are required");
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, ""); // trim trailing slashes
    this.accessToken = config.accessToken;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.maxRetries = config.maxRetries ?? 2;
    this.fetchImpl = config.fetchImpl ?? (globalThis.fetch as typeof fetch);
    if (!this.fetchImpl) {
      throw new Error(
        "fetch is not available in this environment. Provide config.fetchImpl (e.g., undici or node-fetch)."
      );
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

        const msg = `HTTP ${res.status} ${res.statusText} for ${
          method
        } ${url}`;
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
      typeof data.itemId !== "number"
    ) {
      throw new Error("eventId and itemId must be numbers; userId must be a string or number");
    }

    return this.request<T>("/events", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
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
  public async upsertItem<T = {success: true; itemId: number}>(
    data: ItemUpsertPayload
  ): Promise<T> {
    return this.request<T>("/items", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
  }

  /**
   * Get recommendations for a user, optionally with a context ID and limit
   * GET /recommendations?user_id=...&context_id=...&limit=...
   */
  public async getRecommendations<T = Recommendation[]>(
    options: RecommendationOptions
  ): Promise<T> {
    const {userId, contextId, limit} = options;
    if (typeof userId !== "number" && typeof userId !== "string") {
      throw new Error("userId must be a string or number");
    }

    const url = new URL(`${this.baseUrl}/recommendations`);
    url.searchParams.set("user_id", String(userId));
    if (contextId) url.searchParams.set("context_id", contextId);
    if (typeof limit === "number") url.searchParams.set("limit", String(limit));

    return this.request<T>(url.toString(), {
      method: "GET",
      headers: this.getHeaders(),
    });
  }
}

export default NeuronSDK;
