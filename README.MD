# @neuronsearchlab/sdk

Tiny TypeScript client and structured logger for the NeuronSearchLab API. It exposes a single `NeuronSDK` class (track events, upsert items, request recommendations) plus `configureLogger` for opt-in diagnostic output.

## Installation

```bash
npm install @neuronsearchlab/sdk
```

## Quick start

```ts
import {NeuronSDK, configureLogger} from "@neuronsearchlab/sdk";

configureLogger({level: "INFO"});

const sdk = new NeuronSDK({
  baseUrl: "https://api.neuronsearchlab.com/v1",
  accessToken: process.env.NEURON_API_TOKEN!,
});

const contentId = 3187; // integer content identifier you already store

await sdk.trackEvent({
  eventId: 1,
  userId: "42",
  itemId: contentId, // pass your numeric contentId straight through
  metadata: {action: "view"},
});

await sdk.upsertItem({
  itemId: contentId,
  name: "Premier League Highlights",
  description: "Matchday recap",
  metadata: {league: "EPL"},
});

const recs = await sdk.getRecommendations({userId: "42", limit: 5});
```

## Reference tables

### Resources

| Resource | Link |
| --- | --- |
| Docs hub | https://docs.neuronsearchlab.com |
| API reference | https://docs.neuronsearchlab.com/api |
| Quick start | https://docs.neuronsearchlab.com/get-started |

### Methods

| Method | Required fields | Notes |
| --- | --- | --- |
| `trackEvent(data)` | `eventId` (number), `userId` (string or number), `itemId` (number), `metadata` (object) | For each tracked occurrence; pass your integer contentId via `itemId`. |
| `upsertItem(data)` | `itemId` (number), `name`, `description`, `metadata` | Adds or updates catalogue entries. |
| `getRecommendations(options)` | `userId` (string or number) | Optional: `contextId` (string), `limit` (number). |

## Development

```bash
npm install
npm run build
```

## License

MIT
