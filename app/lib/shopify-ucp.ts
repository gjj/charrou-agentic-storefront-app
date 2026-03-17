/**
 * Shopify UCP / Checkout MCP client
 *
 * Handles authentication and JSON-RPC 2.0 communication with the
 * Shopify Checkout MCP server at checkout.charrou.sg/api/ucp/mcp
 *
 * Docs: https://shopify.dev/docs/agents/checkout/mcp
 */

const SHOP_DOMAIN = "checkout.charrou.sg";
const UCP_ENDPOINT = `https://${SHOP_DOMAIN}/api/ucp/mcp`;
const AUTH_ENDPOINT = "https://api.shopify.com/auth/access_token";

// The public UCP agent profile URI for this agent (served via /.well-known/ucp)
export const AGENT_PROFILE_URI =
  "https://charrou-agentic-storefront-app.vercel.app/.well-known/ucp";

// ---------------------------------------------------------------------------
// Auth — fetch + cache a JWT access token (60-min TTL)
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET environment variables. " +
        "Get credentials from https://shopify.dev/docs/apps/build/dev-dashboard"
    );
  }

  const res = await fetch(AUTH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    throw new Error(`Shopify auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.token;
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 helper
// ---------------------------------------------------------------------------

let rpcId = 1;

export async function callUcpTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>
): Promise<T> {
  const token = await getAccessToken();

  const body = {
    jsonrpc: "2.0",
    method: "tools/call",
    id: rpcId++,
    params: {
      name: toolName,
      arguments: {
        // Always inject agent profile for UCP capability negotiation
        meta: {
          "ucp-agent": { profile: AGENT_PROFILE_URI },
          ...((args.meta as Record<string, unknown>) ?? {}),
        },
        ...args,
      },
    },
  };

  const res = await fetch(UCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`UCP request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as {
    result?: { structuredContent: T };
    error?: { code: number; message: string; data?: unknown };
  };

  if (data.error) {
    throw new Error(
      `UCP error ${data.error.code}: ${data.error.message}` +
        (data.error.data ? ` — ${JSON.stringify(data.error.data)}` : "")
    );
  }

  return data.result!.structuredContent;
}

// ---------------------------------------------------------------------------
// Typed checkout tool wrappers
// ---------------------------------------------------------------------------

export interface LineItem {
  quantity: number;
  item: { id: string }; // Shopify ProductVariant GID
}

export interface ShippingDestination {
  first_name: string;
  last_name: string;
  street_address: string;
  address_locality: string; // city
  address_region?: string;  // state/province
  postal_code: string;
  address_country: string;  // ISO 3166-1 alpha-2, e.g. "SG"
}

export interface CheckoutResult {
  id: string;
  status:
    | "incomplete"
    | "requires_escalation"
    | "ready_for_complete"
    | "complete_in_progress"
    | "completed"
    | "canceled";
  currency: string;
  line_items?: unknown[];
  totals?: Array<{ type: string; amount: number; display_text?: string }>;
  continue_url?: string;
  messages?: Array<{ type: string; code: string; content: string }>;
  order?: { id: string; permalink_url: string };
}

/** Create a new checkout session */
export async function createCheckout(params: {
  currency: string;
  lineItems: LineItem[];
  buyerEmail: string;
  destination: ShippingDestination;
}): Promise<CheckoutResult> {
  return callUcpTool<CheckoutResult>("create_checkout", {
    checkout: {
      currency: params.currency,
      line_items: params.lineItems,
      buyer: { email: params.buyerEmail },
      fulfillment: {
        methods: [
          {
            type: "shipping",
            destinations: [params.destination],
          },
        ],
      },
    },
  });
}

/** Retrieve current state of a checkout */
export async function getCheckout(checkoutId: string): Promise<CheckoutResult> {
  return callUcpTool<CheckoutResult>("get_checkout", { id: checkoutId });
}

/** Update a checkout session (full replacement — include all fields) */
export async function updateCheckout(params: {
  checkoutId: string;
  lineItems: LineItem[];
  buyerEmail: string;
  destination: ShippingDestination;
}): Promise<CheckoutResult> {
  return callUcpTool<CheckoutResult>("update_checkout", {
    id: params.checkoutId,
    checkout: {
      line_items: params.lineItems,
      buyer: { email: params.buyerEmail },
      fulfillment: {
        methods: [
          {
            type: "shipping",
            destinations: [params.destination],
          },
        ],
      },
    },
  });
}

/** Cancel a checkout session */
export async function cancelCheckout(
  checkoutId: string,
  idempotencyKey: string
): Promise<CheckoutResult> {
  return callUcpTool<CheckoutResult>("cancel_checkout", {
    meta: { "idempotency-key": idempotencyKey },
    id: checkoutId,
  });
}
