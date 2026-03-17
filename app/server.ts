import { AixyzApp } from "aixyz/app";
import { IndexPagePlugin } from "aixyz/app/plugins/index-page";
import { facilitator } from "aixyz/accepts";
import { A2APlugin } from "aixyz/app/plugins/a2a";
import * as agent from "./agent";

const app = new AixyzApp({ facilitators: facilitator });
await app.withPlugin(new IndexPagePlugin());
await app.withPlugin(new A2APlugin(agent));

// UCP agent profile — required for Shopify Checkout MCP capability negotiation
// https://ucp.dev/specification/overview
app.route("GET", "/.well-known/ucp", () =>
  Response.json({
    ucp: {
      version: "2026-01-11",
      capabilities: [
        { name: "dev.ucp.shopping.checkout", version: "2026-01-11" },
      ],
    },
  }),
);

await app.initialize();
export default app;
