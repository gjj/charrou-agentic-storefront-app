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
import { z } from "zod";
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

// Provide explicit schemas for the two read-only tools.
// This overrides the schemas advertised by Shopify's MCP, letting us:
//   1. Strip the `after` cursor field — the root cause of GPT hallucinating
//      "Malformed cursor" pagination calls on first-page queries.
//   2. Hide cart/checkout tools (get_cart, update_cart, get_product_details)
//      entirely by only destructuring what we want.
const { search_shop_catalog, search_shop_policies_and_faqs } = await mcpClient.tools({
  schemas: {
    search_shop_catalog: {
      inputSchema: z.object({
        query: z.string().describe("Natural language search query for products, e.g. 'bak kwa' or 'gifts under $50'"),
        context: z.string().describe("Customer context: budget, preferences, occasion, demographics, or other relevant details"),
        filters: z
          .array(
            z.object({
              available: z.boolean().optional().describe("Filter to in-stock products only"),
              price: z
                .object({
                  min: z.number().optional().describe("Minimum price (SGD)"),
                  max: z.number().optional().describe("Maximum price (SGD)"),
                })
                .optional(),
              productType: z.string().optional(),
              productVendor: z.string().optional(),
              tag: z.string().optional(),
            }),
          )
          .optional()
          .describe("Filters from available_filters in a previous response. Do not guess filter values."),
        limit: z.number().int().min(1).max(250).default(10).optional(),
        country: z.string().optional().describe("ISO 3166-1 alpha-2 country code, e.g. 'SG'"),
        language: z.string().optional().describe("ISO 639-1 language code, e.g. 'EN'"),
        // `after` intentionally omitted — do not add pagination on first call
      }),
    },
    search_shop_policies_and_faqs: {
      inputSchema: z.object({
        query: z.string().describe("Natural language question about store policies, shipping, returns, or FAQs"),
        context: z.string().optional().describe("Additional context about the customer or situation"),
      }),
    },
  },
});

const storefrontTools = { search_shop_catalog, search_shop_policies_and_faqs };

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
