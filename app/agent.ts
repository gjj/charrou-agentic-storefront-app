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

import { createOpenAI } from "@ai-sdk/openai";
import { experimental_createMCPClient } from "ai";
import { stepCountIs, ToolLoopAgent } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Accepts } from "aixyz/accepts";

// ---------------------------------------------------------------------------
// Model — Claude Sonnet 4.7 via GitHub Copilot
// Uses GITHUB_TOKEN from environment (see .env.local)
// ---------------------------------------------------------------------------

const github = createOpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: process.env.GITHUB_TOKEN,
  compatibility: "compatible",
});

// ---------------------------------------------------------------------------
// MCP — Shopify Storefront MCP at charrou.sg
// Provides: search_shop_catalog, search_shop_policies_and_faqs
// ---------------------------------------------------------------------------

const STOREFRONT_MCP_URL = "https://charrou.sg/api/mcp";

const mcpClient = await experimental_createMCPClient({
  transport: new StreamableHTTPClientTransport(new URL(STOREFRONT_MCP_URL)),
});

const storefrontTools = mcpClient.tools();

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

## What you CANNOT do
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
  model: github("claude-sonnet-4-7"),
  instructions,
  tools: storefrontTools,
  stopWhen: stepCountIs(10),
});
