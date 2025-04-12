export class NeuronSDK {
    constructor(config) {
        if (!config.baseUrl || !config.accessToken) {
            throw new Error("baseUrl and accessToken are required");
        }
        this.baseUrl = config.baseUrl;
        this.accessToken = config.accessToken;
    }
    setAccessToken(token) {
        this.accessToken = token;
    }
    getHeaders() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.accessToken}`,
        };
    }
    /**
     * Create an event
     * POST /events
     */
    async createEvent(data) {
        const res = await fetch(`${this.baseUrl}/events`, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            throw new Error(`Failed to create event: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }
    /**
     * Create or update an item
     * POST /items
     */
    async upsertItem(data) {
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
     * Get recommendations for a user
     * GET /recommendation?user_id=...
     */
    async getRecommendations(userId) {
        const url = new URL(`${this.baseUrl}/recommendation`);
        url.searchParams.append("user_id", userId);
        const res = await fetch(url.toString(), {
            method: "GET",
            headers: this.getHeaders(),
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch recommendations: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }
}
