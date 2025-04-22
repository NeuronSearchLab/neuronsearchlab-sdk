export type SDKConfig = {
  baseUrl: string;
  accessToken: string;
};

export class NeuronSDK {
  private baseUrl: string;
  private accessToken: string;

  constructor(config: SDKConfig) {
    if (!config.baseUrl || !config.accessToken) {
      throw new Error("baseUrl and accessToken are required");
    }

    this.baseUrl = config.baseUrl;
    this.accessToken = config.accessToken;
  }

  public setAccessToken(token: string) {
    this.accessToken = token;
  }

  private getHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  /**
   * Create an event
   * POST /events
   */
  public async createEvent(data: {
    itemId: number;
    userId: number;
    eventId: number;
    metadata: Record<string, any>;
  }): Promise<any> {
    const res = await fetch(`${this.baseUrl}/events`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(
        `Failed to create event: ${res.status} ${res.statusText}`
      );
    }

    return res.json();
  }

  /**
   * Create or update an item
   * POST /items
   */
  public async upsertItem(data: {
    itemId: number;
    name: string;
    description: string;
    metadata: Record<string, any>;
  }): Promise<any> {
    const res = await fetch(`${this.baseUrl}/items`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to upsert item: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Get recommendations for a user, optionally with a context ID
   * GET /recommendations?user_id=...&context_id=...
   */
  public async getRecommendations(options: {
    userId: string;
    contextId?: string;
  }): Promise<any> {
    const {userId, contextId} = options;
    const url = new URL(`${this.baseUrl}/recommendations`);
    url.searchParams.append("user_id", userId);
    if (contextId) {
      url.searchParams.append("context_id", contextId);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch recommendations: ${res.status} ${res.statusText}`
      );
    }

    return res.json();
  }
}
