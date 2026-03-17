# Charrou Agentic Storefront

An AI-powered storefront agent for [Charrou.sg](https://charrou.sg) built with [aixyz](https://aixyz.sh).

Connects to the Shopify Storefront MCP at `https://charrou.sg/api/mcp` to browse products, make recommendations, and answer FAQs — all read-only, no checkout required.

## Setup

```bash
# 1. Copy env file and add your OpenAI API key
cp .env.example .env.local
# Edit .env.local and set OPENAI_API_KEY

# 2. Install dependencies
bun install

# 3. Start dev server
bun run dev
```

The agent runs at `http://localhost:3000`.

## Endpoints

| Endpoint | Protocol | Description |
|---|---|---|
| `/.well-known/agent-card.json` | A2A | Agent discovery |
| `/agent` | A2A | Chat endpoint |
| `/mcp` | MCP | Tool sharing |

## Capabilities

- **Browse Products** — Search and display items from the Charrou.sg catalog
- **Recommend Products** — Personalised suggestions by budget, occasion, or preference
- **Store FAQ** — Shipping, returns, policies, and store info

## Payment (future)

Currently free. Checkout tools will be added with USDC x402 payments via Base.

Conversion rate: **1 SGD = 1.26 USDC**

See `app/lib/pricing.ts` for the utility functions.

## Model

GPT-5.2 via [OpenAI](https://platform.openai.com).
Requires an `OPENAI_API_KEY` in `.env.local`.
