# 🧠 @neuronsearchlab/sdk

Official JavaScript SDK for integrating with the [NeuronSearchLab](https://neuronsearchlab.com) API.  
Designed for use in **React**, **Next.js**, and modern browser or Node environments.

[![npm version](https://img.shields.io/npm/v/@neuronsearchlab/sdk.svg?style=flat-square)](https://www.npmjs.com/package/@neuronsearchlab/sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-brightgreen.svg?style=flat-square)](https://docs.neuronsearchlab.com)

---

## 🚀 Installation

```bash
# npm
npm install @neuronsearchlab/sdk

# or yarn
yarn add @neuronsearchlab/sdk

# or pnpm
pnpm add @neuronsearchlab/sdk
```

---

## 🧩 Usage Example

```ts
import NeuronSDK from "@neuronsearchlab/sdk";

const sdk = new NeuronSDK({
  baseUrl: "https://api.neuronsearchlab.com/v1",
  accessToken: process.env.NSL_TOKEN!,
});

// Track an existing event (defined in your NeuronSearchLab admin UI)
await sdk.trackEvent({
  eventId: 12,     // numeric ID of the event type
  userId: 42,      // numeric user ID
  itemId: 123,     // numeric item ID
  metadata: { position: 3, autoplay: false },
});

// Upsert an item
await sdk.upsertItem({
  itemId: 123,
  name: "Premier League Highlights",
  description: "Matchday 10 recap",
  metadata: { league: "EPL", durationSec: 1800 },
});

// Get personalized recommendations
const recs = await sdk.getRecommendations({
  userId: 42,
  contextId: "homepage",
  limit: 10,
});

console.log(recs);
```

---

## 🛠 Features

- 🌐 Works in **browser**, **Node 18+**, and **serverless** environments  
- 🔒 Secure Bearer token auth (`Authorization: Bearer <token>`)  
- ⏱ Automatic **timeouts** & **retries** on 429 / 5xx errors  
- 🧾 Built-in TypeScript types and type declarations  
- 💬 Descriptive, typed error handling (`SDKHttpError`, `SDKTimeoutError`)  
- 🧰 Lightweight — zero dependencies beyond `fetch`

---

## 📘 Documentation & Resources

| Resource | Link |
|-----------|------|
| **Developer Docs** | [https://docs.neuronsearchlab.com](https://docs.neuronsearchlab.com) |
| **API Reference** | [https://docs.neuronsearchlab.com/api](https://docs.neuronsearchlab.com/api) |
| **Quickstart Guide** | [https://docs.neuronsearchlab.com/get-started](https://docs.neuronsearchlab.com/get-started) |
| **GitHub Repository** | [https://github.com/NeuronSearchLab/neuronsearchlab-sdk](https://github.com/NeuronSearchLab/neuronsearchlab-sdk) |
| **NeuronSearchLab Website** | [https://neuronsearchlab.com](https://neuronsearchlab.com) |

---

## 🧱 Methods

### `trackEvent(data)`
Send an occurrence of a pre-defined event.

| Param | Type | Description |
|--------|------|-------------|
| `eventId` | `number` | The numeric ID of the event type (from the admin UI) |
| `userId` | `number` | The user’s unique ID |
| `itemId` | `number` | The item or content ID |
| `metadata` | `object` | Additional event context (optional) |

---

### `upsertItem(data)`
Create or update an item in your catalogue.

| Param | Type | Description |
|--------|------|-------------|
| `itemId` | `number` | Unique numeric ID for the item |
| `name` | `string` | Item name or title |
| `description` | `string` | Item description |
| `metadata` | `object` | Arbitrary item metadata |

---

### `getRecommendations(options)`
Fetch personalized recommendations for a user.

| Param | Type | Description |
|--------|------|-------------|
| `userId` | `number` | User ID |
| `contextId` | `string` | Optional context (e.g. "homepage") |
| `limit` | `number` | Optional max number of results |

---

## 🧪 Development

```bash
git clone https://github.com/NeuronSearchLab/neuronsearchlab-sdk.git
cd neuronsearchlab-sdk
npm install
npm run build
```

---

## 🪪 License

MIT © [NeuronSearchLab](https://neuronsearchlab.com)
