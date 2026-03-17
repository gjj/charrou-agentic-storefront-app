import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "Charrou Agentic Storefront",
  description: "AI-powered storefront assistant for Charrou.sg — browse products, get recommendations, and answer FAQs.",
  version: "0.1.0",
  x402: {
    payTo: "0xf3A480427777A0b4B1B05A320c084abAdDB12fb4",
    network: (process.env.X402_NETWORK as `eip155:${number}`) || "eip155:84532",
  },
  skills: [
    {
      id: "browse-products",
      name: "Browse Products",
      description: "Browse and search products from the Charrou.sg catalog",
      tags: ["products", "browse", "search", "catalog", "shopify"],
      examples: [
        "Show me all available products",
        "Search for leather bags",
        "What products do you have under $100 SGD?",
        "Find something for a birthday gift",
      ],
    },
    {
      id: "recommend-products",
      name: "Product Recommendations",
      description: "Get personalised product recommendations based on budget, occasion, or preferences",
      tags: ["recommend", "suggest", "products", "personalised"],
      examples: [
        "Recommend a gift for someone who loves coffee",
        "What is your best seller?",
        "I have a budget of $50 SGD, what can you recommend?",
        "What would you suggest for a housewarming gift?",
      ],
    },
    {
      id: "faq",
      name: "Store FAQ",
      description: "Answer frequently asked questions about Charrou.sg — shipping, returns, policies, and more",
      tags: ["faq", "help", "shipping", "returns", "policies", "support"],
      examples: [
        "What is your return policy?",
        "How long does shipping take?",
        "Do you ship internationally?",
        "What payment methods do you accept?",
      ],
    },
  ],
};

export default config;
