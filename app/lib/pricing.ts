/**
 * Pricing utilities for USDC x402 payment integration.
 *
 * When checkout tools are added, use these helpers to convert
 * SGD product prices into USDC amounts for x402 payment gating.
 *
 * Conversion rate: 1 SGD = 1.26 USD (= 1.26 USDC on Base)
 */

/** Fixed SGD → USD conversion rate */
export const SGD_TO_USD = 1.26;

/**
 * Convert a SGD price to USDC (1:1 with USD on Base).
 * @param sgdPrice - Price in Singapore Dollars
 * @returns USDC amount string formatted for x402 (e.g. "$2.52")
 */
export function sgdToUsdc(sgdPrice: number): string {
  const usdc = sgdPrice * SGD_TO_USD;
  return `$${usdc.toFixed(2)}`;
}

/**
 * Build an x402 Accepts config for a product priced in SGD.
 *
 * Usage (future checkout tool):
 * ```ts
 * export const accepts: Accepts = productAccepts(19.90); // SGD 19.90 → $25.07 USDC
 * ```
 */
export function productAccepts(sgdPrice: number) {
  return {
    scheme: "exact" as const,
    price: sgdToUsdc(sgdPrice),
  };
}
