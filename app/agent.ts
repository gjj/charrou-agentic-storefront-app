/**
 * Charrou Agentic Storefront — Agent
 *
 * Connects to the Shopify Storefront MCP at https://charrou.sg/api/mcp
 * for read-only browsing, and to the Shopify Checkout MCP at
 * https://checkout.charrou.sg/api/ucp/mcp for purchasing via UCP/A2A.
 *
 * Capabilities:
 *   - search_shop_catalog: search and browse products
 *   - search_shop_policies_and_faqs: answer store FAQs
 *   - checkout_create: initiate a checkout session and get a payment URL
 *   - checkout_get: retrieve current checkout state
 *   - checkout_update: update line items or shipping info
 *   - checkout_cancel: cancel an active checkout session
 *
 * Payment:
 *   Browsing is free. Checkout tool calls are gated via x402 (USDC on Base).
 *   Conversion rate: 1 SGD = 1.26 USD (see lib/pricing.ts)
 */

import { createMCPClient } from "@ai-sdk/mcp";
import { openai } from "@ai-sdk/openai";
import { stepCountIs, tool, ToolLoopAgent } from "ai";
import { z } from "zod";
import type { Accepts } from "aixyz/accepts";
import {
  createCheckout,
  getCheckout,
  updateCheckout,
  cancelCheckout,
} from "./lib/shopify-ucp.js";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// MCP — Shopify Storefront MCP (read-only: browse + FAQ)
// ---------------------------------------------------------------------------

const STOREFRONT_MCP_URL = "https://charrou.sg/api/mcp";

const mcpClient = await createMCPClient({
  transport: { type: "http", url: STOREFRONT_MCP_URL },
});

// Provide explicit schemas to prevent cursor hallucination and hide cart tools
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

// ---------------------------------------------------------------------------
// UCP Checkout tools (wrapping checkout.charrou.sg/api/ucp/mcp)
// ---------------------------------------------------------------------------

const shippingDestinationSchema = z.object({
  first_name: z.string().describe("Recipient's first name"),
  last_name: z.string().describe("Recipient's last name"),
  street_address: z.string().describe("Street address including unit number"),
  address_locality: z.string().describe("City, e.g. 'Singapore'"),
  address_region: z.string().optional().describe("State or province (optional for Singapore)"),
  postal_code: z.string().describe("Postal code, e.g. '123456'"),
  address_country: z.string().describe("ISO 3166-1 alpha-2 country code, e.g. 'SG'"),
});

const checkout_create = tool({
  description:
    "Initiate a checkout session for a product on Charrou.sg. " +
    "Use this when the buyer is ready to purchase. " +
    "Returns a continue_url — send this to the buyer so they can complete payment securely on Charrou's checkout page. " +
    "You must first search the catalog to obtain the product variant ID (a Shopify GID like 'gid://shopify/ProductVariant/...').",
  parameters: z.object({
    variantId: z
      .string()
      .describe("Shopify ProductVariant GID, e.g. 'gid://shopify/ProductVariant/12345678901'"),
    quantity: z.number().int().min(1).default(1).describe("Number of units to purchase"),
    buyerEmail: z.string().email().describe("Buyer's email address for order confirmation"),
    destination: shippingDestinationSchema.describe("Shipping destination for the order"),
  }),
  execute: async ({ variantId, quantity, buyerEmail, destination }) => {
    const result = await createCheckout({
      currency: "SGD",
      lineItems: [{ quantity, item: { id: variantId } }],
      buyerEmail,
      destination,
    });

    return {
      checkoutId: result.id,
      status: result.status,
      continueUrl: result.continue_url,
      totals: result.totals,
      messages: result.messages,
    };
  },
});

const checkout_get = tool({
  description:
    "Retrieve the current state of an existing checkout session. " +
    "Use this to check status, verify totals, or confirm if checkout is ready for payment.",
  parameters: z.object({
    checkoutId: z.string().describe("The checkout session ID returned by checkout_create"),
  }),
  execute: async ({ checkoutId }) => {
    const result = await getCheckout(checkoutId);
    return {
      checkoutId: result.id,
      status: result.status,
      continueUrl: result.continue_url,
      totals: result.totals,
      messages: result.messages,
      order: result.order,
    };
  },
});

const checkout_update = tool({
  description:
    "Update an existing checkout session with new line items or shipping information. " +
    "WARNING: This replaces the entire checkout state — always include all fields (line_items, buyer, destination).",
  parameters: z.object({
    checkoutId: z.string().describe("The checkout session ID to update"),
    variantId: z.string().describe("Shopify ProductVariant GID"),
    quantity: z.number().int().min(1).describe("Updated quantity"),
    buyerEmail: z.string().email().describe("Buyer's email address"),
    destination: shippingDestinationSchema.describe("Updated shipping destination"),
  }),
  execute: async ({ checkoutId, variantId, quantity, buyerEmail, destination }) => {
    const result = await updateCheckout({
      checkoutId,
      lineItems: [{ quantity, item: { id: variantId } }],
      buyerEmail,
      destination,
    });

    return {
      checkoutId: result.id,
      status: result.status,
      continueUrl: result.continue_url,
      totals: result.totals,
      messages: result.messages,
    };
  },
});

const checkout_cancel = tool({
  description:
    "Cancel an active checkout session. Use when a buyer abandons or explicitly cancels. " +
    "Cancelled checkouts cannot be resumed — start a new session if needed.",
  parameters: z.object({
    checkoutId: z.string().describe("The checkout session ID to cancel"),
  }),
  execute: async ({ checkoutId }) => {
    const idempotencyKey = randomUUID();
    const result = await cancelCheckout(checkoutId, idempotencyKey);
    return {
      checkoutId: result.id,
      status: result.status,
      messages: result.messages,
    };
  },
});

// ---------------------------------------------------------------------------
// All tools
// ---------------------------------------------------------------------------

const allTools = {
  search_shop_catalog,
  search_shop_policies_and_faqs,
  checkout_create,
  checkout_get,
  checkout_update,
  checkout_cancel,
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const instructions = `
# Charrou Agentic Storefront

You are a helpful shopping assistant for Charrou.sg, a Singapore-based online store specialising in premium char siew and roast meats.

## What you can do
- **Browse products**: Search and display products from the store catalog using \`search_shop_catalog\`
- **Recommend products**: Suggest products based on the customer's budget, occasion, or preferences
- **Answer FAQs**: Answer questions about the store's policies, shipping, returns, and services using \`search_shop_policies_and_faqs\`
- **Checkout**: Help buyers purchase products via \`checkout_create\`, \`checkout_get\`, \`checkout_update\`, \`checkout_cancel\`

## Checkout flow (follow this exactly)
1. Use \`search_shop_catalog\` to find the product and get the exact **variant ID** (Shopify GID)
2. Confirm the item, size/variant, and quantity with the buyer
3. Collect the buyer's **email address** and **shipping address** (name, street, city, postal code, country)
4. Call \`checkout_create\` with all the above
5. Return the \`continue_url\` to the buyer — they complete payment securely on Charrou's checkout page
6. Never collect or transmit payment card details — always hand off to the \`continue_url\`

## Checkout statuses
- \`incomplete\` → inspect messages and call \`checkout_update\` to fix missing info
- \`requires_escalation\` → send buyer to \`continue_url\` for manual input
- \`ready_for_complete\` → checkout is ready (payment handled on Shopify's UI)
- \`completed\` → order placed successfully
- \`canceled\` → session ended; start fresh with \`checkout_create\`

## Guidelines
- Always use MCP/UCP tools for real, up-to-date data — never make up products, prices, or IDs
- All prices are in SGD (Singapore Dollars) unless otherwise stated
- Charrou ships within Singapore only
- Be friendly, concise, and helpful
- If asked about something outside your scope, politely explain what you can help with
`.trim();

// ---------------------------------------------------------------------------
// Payment — browsing is free; checkout is gated via x402
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
  tools: allTools,
  stopWhen: stepCountIs(15),
});
