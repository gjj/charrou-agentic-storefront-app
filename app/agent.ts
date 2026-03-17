/**
 * Charrou Agentic Storefront — Agent
 *
 * This agent connects to the Shopify Storefront MCP at https://charrou.sg/api/mcp
 * and exposes two read-only capabilities:
 *   - search_shop_catalog: search and browse products
 *   - search_shop_policies_and_faqs: answer store FAQs
 *
 * Payment structure (future):
 *   Checkout tools will be priced in USDC via x402.
 *   Conversion rate: 1 SGD = 1.26 USD (see lib/pricing.ts)
 */

import { createMCPClient } from "@ai-sdk/mcp";
import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

// ---------------------------------------------------------------------------
// Model — GPT-5.2 via OpenAI
// Uses OPENAI_API_KEY from environment (see .env.local)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MCP — Shopify Storefront MCP at charrou.sg
// Provides: search_shop_catalog, search_shop_policies_and_faqs
// ---------------------------------------------------------------------------

const STOREFRONT_MCP_URL = "https://charrou.sg/api/mcp";

const mcpClient = await createMCPClient({
  transport: { type: "http", url: STOREFRONT_MCP_URL },
});

const storefrontTools = await mcpClient.tools();

// ---------------------------------------------------------------------------
// System prompt — strict scope: read-only storefront only
// ---------------------------------------------------------------------------

const instructions = `
# Charrou Agentic Storefront

You are a helpful shopping assistant for Charrou.sg, a Singapore-based online store.

## What you can do
- **Browse products**: Search and display products from the store catalog using \`search_shop_catalog\`
- **Recommend products**: Suggest products based on the customer's budget, occasion, or preferences
- **Answer FAQs**: Answer questions about the store's policies, shipping, returns, and services using \`search_shop_policies_and_faqs\`

## What you CANNOT do (for now)
- Place orders, add items to cart, or process checkouts
- Handle payments or transactions
- Modify any store or product data
- Answer questions unrelated to Charrou.sg and its products

## Guidelines
- Always use the MCP tools to fetch real, up-to-date product data — never make up products or prices
- When recommending products, explain why each one fits the customer's needs
- All prices are in SGD (Singapore Dollars) unless otherwise stated
- Be friendly, concise, and helpful
- If asked about something outside your scope, politely explain what you can help with instead
`.trim();

// ---------------------------------------------------------------------------
// Payment — free for browsing
// Future: checkout tools will gate payment per-tool using x402
// See lib/pricing.ts for SGD → USDC conversion logic
// ---------------------------------------------------------------------------

export const accepts: Accepts = {
  scheme: "free",
};

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export default new ToolLoopAgent({
  model: openai("gpt-5.2"),
  instructions,
  tools: storefrontTools,
  stopWhen: stepCountIs(10),
});
