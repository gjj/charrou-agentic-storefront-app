# Charrou Agentic Storefront

An AI-powered storefront agent for [Charrou.sg](https://charrou.sg) built with [aixyz](https://aixyz.sh).

Connects to the Shopify Storefront MCP at `https://charrou.sg/api/mcp` for browsing, and the Shopify Checkout MCP at `https://checkout.charrou.sg/api/ucp/mcp` for purchasing via the [Universal Commerce Protocol (UCP)](https://ucp.dev).

## Setup

```bash
# 1. Copy env file and fill in your credentials
cp .env.example .env.local
# Edit .env.local and set:
#   OPENAI_API_KEY       — from https://platform.openai.com/api-keys
#   SHOPIFY_CLIENT_ID    — from https://shopify.dev/docs/apps/build/dev-dashboard
#   SHOPIFY_CLIENT_SECRET

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
| `/.well-known/ucp` | UCP | UCP agent profile for capability negotiation |
| `/agent` | A2A | Chat endpoint |
| `/mcp` | MCP | Tool sharing |

## Capabilities

- **Browse Products** — Search and display items from the Charrou.sg catalog
- **Recommend Products** — Personalised suggestions by budget, occasion, or preference
- **Store FAQ** — Shipping, returns, policies, and store info
- **Checkout** — Purchase products via Shopify UCP (A2A/MCP compatible)

## Checkout Flow (UCP)

```
Buyer: "I want to buy Frozen Pork Jowl 300g"
Agent: → search_shop_catalog → gets Shopify variant GID
Agent: "What's your email and delivery address?"
Buyer: [provides details]
Agent: → checkout_create (variant ID + buyer info → checkout.charrou.sg/api/ucp/mcp)
Shopify: → returns continue_url
Agent: "Here's your checkout link: [continue_url] — complete payment there!"
Buyer: pays on Shopify's secure checkout page ✅
```

Checkout sessions support: `create` → `get` → `update` → `cancel`.
Payment is always completed on Shopify's trusted UI — the agent never handles card details.

## Authentication

### Storefront MCP (read-only)
No auth required — public Shopify Storefront MCP.

### Checkout MCP (UCP)
Requires Shopify Dev Dashboard credentials:
1. Get `client_id` + `client_secret` from [Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard)
2. Agent fetches a 60-min JWT from `https://api.shopify.com/auth/access_token`
3. JWT is auto-refreshed and cached in `app/lib/shopify-ucp.ts`

### UCP Agent Profile
Served at `/.well-known/ucp` — required by Shopify UCP for capability negotiation.

## Payment (x402)

Browsing is free. Checkout tool calls can be gated with USDC payments via Base using x402.

Conversion rate: **1 SGD = 1.26 USDC**

See `app/lib/pricing.ts` for utility functions.

## Model

GPT-5.2 via [OpenAI](https://platform.openai.com).
Requires `OPENAI_API_KEY` in `.env.local`.
