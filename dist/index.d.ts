export type SDKConfig = {
    baseUrl: string;
    accessToken: string;
};
export declare class NeuronSDK {
    private baseUrl;
    private accessToken;
    constructor(config: SDKConfig);
    setAccessToken(token: string): void;
    private getHeaders;
    /**
     * Create an event
     * POST /events
     */
    createEvent(data: {
        itemId: number;
        userId: number;
        eventId: number;
        metadata: Record<string, any>;
    }): Promise<any>;
    /**
     * Create or update an item
     * POST /items
     */
    upsertItem(data: {
        itemId: number;
        name: string;
        description: string;
        metadata: Record<string, any>;
    }): Promise<any>;
    /**
     * Get recommendations for a user
     * GET /recommendation?user_id=...
     */
    getRecommendations(userId: string): Promise<any>;
}
